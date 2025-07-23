const { ethers } = require('ethers');
const { 
  PositionStates, 
  ClosureReasons, 
  determinePositionStatus,
  trackStateTransition,
  validatePositionLifecycle
} = require('./lpPositionStates');
const { backupLPData } = require('./dataBackup');
const { 
  calculatePositionAmounts,
  calculateClaimableFees,
  mapFieldNames
} = require('../shared/lpCalculations');
const { getLogger } = require('./logger');

// NFT Position Manager ABI (minimal)
const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'event DecreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'event Collect(uint256 indexed tokenId, address recipient, uint256 amount0, uint256 amount1)'
];

class EnhancedLPUpdater {
  constructor(provider, positionManagerAddress, poolAddress) {
    this.provider = provider;
    this.positionManager = new ethers.Contract(
      positionManagerAddress,
      POSITION_MANAGER_ABI,
      provider
    );
    this.poolAddress = poolAddress;
    this.stateTransitions = [];
    this.closedPositions = new Set();
    this.logger = getLogger({ logLevel: 'info' });
  }

  /**
   * Update all LP positions with enhanced closure detection
   */
  async updateAllPositions(currentData, options = {}) {
    const startTime = Date.now();
    const currentBlock = await this.provider.getBlockNumber();
    
    await this.logger.info(`Starting enhanced LP position update at block ${currentBlock}`, {
      existingPositions: currentData.lpPositions?.length || 0,
      options
    });
    
    this.logger.startTimer('updateAllPositions');

    // Get pool state for calculations
    this.logger.startTimer('getPoolState');
    const poolState = await this.getPoolState();
    await this.logger.endTimer('getPoolState', { tick: poolState.tick });

    // Create backup before updates
    if (options.createBackup !== false) {
      this.logger.startTimer('backup');
      await backupLPData(currentData);
      await this.logger.endTimer('backup');
    }

    const results = {
      updated: 0,
      new: 0,
      closed: 0,
      transferred: 0,
      errors: [],
      stateTransitions: []
    };

    try {
      // Step 1: Update existing positions
      this.logger.startTimer('updateExistingPositions');
      const updatedPositions = await this.updateExistingPositions(
        currentData.lpPositions,
        currentBlock,
        poolState
      );
      await this.logger.endTimer('updateExistingPositions', {
        updated: updatedPositions.updated.length,
        closed: updatedPositions.closed.length,
        transferred: updatedPositions.transferred.length
      });
      results.updated = updatedPositions.updated.length;
      results.closed = updatedPositions.closed.length;
      results.transferred = updatedPositions.transferred.length;

      // Step 2: Check for new positions
      this.logger.startTimer('checkForNewPositions');
      const newPositions = await this.checkForNewPositions(
        currentData.lpPositions,
        currentBlock,
        poolState,
        options.scanBlocks || 1000
      );
      await this.logger.endTimer('checkForNewPositions', {
        found: newPositions.length,
        scanBlocks: options.scanBlocks || 1000
      });
      results.new = newPositions.length;

      // Step 3: Merge all positions
      const allPositions = this.mergePositions(
        updatedPositions.updated,
        updatedPositions.closed,
        newPositions
      );

      // Step 4: Validate data integrity
      const validationResults = this.validateAllPositions(allPositions);
      if (validationResults.errors.length > 0) {
        console.warn('Validation errors found:', validationResults.errors);
        results.errors.push(...validationResults.errors);
      }

      // Step 5: Generate statistics
      const stats = this.generateUpdateStats(allPositions, startTime);
      
      const duration = await this.logger.endTimer('updateAllPositions');
      
      // Log update summary
      await this.logger.logUpdateSummary({
        ...results,
        duration,
        totalPositions: allPositions.length,
        stateTransitions: this.stateTransitions.length
      });

      return {
        success: true,
        data: {
          ...currentData,
          lpPositions: allPositions,
          lastLPUpdate: currentBlock,
          updateStats: stats
        },
        results,
        stateTransitions: this.stateTransitions
      };

    } catch (error) {
      await this.logger.error('Enhanced LP update failed', {
        error: error.message,
        stack: error.stack,
        results
      });
      
      return {
        success: false,
        error: error.message,
        results
      };
    }
  }

