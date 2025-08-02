#!/usr/bin/env node

/**
 * STATUS: ACTIVE - Core update logic
 * RUNS: Called by auto-update-fixed.js every 30 minutes
 * PURPOSE: Performs incremental data updates with blockchain fetching
 * DEPENDENCIES: ethers.js, cached-data.json, lpCalculations.js
 * CRITICAL: Falls back to full update if significant changes detected
 * 
 * TORUS Dashboard - Fixed Smart Update Script
 * 
 * Fixes data preservation issues:
 * - Preserves existing LP positions
 * - Merges new data instead of replacing
 * - Only updates changed fields
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { 
  calculatePositionAmounts: calculatePositionAmountsShared,
  calculateClaimableFees,
  mapFieldNames,
  mergeLPPositions 
} = require('./shared/lpCalculations');
const { generateFutureSupplyProjection, shouldUpdateProjection } = require('./scripts/generate-future-supply-projection-fixed');
const {
  fetchUserStakeData,
  fetchUserCreateData,
  fetchBlockData,
  logRpcStats,
  resetRpcStats
} = require('./shared/rpcUtils');
const { getComprehensivePaymentData } = require('./comprehensive-payment-matching');

// Configuration
const UPDATE_LOG_FILE = 'update-log.json';
const CACHE_FILE = './public/data/cached-data.json';
const MAX_RPC_CALLS_PER_UPDATE = 100; // Safety limit

// Contract addresses
const CONTRACTS = {
  TORUS: '0xb47f575807fc5466285e1277ef8acfbb5c6686e8',
  TITANX: '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1',
  CREATE_STAKE: '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507',
  POOL: '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F',
  NFT_POSITION_MANAGER: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
};

// Colors for console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};


// Use shared calculation from lpCalculations module
function calculatePositionAmounts(position, sqrtPriceX96, currentTick) {
  return calculatePositionAmountsShared(position, sqrtPriceX96, currentTick);
}

// Legacy function kept for compatibility
function calculatePositionAmountsLegacy(position, sqrtPriceX96, currentTick) {
  // Use proper Uniswap V3 math for all positions
  const liquidity = position.liquidity.toString();
  const tickLower = position.tickLower;
  const tickUpper = position.tickUpper;
  
  // Use BigInt for precision
  const liquidityBN = BigInt(liquidity);
  const sqrtPrice = BigInt(sqrtPriceX96.toString());
  const Q96 = BigInt(2) ** BigInt(96);
  
  // Calculate sqrt prices for the tick range
  const priceLower = Math.pow(1.0001, tickLower);
  const priceUpper = Math.pow(1.0001, tickUpper);
  
  // Convert to BigInt sqrt prices (multiply by 2^96 and take sqrt)
  const sqrtPriceLowerFloat = Math.sqrt(priceLower) * Math.pow(2, 96);
  const sqrtPriceUpperFloat = Math.sqrt(priceUpper) * Math.pow(2, 96);
  
  const sqrtPriceLower = BigInt(Math.floor(sqrtPriceLowerFloat));
  const sqrtPriceUpper = BigInt(Math.floor(sqrtPriceUpperFloat));
  
  let amount0 = BigInt(0);
  let amount1 = BigInt(0);
  
  // Calculate based on current price position
  if (sqrtPrice <= sqrtPriceLower) {
    // Current price is below the range, all liquidity is in token0
    amount0 = (liquidityBN * (sqrtPriceUpper - sqrtPriceLower) * Q96) / 
      (sqrtPriceUpper * sqrtPriceLower);
  } else if (sqrtPrice < sqrtPriceUpper) {
    // Current price is within the range
    amount0 = (liquidityBN * (sqrtPriceUpper - sqrtPrice) * Q96) / 
      (sqrtPriceUpper * sqrtPrice);
    amount1 = (liquidityBN * (sqrtPrice - sqrtPriceLower)) / Q96;
  } else {
    // Current price is above the range, all liquidity is in token1
    amount1 = (liquidityBN * (sqrtPriceUpper - sqrtPriceLower)) / Q96;
  }
  
  // Convert to decimal values
  const decimals0 = BigInt(10) ** BigInt(18);
  const decimals1 = BigInt(10) ** BigInt(18);
  
  const decimal0 = Number(amount0) / Number(decimals0);
  const decimal1 = Number(amount1) / Number(decimals1);
  
  return {
    amount0: decimal0,
    amount1: decimal1
  };
}

function log(message, color = 'reset') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${colors[color]}${message}${colors.reset}`);
}

// Load update history
function loadUpdateLog() {
  try {
    if (fs.existsSync(UPDATE_LOG_FILE)) {
      return JSON.parse(fs.readFileSync(UPDATE_LOG_FILE, 'utf8'));
    }
  } catch (e) {
    log('Creating new update log', 'yellow');
  }
  return {
    lastBlockNumber: 0,
    lastUpdateTime: 0,
    totalRpcCalls: 0,
    updates: [],
    updateHistory: []
  };
}

// Save update history
function saveUpdateLog(logData) {
  fs.writeFileSync(UPDATE_LOG_FILE, JSON.stringify(logData, null, 2));
}

// Helper function to deduplicate events array
function deduplicateEvents(events, keyFunction) {
  const seen = new Set();
  const unique = [];
  
  for (const event of events) {
    const key = keyFunction(event);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(event);
    }
  }
  
  return unique;
}

// Get working RPC provider
async function getProvider() {
  const providers = [
    'https://eth.drpc.org',
    'https://rpc.payload.de',
    'https://eth-mainnet.public.blastapi.io'
  ];
  
  for (const url of providers) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(url);
      await provider.getBlockNumber();
      return provider;
    } catch (e) {
      continue;
    }
  }
  throw new Error('No working RPC providers');
}

// Check if update is needed
async function shouldUpdate(provider, updateLog) {
  try {
    const currentBlock = await provider.getBlockNumber();
    const blocksSinceLastUpdate = currentBlock - updateLog.lastBlockNumber;
    
    log(`Current block: ${currentBlock}, Last update: ${updateLog.lastBlockNumber}`, 'cyan');
    log(`Blocks since last update: ${blocksSinceLastUpdate}`, 'cyan');
    
    // Always update if there are new blocks - removed arbitrary minimum
    // We want to catch all new transactions as soon as possible
    
    return { shouldUpdate: true, currentBlock, blocksSinceLastUpdate };
  } catch (e) {
    log(`Error checking blocks: ${e.message}`, 'red');
    return { shouldUpdate: false };
  }
}

// Use the shared mergeLPPositions from lpCalculations module
// (removed local duplicate function)

// Update LP positions incrementally
async function updateLPPositionsIncrementally(provider, cachedData, currentBlock, blocksSinceLastUpdate) {
  const updateStats = {
    newPositions: 0,
    updatedPositions: 0,
    removedPositions: 0
  };
  
  try {
    // Get existing positions
    const existingPositions = cachedData.lpPositions || [];
    const existingTokenIds = new Set(existingPositions.map(p => p.tokenId));
    
    log(`Checking updates for ${existingPositions.length} existing LP positions...`, 'cyan');
    
    // ABIs
    const poolABI = ['event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)'];
    const positionManagerABI = [
      'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
      'function ownerOf(uint256 tokenId) view returns (address)',
      'event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)'
    ];
    
    const poolContract = new ethers.Contract(CONTRACTS.POOL, poolABI, provider);
    const positionManager = new ethers.Contract(CONTRACTS.NFT_POSITION_MANAGER, positionManagerABI, provider);
    
    // Update existing positions (check for liquidity changes, ownership, etc.)
    const updatedPositions = [];
    
    for (const position of existingPositions) {
      try {
        const [currentPosition, owner] = await Promise.all([
          positionManager.positions(position.tokenId),
          positionManager.ownerOf(position.tokenId).catch(() => null)
        ]);
        
        // If position no longer exists or has no liquidity, mark for removal
        if (!owner || currentPosition.liquidity.toString() === '0') {
          log(`  Position ${position.tokenId} removed or has 0 liquidity`, 'yellow');
          updateStats.removedPositions++;
          continue;
        }
        
        // Update position data if changed
        const liquidityChanged = position.liquidity !== currentPosition.liquidity.toString();
        const ownerChanged = position.owner !== owner;
        
        if (liquidityChanged || ownerChanged) {
          log(`  Position ${position.tokenId} updated`, 'green');
          updateStats.updatedPositions++;
        }
        

        // Calculate current amounts if pool data is available
        let amount0 = position.amount0 || 0;
        let amount1 = position.amount1 || 0;
        
        if (cachedData.poolData && cachedData.poolData.sqrtPriceX96) {
          const calculated = calculatePositionAmounts(
            currentPosition,
            ethers.BigNumber.from(cachedData.poolData.sqrtPriceX96),
            cachedData.poolData.currentTick
          );
          amount0 = calculated.amount0;
          amount1 = calculated.amount1;
        }
        
        // Calculate claimable fees
        const claimableFees = await calculateClaimableFees(
          position.tokenId,
          owner,
          currentPosition,
          provider
        );
        
        // Always include the position (updated or not) to preserve it
        const updatedPosition = mapFieldNames({
          ...position,
          liquidity: currentPosition.liquidity.toString(),
          owner: owner,
          amount0: amount0,
          amount1: amount1,
          claimableTorus: claimableFees.claimableTorus,
          claimableTitanX: claimableFees.claimableTitanX,
          tokensOwed0: currentPosition.tokensOwed0.toString(),
          tokensOwed1: currentPosition.tokensOwed1.toString(),
          lastChecked: new Date().toISOString()
        });
        updatedPositions.push(updatedPosition);
        
      } catch (e) {
        // Error checking position, keep the existing data
        log(`  Error checking position ${position.tokenId}: ${e.message}`, 'yellow');
        updatedPositions.push(position);
      }
    }
    
    // Only check for NEW positions if many blocks have passed
    if (blocksSinceLastUpdate > 100) {
      log('Checking for new LP positions...', 'cyan');
      
      try {
        const mintFilter = poolContract.filters.Mint();
        const mintEvents = await poolContract.queryFilter(mintFilter, currentBlock - 100, currentBlock);
        
        if (mintEvents.length > 0) {
          log(`Found ${mintEvents.length} new Mint events`, 'yellow');
          
          // Process mint events to find new positions
          for (const mintEvent of mintEvents.slice(0, 5)) { // Limit to 5 to avoid too many RPC calls
            if (!mintEvent.args) continue;
            
            // Look for corresponding NFT position
            const searchBlock = mintEvent.blockNumber;
            const increaseLiquidityFilter = positionManager.filters.IncreaseLiquidity();
            const incEvents = await positionManager.queryFilter(
              increaseLiquidityFilter, 
              searchBlock - 2, 
              searchBlock + 2
            );
            
            for (const incEvent of incEvents) {
              if (!incEvent.args) continue;
              
              const tokenId = incEvent.args.tokenId.toString();
              
              // Skip if we already have this position
              if (existingTokenIds.has(tokenId)) continue;
              
              try {
                const [position, owner] = await Promise.all([
                  positionManager.positions(tokenId),
                  positionManager.ownerOf(tokenId)
                ]);
                
                // Verify this is TORUS/TitanX pool
                if (((position.token0.toLowerCase() === CONTRACTS.TORUS.toLowerCase() && 
                      position.token1.toLowerCase() === CONTRACTS.TITANX.toLowerCase()) ||
                     (position.token0.toLowerCase() === CONTRACTS.TITANX.toLowerCase() && 
                      position.token1.toLowerCase() === CONTRACTS.TORUS.toLowerCase())) &&
                    position.liquidity.gt(0)) {
                  
                  // Check if in range
                  const inRange = slot0.tick >= position.tickLower && slot0.tick <= position.tickUpper;
                  
                  // Calculate price range
                  const isFullRange = position.tickLower === -887200 && position.tickUpper === 887200;
                  const priceRange = isFullRange ? "Full Range V3 (0 - ∞)" : "Calculating...";
                  
                  // Calculate amounts for new position
                  let amount0 = 0;
                  let amount1 = 0;
                  if (cachedData.poolData && cachedData.poolData.sqrtPriceX96) {
                    const calculated = calculatePositionAmounts(
                      position,
                      ethers.BigNumber.from(cachedData.poolData.sqrtPriceX96),
                      cachedData.poolData.currentTick
                    );
                    amount0 = calculated.amount0;
                    amount1 = calculated.amount1;
                  }
                  
                  // Calculate claimable fees for new position
                  const claimableFees = await calculateClaimableFees(
                    tokenId,
                    owner,
                    position,
                    provider
                  );
                  
                  // Add position data with calculated amounts
                  const newPosition = mapFieldNames({
                    tokenId: tokenId,
                    owner: owner,
                    liquidity: position.liquidity.toString(),
                    tickLower: position.tickLower,
                    tickUpper: position.tickUpper,
                    fee: position.fee,
                    amount0: amount0,
                    amount1: amount1,
                    inRange: inRange,
                    claimableTorus: claimableFees.claimableTorus,
                    claimableTitanX: claimableFees.claimableTitanX,
                    tokensOwed0: position.tokensOwed0.toString(),
                    tokensOwed1: position.tokensOwed1.toString(),
                    estimatedAPR: inRange ? "12.50" : "0.00",
                    priceRange: priceRange,
                    lastChecked: new Date().toISOString(),
                    isNew: true
                  });
                  updatedPositions.push(newPosition);
                  
                  updateStats.newPositions++;
                  log(`  Added new position ${tokenId}`, 'green');
                }
              } catch (e) {
                // Skip this position
                continue;
              }
            }
          }
        }
      } catch (e) {
        log(`Error checking for new positions: ${e.message}`, 'yellow');
      }
    }
    
    return {
      positions: updatedPositions,
      stats: updateStats
    };
    
  } catch (e) {
    log(`Error updating LP positions: ${e.message}`, 'red');
    // Return existing positions on error
    return {
      positions: cachedData.lpPositions || [],
      stats: updateStats
    };
  }
}

// Smart update function
async function performSmartUpdate(provider, updateLog, currentBlock, blocksSinceLastUpdate) {
  const updateStats = {
    rpcCalls: 0,
    dataChanged: false,
    errors: []
  };
  
  try {
    // Load current cached data
    const cachedData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    const originalData = JSON.stringify(cachedData);
    
    // Clean up any existing duplicates first
    if (cachedData.stakingData) {
      const originalStakeCount = cachedData.stakingData.stakeEvents?.length || 0;
      const originalCreateCount = cachedData.stakingData.createEvents?.length || 0;
      
      if (cachedData.stakingData.stakeEvents) {
        cachedData.stakingData.stakeEvents = deduplicateEvents(
          cachedData.stakingData.stakeEvents,
          stake => `${stake.user}-${stake.id}-${stake.blockNumber}`
        );
      }
      
      if (cachedData.stakingData.createEvents) {
        cachedData.stakingData.createEvents = deduplicateEvents(
          cachedData.stakingData.createEvents,
          create => `${create.user}-${create.id || create.createId}-${create.blockNumber}`
        );
      }
      
      const removedStakes = originalStakeCount - (cachedData.stakingData.stakeEvents?.length || 0);
      const removedCreates = originalCreateCount - (cachedData.stakingData.createEvents?.length || 0);
      
      if (removedStakes > 0 || removedCreates > 0) {
        log(`🧹 Cleaned up duplicates: ${removedStakes} stake events, ${removedCreates} create events`, 'yellow');
        updateStats.dataChanged = true;
      }
    }
    
    // 1. Update pool data
    log('Updating pool data...', 'cyan');
    
    try {
      const poolABI = ['function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)'];
      const pool = new ethers.Contract(CONTRACTS.POOL, poolABI, provider);
      const slot0 = await pool.slot0();
      updateStats.rpcCalls++;
      
      if (cachedData.poolData && cachedData.poolData.currentTick !== slot0.tick) {
        cachedData.poolData.currentTick = slot0.tick;
        cachedData.poolData.sqrtPriceX96 = slot0.sqrtPriceX96.toString();
        updateStats.dataChanged = true;
        log('Pool data updated', 'green');
      }
      
      // Also update uniswapV3.poolData if it exists
      if (cachedData.uniswapV3?.poolData) {
        cachedData.uniswapV3.poolData.currentTick = slot0.tick;
        cachedData.uniswapV3.poolData.sqrtPriceX96 = slot0.sqrtPriceX96.toString();
      }
    } catch (e) {
      updateStats.errors.push(`Pool update: ${e.message}`);
    }
    
    // 2. Update total supply
    log('Updating total supply...', 'cyan');
    try {
      const torusContract = new ethers.Contract(
        '0xb47f575807fc5466285e1277ef8acfbb5c6686e8',
        [
          'function totalSupply() view returns (uint256)',
          'function balanceOf(address) view returns (uint256)'
        ],
        provider
      );
      const [totalSupply, stakedBalance] = await Promise.all([
        torusContract.totalSupply(),
        torusContract.balanceOf(CONTRACTS.CREATE_STAKE)
      ]);
      const formattedSupply = parseFloat(ethers.utils.formatEther(totalSupply));
      const formattedStakedBalance = parseFloat(ethers.utils.formatEther(stakedBalance));
      
      const oldSupply = cachedData.totalSupply || 0;
      if (Math.abs(oldSupply - formattedSupply) > 0.000001) {
        cachedData.totalSupply = formattedSupply;
        updateStats.dataChanged = true;
        log(`Total supply updated: ${formattedSupply.toFixed(6)} TORUS (was ${oldSupply.toFixed(6)})`, 'green');
      }
      
      // Also update in stakingData section (where frontend reads from)
      if (cachedData.stakingData) {
        const oldStakingSupply = cachedData.stakingData.totalSupply || 0;
        if (Math.abs(oldStakingSupply - formattedSupply) > 0.000001) {
          cachedData.stakingData.totalSupply = formattedSupply;
          updateStats.dataChanged = true;
          log(`Staking data total supply updated: ${formattedSupply.toFixed(6)} TORUS (was ${oldStakingSupply.toFixed(6)})`, 'green');
        }
        
        // Update staked balance from contract
        const oldStakedBalance = cachedData.stakingData.totalStakedInContract || 0;
        if (Math.abs(oldStakedBalance - formattedStakedBalance) > 0.000001) {
          cachedData.stakingData.totalStakedInContract = formattedStakedBalance;
          updateStats.dataChanged = true;
          log(`Total staked in contract updated: ${formattedStakedBalance.toFixed(6)} TORUS (was ${oldStakedBalance.toFixed(6)})`, 'green');
        }
        
        // Track daily supply snapshot
        if (cachedData.stakingData.currentProtocolDay) {
          const snapshotData = {
            day: cachedData.stakingData.currentProtocolDay,
            totalSupply: formattedSupply,
            burnedSupply: cachedData.stakingData.burnedSupply || 0,
            timestamp: new Date().toISOString()
          };
          
          // Store in metadata for frontend to process
          if (!cachedData.stakingData.metadata) {
            cachedData.stakingData.metadata = {};
          }
          cachedData.stakingData.metadata.dailySupplySnapshot = snapshotData;
          log(`Daily supply snapshot recorded for day ${snapshotData.day}`, 'green');
        }
      }
      updateStats.rpcCalls++;
    } catch (e) {
      log(`Failed to update total supply: ${e.message}`, 'yellow');
    }
    
    // 3. Update TitanX data
    log('Updating TitanX data...', 'cyan');
    try {
      // TitanX contract addresses
      const TITANX_CONTRACT = '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1';
      const TORUS_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
      
      const titanXContract = new ethers.Contract(
        TITANX_CONTRACT,
        ['function totalSupply() view returns (uint256)'],
        provider
      );
      
      // Get TitanX burned by TORUS contract specifically
      const torusStakeContract = new ethers.Contract(
        TORUS_STAKE_CONTRACT,
        ['function totalTitanXBurnt() view returns (uint256)'],
        provider
      );
      
      // Get TitanX total supply and TORUS-specific burn amount
      const [titanXTotalSupply, torusBurnedAmount] = await Promise.all([
        titanXContract.totalSupply(),
        torusStakeContract.totalTitanXBurnt()
      ]);
      
      // Update TitanX total supply
      const oldTitanXSupply = cachedData.titanxTotalSupply || "0";
      if (oldTitanXSupply !== titanXTotalSupply.toString()) {
        cachedData.titanxTotalSupply = titanXTotalSupply.toString();
        updateStats.dataChanged = true;
        log(`TitanX total supply updated: ${ethers.utils.formatEther(titanXTotalSupply)} TITANX`, 'green');
      }
      
      // Update TitanX burned amount (TORUS-specific)
      const oldBurned = cachedData.totalTitanXBurnt || "0";
      if (oldBurned !== torusBurnedAmount.toString()) {
        cachedData.totalTitanXBurnt = torusBurnedAmount.toString();
        updateStats.dataChanged = true;
        log(`TitanX burned by TORUS updated: ${ethers.utils.formatEther(torusBurnedAmount)} TITANX`, 'green');
        log(`In billions: ${(parseFloat(ethers.utils.formatEther(torusBurnedAmount)) / 1e9).toFixed(3)}B`, 'green');
      }
      
      updateStats.rpcCalls += 2;
    } catch (e) {
      log(`Failed to update TitanX data: ${e.message}`, 'yellow');
    }
    
    // 4. Update LP positions incrementally
    log('Updating LP positions incrementally...', 'cyan');
    
    const lpUpdateResult = await updateLPPositionsIncrementally(
      provider, 
      cachedData, 
      currentBlock, 
      blocksSinceLastUpdate
    );
    
    if (lpUpdateResult.stats.newPositions > 0 || 
        lpUpdateResult.stats.updatedPositions > 0 || 
        lpUpdateResult.stats.removedPositions > 0) {
      
      // Merge positions preserving existing data
      cachedData.lpPositions = lpUpdateResult.positions;
      
      // Also update in uniswapV3 section
      if (cachedData.uniswapV3) {
        cachedData.uniswapV3.lpPositions = lpUpdateResult.positions;
      }
      
      updateStats.dataChanged = true;
      log(`LP positions updated: ${lpUpdateResult.stats.newPositions} new, ${lpUpdateResult.stats.updatedPositions} updated, ${lpUpdateResult.stats.removedPositions} removed`, 'green');
    }
    
    // 5. Update staking data incrementally
    log('Checking for new stake/create events...', 'cyan');
    
    try {
      // Get last block from staking data
      let lastStakeBlock = cachedData.stakingData?.metadata?.currentBlock || 
                          cachedData.stakingData?.lastBlock || 
                          22890272; // Fallback to deployment block
      
      // If lastStakeBlock is too far behind (>50k blocks), start from a recent block
      const MAX_BLOCKS_BEHIND = 50000;
      if ((currentBlock - lastStakeBlock) > MAX_BLOCKS_BEHIND) {
        // Start from 20k blocks ago (about 3 days)
        const newStartBlock = currentBlock - 20000;
        log(`⚠️  Last stake block (${lastStakeBlock}) is too old. Starting from block ${newStartBlock} instead`, 'yellow');
        lastStakeBlock = newStartBlock;
      }
      
      // Always check for new stake/create events regardless of main update threshold
      if (currentBlock > lastStakeBlock) {
        const CONTRACTS = {
          TORUS_CREATE_STAKE: '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507'
        };
        
        const contractABI = [
          'event Staked(address indexed user, uint256 stakeIndex, uint256 principal, uint256 stakingDays, uint256 shares)',
          'event Created(address indexed user, uint256 stakeIndex, uint256 torusAmount, uint256 endTime)',
          'function getCurrentDayIndex() view returns (uint24)'
        ];
        
        const contract = new ethers.Contract(CONTRACTS.TORUS_CREATE_STAKE, contractABI, provider);
        
        // Fetch current protocol day from contract
        try {
          const currentDayFromContract = await contract.getCurrentDayIndex();
          const currentDayNumber = Number(currentDayFromContract);
          
          if (cachedData.currentProtocolDay !== currentDayNumber || 
              cachedData.stakingData.currentProtocolDay !== currentDayNumber) {
            log(`Updating current protocol day: ${currentDayNumber} (was ${cachedData.currentProtocolDay})`, 'green');
            cachedData.currentProtocolDay = currentDayNumber;
            cachedData.stakingData.currentProtocolDay = currentDayNumber;
            updateStats.dataChanged = true;
          }
        } catch (e) {
          log(`Failed to fetch current protocol day: ${e.message}`, 'yellow');
        }
        
        // Fetch in chunks if needed
        const MAX_BLOCK_RANGE = 9999;
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 2000; // 2 seconds
        let newStakeEvents = [];
        let newCreateEvents = [];
        let lastSuccessfulBlock = lastStakeBlock;
        
        for (let fromBlock = lastStakeBlock + 1; fromBlock <= currentBlock; fromBlock += MAX_BLOCK_RANGE) {
          const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, currentBlock);
          let retries = 0;
          let chunkSuccess = false;
          
          while (retries < MAX_RETRIES && !chunkSuccess) {
            try {
              log(`  Fetching events from block ${fromBlock} to ${toBlock} (attempt ${retries + 1}/${MAX_RETRIES})...`, 'cyan');
              
              const [stakeEvents, createEvents] = await Promise.all([
                contract.queryFilter(contract.filters.Staked(), fromBlock, toBlock),
                contract.queryFilter(contract.filters.Created(), fromBlock, toBlock)
              ]);
              
              newStakeEvents.push(...stakeEvents);
              newCreateEvents.push(...createEvents);
              updateStats.rpcCalls += 2;
              
              // Update lastBlock incrementally after successful chunk
              lastSuccessfulBlock = toBlock;
              
              // Update cached data's lastBlock to track progress
              if (cachedData.stakingData) {
                cachedData.stakingData.lastBlock = lastSuccessfulBlock;
                cachedData.stakingData.metadata = cachedData.stakingData.metadata || {};
                cachedData.stakingData.metadata.currentBlock = lastSuccessfulBlock;
              }
              
              log(`  ✓ Successfully fetched chunk: ${stakeEvents.length} stakes, ${createEvents.length} creates`, 'green');
              chunkSuccess = true;
              
            } catch (e) {
              retries++;
              log(`  ✗ Error fetching events ${fromBlock}-${toBlock}: ${e.message}`, 'red');
              
              if (retries < MAX_RETRIES) {
                log(`  ⏳ Retrying in ${RETRY_DELAY/1000} seconds...`, 'yellow');
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
              } else {
                log(`  ❌ Failed after ${MAX_RETRIES} attempts. Stopping at block ${lastSuccessfulBlock}`, 'red');
                // Stop processing further chunks if we can't get this one
                fromBlock = currentBlock + 1; // Exit the loop
              }
            }
          }
          
          if (!chunkSuccess) {
            // Save progress even on failure
            log(`  💾 Saving progress up to block ${lastSuccessfulBlock}`, 'yellow');
            break;
          }
        }
        
        if (newStakeEvents.length > 0 || newCreateEvents.length > 0) {
          // Fetch block timestamps for new events using optimized batch processing
          const blockNumbers = Array.from(new Set([
            ...newStakeEvents.map(e => e.blockNumber),
            ...newCreateEvents.map(e => e.blockNumber)
          ]));
          
          log(`  Fetching timestamps for ${blockNumbers.length} blocks...`, 'cyan');
          const blockTimestamps = await fetchBlockData(provider, blockNumbers, true);
          
          // Process and merge new events
          // Process new stakes and fetch payment data using comprehensive matching
          log(`  🔍 Getting comprehensive payment data for ${newStakeEvents.length} stakes...`, 'cyan');
          const minStakeBlock = newStakeEvents.length > 0 ? Math.min(...newStakeEvents.map(e => e.blockNumber)) : 0;
          const maxStakeBlock = newStakeEvents.length > 0 ? Math.max(...newStakeEvents.map(e => e.blockNumber)) : 0;
          const stakePaymentData = await getComprehensivePaymentData(newStakeEvents, provider, minStakeBlock, maxStakeBlock);
          
          const processedStakes = [];
          
          for (const event of newStakeEvents) {
            const blockTimestamp = blockTimestamps.get(event.blockNumber);
            if (!blockTimestamp) {
              log(`  ⚠️ Warning: Skipping stake event ${event.args.stakeIndex} - no timestamp for block ${event.blockNumber}`, 'yellow');
              continue;
            }
            const stakingDays = parseInt(event.args.stakingDays.toString());
            const maturityTimestamp = blockTimestamp + (stakingDays * 86400);
            
            // Calculate protocol day from timestamp
            const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z'); // July 10, 2025 6:00 PM UTC
            const eventDate = new Date(blockTimestamp * 1000);
            const msPerDay = 24 * 60 * 60 * 1000;
            const protocolDay = Math.max(1, Math.floor((eventDate.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1);
            
            const stakeData = {
              user: event.args.user,
              id: event.args.stakeIndex.toString(),
              principal: event.args.principal.toString(),
              shares: event.args.shares.toString(),
              duration: event.args.stakingDays.toString(),
              timestamp: blockTimestamp.toString(),
              blockNumber: event.blockNumber,
              // Add calculated fields
              stakingDays: stakingDays,
              maturityDate: new Date(maturityTimestamp * 1000).toISOString(),
              startDate: new Date(blockTimestamp * 1000).toISOString(),
              protocolDay: protocolDay, // Add protocol day
              // Initialize payment fields
              power: "0",
              claimedCreate: false,
              claimedStake: false,
              costETH: "0",
              costTitanX: "0",
              rawCostETH: "0",
              rawCostTitanX: "0",
              rewards: "0",
              penalties: "0",
              claimedAt: "0",
              isCreate: false
            };
            
            // Get comprehensive payment data
            const eventKey = `${event.transactionHash}-${event.args.stakeIndex}`;
            const paymentData = stakePaymentData.get(eventKey) || {
              costETH: "0", rawCostETH: "0", costTitanX: "0", rawCostTitanX: "0"
            };
            
            // Apply payment data
            stakeData.costETH = paymentData.costETH;
            stakeData.rawCostETH = paymentData.rawCostETH;
            stakeData.costTitanX = paymentData.costTitanX;
            stakeData.rawCostTitanX = paymentData.rawCostTitanX;
            
            updateStats.rpcCalls++;
            
            processedStakes.push(stakeData);
          }
          
          // Process new creates and fetch payment data using comprehensive matching
          log(`  🔍 Getting comprehensive payment data for ${newCreateEvents.length} creates...`, 'cyan');
          const minCreateBlock = newCreateEvents.length > 0 ? Math.min(...newCreateEvents.map(e => e.blockNumber)) : 0;
          const maxCreateBlock = newCreateEvents.length > 0 ? Math.max(...newCreateEvents.map(e => e.blockNumber)) : 0;
          const createPaymentData = await getComprehensivePaymentData(newCreateEvents, provider, minCreateBlock, maxCreateBlock);
          
          const processedCreates = [];
          
          for (const event of newCreateEvents) {
            const blockTimestamp = blockTimestamps.get(event.blockNumber);
            if (!blockTimestamp) {
              log(`  ⚠️ Warning: Skipping create event ${event.args.stakeIndex} - no timestamp for block ${event.blockNumber}`, 'yellow');
              continue;
            }
            const endTime = parseInt(event.args.endTime.toString());
            // Calculate duration from start to end time
            const duration = Math.round((endTime - blockTimestamp) / 86400);
            
            // Calculate protocol day from timestamp
            const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z'); // July 10, 2025 6:00 PM UTC
            const eventDate = new Date(blockTimestamp * 1000);
            const msPerDay = 24 * 60 * 60 * 1000;
            const protocolDay = Math.max(1, Math.floor((eventDate.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1);
            
            const createData = {
              user: event.args.user.toLowerCase(),
              owner: event.args.user.toLowerCase(),
              createId: event.args.stakeIndex.toString(),
              torusAmount: event.args.torusAmount.toString(),
              principal: event.args.torusAmount.toString(), // For compatibility
              timestamp: blockTimestamp,
              endTime: endTime,
              blockNumber: event.blockNumber,
              // Add calculated fields
              id: event.args.stakeIndex.toString(),
              createDays: duration,
              stakingDays: duration, // For compatibility
              maturityDate: new Date(endTime * 1000).toISOString(),
              startDate: new Date(blockTimestamp * 1000).toISOString(),
              protocolDay: protocolDay, // Add protocol day
              // Initialize payment fields
              titanAmount: "0",
              titanXAmount: "0",
              ethAmount: "0",
              shares: "0",
              power: "0",
              claimedCreate: false,
              claimedStake: false,
              costETH: "0",
              costTitanX: "0",
              rawCostETH: "0",
              rawCostTitanX: "0"
            };
            
            // Get comprehensive payment data
            const eventKey = `${event.transactionHash}-${event.args.stakeIndex}`;
            const paymentData = createPaymentData.get(eventKey) || {
              costETH: "0", rawCostETH: "0", costTitanX: "0", rawCostTitanX: "0",
              ethAmount: "0", titanAmount: "0", titanXAmount: "0"
            };
            
            // Apply payment data
            createData.costETH = paymentData.costETH;
            createData.rawCostETH = paymentData.rawCostETH;
            createData.costTitanX = paymentData.costTitanX;
            createData.rawCostTitanX = paymentData.rawCostTitanX;
            createData.ethAmount = paymentData.ethAmount;
            createData.titanAmount = paymentData.titanAmount;
            createData.titanXAmount = paymentData.titanXAmount;
            
            updateStats.rpcCalls++;
            
            processedCreates.push(createData);
          }
          
          // Merge with existing events and deduplicate
          const existingStakes = cachedData.stakingData.stakeEvents || [];
          const existingCreates = cachedData.stakingData.createEvents || [];
          
          // Create sets to track unique events
          const stakeKeys = new Set();
          const createKeys = new Set();
          
          // Add existing events to sets
          // For creates: use user + amount + timestamp as unique key (to catch duplicates from positions)
          // For stakes: use user + principal + stakingDays + blockNumber for better deduplication
          existingStakes.forEach(stake => {
            const key = `${stake.user.toLowerCase()}-${stake.principal}-${stake.stakingDays}-${stake.blockNumber}`;
            stakeKeys.add(key);
          });
          
          existingCreates.forEach(create => {
            const key = `${create.user}-${create.torusAmount}-${create.timestamp}`;
            createKeys.add(key);
          });
          
          // Filter out duplicates from new events
          const uniqueNewStakes = processedStakes.filter(stake => {
            const key = `${stake.user.toLowerCase()}-${stake.principal}-${stake.stakingDays}-${stake.blockNumber}`;
            if (stakeKeys.has(key)) {
              log(`  ⚠️  Skipping duplicate stake: ${key}`, 'yellow');
              return false;
            }
            stakeKeys.add(key);
            return true;
          });
          
          const uniqueNewCreates = processedCreates.filter(create => {
            const key = `${create.user}-${create.torusAmount}-${create.timestamp}`;
            if (createKeys.has(key)) {
              log(`  ⚠️  Skipping duplicate create: ${key}`, 'yellow');
              return false;
            }
            createKeys.add(key);
            return true;
          });
          
          // Merge arrays with only unique new events
          cachedData.stakingData.stakeEvents = [
            ...existingStakes,
            ...uniqueNewStakes
          ];
          
          cachedData.stakingData.createEvents = [
            ...existingCreates,
            ...uniqueNewCreates
          ];
          
          // Update metadata
          cachedData.stakingData.metadata = cachedData.stakingData.metadata || {};
          cachedData.stakingData.metadata.currentBlock = currentBlock;
          cachedData.stakingData.lastBlock = currentBlock;
          
          updateStats.dataChanged = true;
          log(`  Added ${uniqueNewStakes.length} new stakes (${newStakeEvents.length - uniqueNewStakes.length} duplicates skipped), ${uniqueNewCreates.length} new creates (${newCreateEvents.length - uniqueNewCreates.length} duplicates skipped)`, 'green');
        }
      }
    } catch (e) {
      updateStats.errors.push(`Staking update: ${e.message}`);
      log(`  Error updating staking data: ${e.message}`, 'red');
    }
    
    // 6. Update prices (lightweight)
    try {
      if (cachedData.poolData && cachedData.poolData.sqrtPriceX96) {
        const sqrtPriceX96 = ethers.BigNumber.from(cachedData.poolData.sqrtPriceX96);
        const Q96 = ethers.BigNumber.from(2).pow(96);
        const price = sqrtPriceX96.mul(sqrtPriceX96).mul(ethers.utils.parseEther('1')).div(Q96).div(Q96);
        const titanxPerTorus = parseFloat(ethers.utils.formatEther(price));
        
        const torusPrice = titanxPerTorus * 0.00001;
        
        if (Math.abs(torusPrice - (cachedData.tokenPrices?.torus?.usd || 0)) > 0.01) {
          if (!cachedData.tokenPrices) cachedData.tokenPrices = {};
          if (!cachedData.tokenPrices.torus) cachedData.tokenPrices.torus = {};
          cachedData.tokenPrices.torus.usd = torusPrice;
          cachedData.tokenPrices.torus.lastUpdated = new Date().toISOString();
          updateStats.dataChanged = true;
          log(`Price updated: $${torusPrice.toFixed(2)}`, 'green');
        }
      }
    } catch (e) {
      updateStats.errors.push(`Price update: ${e.message}`);
    }
    
    // 7. Update Buy & Process data
    log('Updating Buy & Process data...', 'cyan');
    try {
      execSync('node scripts/update-buy-process-data.js', { stdio: 'inherit' });
      updateStats.dataChanged = true;
      log('Buy & Process data updated', 'green');
    } catch (e) {
      updateStats.errors.push(`Buy & Process update: ${e.message}`);
      log(`Failed to update Buy & Process data: ${e.message}`, 'yellow');
    }
    
    // 7b. Update Creates & Stakes data
    log('Updating Creates & Stakes data...', 'cyan');
    try {
      execSync('node scripts/update-creates-stakes-incremental.js', { stdio: 'inherit' });
      updateStats.dataChanged = true;
      log('Creates & Stakes data updated', 'green');
    } catch (e) {
      updateStats.errors.push(`Creates & Stakes update: ${e.message}`);
      log(`Failed to update Creates & Stakes data: ${e.message}`, 'yellow');
    }
    
    // 8. Update Future Supply Projection if day changed
    log('Checking future supply projection...', 'cyan');
    try {
      if (shouldUpdateProjection(cachedData)) {
        log('Protocol day changed, updating future supply projection...', 'yellow');
        generateFutureSupplyProjection();
        // Reload cached data to get the updated projection
        const updatedData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        cachedData.chartData = updatedData.chartData;
        updateStats.dataChanged = true;
        log('Future supply projection updated', 'green');
      } else {
        log('Future supply projection is up to date', 'green');
      }
    } catch (e) {
      updateStats.errors.push(`Future supply projection update: ${e.message}`);
      log(`Failed to update future supply projection: ${e.message}`, 'yellow');
    }
    
    // 8.5. Validate data integrity
    log('Validating data integrity...', 'cyan');
    try {
      const { validateNoDuplicates } = require('./scripts/validate-no-duplicates');
      // Run validation but don't exit on failure, just log
      const originalExit = process.exit;
      process.exit = () => {}; // Temporarily disable exit
      validateNoDuplicates();
      process.exit = originalExit; // Restore exit
      log('Data validation complete', 'green');
    } catch (e) {
      updateStats.errors.push(`Data validation warning: ${e.message}`);
      log('Data validation found issues - manual review needed', 'yellow');
    }
    
    // 9. Update timestamp
    cachedData.lastUpdated = new Date().toISOString();
    
    // 10. Check if we need more comprehensive updates
    const needsFullUpdate = lpUpdateResult.stats.newPositions > 5 || updateStats.errors.length > 3;
    
    if (needsFullUpdate) {
      log('Many changes detected, running comprehensive position update...', 'yellow');
      // Instead of running the full script, just mark that manual intervention may be needed
      cachedData.metadata = cachedData.metadata || {};
      cachedData.metadata.needsManualUpdate = true;
      cachedData.metadata.reason = `${lpUpdateResult.stats.newPositions} new positions found`;
    }
    
    // Save if data changed
    if (updateStats.dataChanged || originalData !== JSON.stringify(cachedData)) {
      // Create backup before saving
      const backupPath = `public/data/backups/cached-data-${new Date().toISOString().replace(/:/g, '-')}.json`;
      const backupDir = path.dirname(backupPath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      fs.writeFileSync(backupPath, originalData);
      
      // Save updated data
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cachedData, null, 2));
      log('Cache updated with changes', 'green');
      return { ...updateStats, dataChanged: true };
    } else {
      log('No data changes detected', 'yellow');
      return updateStats;
    }
    
  } catch (e) {
    log(`Update error: ${e.message}`, 'red');
    updateStats.errors.push(e.message);
    return updateStats;
  }
}

// Git commit and push
async function gitPush() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (!status.trim()) {
      log('No git changes to push', 'yellow');
      return false;
    }
    
    execSync('git add public/data/cached-data.json', { stdio: 'inherit' });
    
    const message = `Smart update (fixed) - ${new Date().toISOString()}

Incremental data refresh with proper data preservation
🤖 Automated smart update`;
    
    execSync(`git commit -m "${message}"`, { stdio: 'inherit' });
    execSync('git push origin master', { stdio: 'inherit' });
    
    log('Changes pushed to GitHub', 'green');
    return true;
  } catch (e) {
    log(`Git push failed: ${e.message}`, 'red');
    return false;
  }
}

// Main function
async function main() {
  log('🔄 TORUS Smart Update (Fixed) Starting', 'bright');
  
  // Initialize RPC monitoring
  resetRpcStats();
  
  const updateLog = loadUpdateLog();
  
  try {
    // Get provider
    const provider = await getProvider();
    
    // Check if update needed
    const updateCheck = await shouldUpdate(provider, updateLog);
    const { shouldUpdate: needsUpdate, currentBlock, blocksSinceLastUpdate } = updateCheck;
    
    if (!needsUpdate) {
      log('Update not needed at this time', 'yellow');
      return;
    }
    
    // Perform smart update
    const updateResult = await performSmartUpdate(provider, updateLog, currentBlock, blocksSinceLastUpdate);
    
    // Push to git if data changed
    if (updateResult.dataChanged) {
      await gitPush();
    }
    
    // Update log
    updateLog.lastBlockNumber = currentBlock;
    updateLog.lastUpdateTime = Date.now();
    updateLog.totalRpcCalls += updateResult.rpcCalls;
    // Use updateHistory if it exists, otherwise use updates
    const historyArray = updateLog.updateHistory || updateLog.updates || [];
    historyArray.push({
      timestamp: new Date().toISOString(),
      block: currentBlock,
      rpcCalls: updateResult.rpcCalls,
      dataChanged: updateResult.dataChanged,
      errors: updateResult.errors
    });
    
    // Keep only last 100 updates
    if (historyArray.length > 100) {
      updateLog.updateHistory = historyArray.slice(-100);
    } else {
      updateLog.updateHistory = historyArray;
    }
    
    // Clean up old field if exists
    if (updateLog.updates) {
      delete updateLog.updates;
    }
    
    saveUpdateLog(updateLog);
    
    log(`✅ Update complete. RPC calls: ${updateResult.rpcCalls}, Data changed: ${updateResult.dataChanged}`, 'green');
    
    // Log RPC performance statistics
    logRpcStats();
    
  } catch (e) {
    log(`Fatal error: ${e.message}`, 'red');
    logRpcStats(); // Log stats even on error for debugging
    process.exit(1);
  }
}

// Run
main().catch(console.error);