  /**
   * Get current pool state
   */
  async getPoolState() {
    const poolABI = [
      'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'
    ];
    
    const pool = new ethers.Contract(this.poolAddress, poolABI, this.provider);
    const slot0 = await pool.slot0();
    
    return {
      sqrtPriceX96: slot0.sqrtPriceX96.toString(),
      tick: slot0.tick,
      currentTick: slot0.tick
    };
  }

  /**
   * Update existing positions with closure detection
   */
  async updateExistingPositions(positions, currentBlock, poolState) {
    const updated = [];
    const closed = [];
    const transferred = [];

    for (const position of positions) {
      try {
        // Skip if already marked as permanently closed
        if (position.status === PositionStates.CLOSED && position.permanentlyClosed) {
          closed.push(position);
          continue;
        }

        // Fetch current on-chain data
        const onChainData = await this.fetchPositionData(position.tokenId, poolState);
        
        // Determine current status
        const statusResult = determinePositionStatus(position, currentBlock, onChainData);
        
        // Track state transition
        if (position.status !== statusResult.status) {
          const transition = trackStateTransition(position, { ...position, status: statusResult.status });
          this.stateTransitions.push(transition);
          
          await this.logger.logPositionChange(position.tokenId, {
            previousStatus: position.status,
            newStatus: statusResult.status,
            reason: statusResult.reason
          });
        }

        // Process based on status
        switch (statusResult.status) {
          case PositionStates.CLOSED:
            const closedPosition = {
              ...position,
              ...onChainData,
              status: PositionStates.CLOSED,
              closedAt: statusResult.timestamp,
              closureReason: statusResult.reason,
              permanentlyClosed: true,
              lastUpdated: new Date().toISOString()
            };
            closed.push(closedPosition);
            this.closedPositions.add(position.tokenId);
            break;

          case PositionStates.TRANSFERRED:
            const transferredPosition = {
              ...position,
              ...onChainData,
              status: PositionStates.TRANSFERRED,
              previousOwner: position.owner,
              owner: statusResult.newOwner,
              transferredAt: statusResult.timestamp,
              lastUpdated: new Date().toISOString()
            };
            transferred.push(transferredPosition);
            updated.push(transferredPosition);
            break;

          default:
            const updatedPosition = {
              ...position,
              ...onChainData,
              status: statusResult.status,
              lastUpdated: new Date().toISOString(),
              lastActivityBlock: currentBlock
            };
            updated.push(updatedPosition);
        }

      } catch (error) {
        await this.logger.error(`Failed to update position ${position.tokenId}`, {
          tokenId: position.tokenId,
          error: error.message,
          stack: error.stack
        });
        
        // Keep the position with error flag
        updated.push({
          ...position,
          updateError: error.message,
          lastUpdateAttempt: new Date().toISOString()
        });
      }
    }

    return { updated, closed, transferred };
  }

  /**
   * Check for new positions from recent events
   */
  async checkForNewPositions(existingPositions, currentBlock, poolState, scanBlocks) {
    const existingIds = new Set(existingPositions.map(p => p.tokenId));
    const newPositions = [];

    // Scan for Mint events
    const fromBlock = currentBlock - scanBlocks;
    const mintFilter = this.positionManager.filters.Transfer(
      ethers.constants.AddressZero,
      null,
      null
    );

    const mintEvents = await this.positionManager.queryFilter(
      mintFilter,
      fromBlock,
      currentBlock
    );

    for (const event of mintEvents) {
      const tokenId = event.args.tokenId.toString();
      
      if (!existingIds.has(tokenId)) {
        try {
          const positionData = await this.fetchPositionData(tokenId, poolState);
          
          if (positionData && this.isTorusPosition(positionData)) {
            newPositions.push({
              ...positionData,
              tokenId,
              status: PositionStates.NEW,
              createdAt: new Date().toISOString(),
              mintBlock: event.blockNumber,
              mintTx: event.transactionHash
            });
          }
        } catch (error) {
          console.error(`Failed to fetch new position ${tokenId}:`, error.message);
        }
      }
    }

    return newPositions;
  }

  /**
   * Fetch position data from chain
   */
  async fetchPositionData(tokenId, poolState) {
    try {
      // Get position details
      const position = await this.positionManager.positions(tokenId);
      
      // Get owner (this will throw if position is burned)
      let owner;
      let burned = false;
      try {
        owner = await this.positionManager.ownerOf(tokenId);
      } catch (error) {
        burned = true;
        owner = ethers.constants.AddressZero;
      }

      // Calculate token amounts
      const amounts = calculatePositionAmounts(
        {
          liquidity: position.liquidity.toString(),
          tickLower: position.tickLower,
          tickUpper: position.tickUpper
        },
        ethers.BigNumber.from(poolState.sqrtPriceX96),
        poolState.currentTick
      );

      // Calculate claimable fees
      const claimableFees = await calculateClaimableFees(
        tokenId,
        owner,
        position,
        this.provider
      );

      // Check if position is in range
      const inRange = poolState.currentTick >= position.tickLower && 
                     poolState.currentTick < position.tickUpper;

      const rawData = {
        tokenId: tokenId.toString(),
        owner,
        burned,
        token0: position.token0,
        token1: position.token1,
        fee: position.fee,
        tickLower: position.tickLower,
        tickUpper: position.tickUpper,
        liquidity: position.liquidity.toString(),
        tokensOwed0: position.tokensOwed0.toString(),
        tokensOwed1: position.tokensOwed1.toString(),
        nonce: position.nonce.toString(),
        amount0: amounts.amount0,
        amount1: amounts.amount1,
        claimableTorus: claimableFees.claimableTorus,
        claimableTitanX: claimableFees.claimableTitanX,
        inRange
      };

      // Map field names for frontend compatibility
      return mapFieldNames(rawData);
    } catch (error) {
      // Position might not exist
      return null;
    }
  }

  /**
   * Check if position is in TORUS pool
   */
  isTorusPosition(position) {
    const TORUS_TOKEN = '0xB47F575807fc5466285e1277ef8ACFBb5c6686e8'.toLowerCase();
    const TITANX_TOKEN = '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1'.toLowerCase();
    
    const tokens = [position.token0.toLowerCase(), position.token1.toLowerCase()];
    return tokens.includes(TORUS_TOKEN) && tokens.includes(TITANX_TOKEN);
  }

  /**
   * Merge positions preserving closed ones
   */
  mergePositions(updated, closed, newPositions) {
    const positionMap = new Map();

    // Add updated positions
    updated.forEach(pos => positionMap.set(pos.tokenId, pos));

    // Add closed positions (preserve them)
    closed.forEach(pos => positionMap.set(pos.tokenId, pos));

    // Add new positions
    newPositions.forEach(pos => positionMap.set(pos.tokenId, pos));

    return Array.from(positionMap.values());
  }

  /**
   * Validate all positions
   */
  validateAllPositions(positions) {
    const errors = [];
    const warnings = [];

    positions.forEach(position => {
      const validation = validatePositionLifecycle(position);
      if (!validation.isValid) {
        errors.push({
          tokenId: position.tokenId,
          errors: validation.errors
        });
      }
      if (validation.warnings.length > 0) {
        warnings.push({
          tokenId: position.tokenId,
          warnings: validation.warnings
        });
      }
    });

    return { errors, warnings };
  }

  /**
   * Generate update statistics
   */
  generateUpdateStats(positions, startTime) {
    const stats = {
      totalPositions: positions.length,
      byStatus: {},
      updateDuration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };

    // Count by status
    positions.forEach(pos => {
      const status = pos.status || PositionStates.UNKNOWN;
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    });

    return stats;
  }

  /**
   * Get recent activity for a position
   */
  async getPositionActivity(tokenId, fromBlock) {
    const events = [];

    // Get all relevant events
    const filters = [
      this.positionManager.filters.IncreaseLiquidity(tokenId),
      this.positionManager.filters.DecreaseLiquidity(tokenId),
      this.positionManager.filters.Collect(tokenId),
      this.positionManager.filters.Transfer(null, null, tokenId)
    ];

    for (const filter of filters) {
      const filterEvents = await this.positionManager.queryFilter(filter, fromBlock);
      events.push(...filterEvents);
    }

    // Sort by block number
    events.sort((a, b) => b.blockNumber - a.blockNumber);

    return events;
  }
}

module.exports = { EnhancedLPUpdater };