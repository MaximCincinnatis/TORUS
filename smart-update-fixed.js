#!/usr/bin/env node

/**
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
    updates: []
  };
}

// Save update history
function saveUpdateLog(logData) {
  fs.writeFileSync(UPDATE_LOG_FILE, JSON.stringify(logData, null, 2));
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
    
    // Skip if less than 10 blocks (about 2 minutes)
    if (blocksSinceLastUpdate < 10) {
      log('Too few blocks since last update, skipping', 'yellow');
      return { shouldUpdate: false, currentBlock };
    }
    
    return { shouldUpdate: true, currentBlock, blocksSinceLastUpdate };
  } catch (e) {
    log(`Error checking blocks: ${e.message}`, 'red');
    return { shouldUpdate: false };
  }
}

// Merge LP positions preserving existing ones
function mergeLPPositions(existingPositions, newPositions) {
  // Create a map of existing positions by tokenId
  const positionMap = new Map();
  
  // Add all existing positions
  existingPositions.forEach(pos => {
    positionMap.set(pos.tokenId, pos);
  });
  
  // Update or add new positions
  newPositions.forEach(newPos => {
    const existingPos = positionMap.get(newPos.tokenId);
    
    if (existingPos) {
      // Update existing position with new data, preserving any custom fields
      positionMap.set(newPos.tokenId, {
        ...existingPos,
        ...newPos,
        // Preserve any manual overrides or custom fields
        manualData: existingPos.manualData,
        customNotes: existingPos.customNotes
      });
    } else {
      // Add new position
      positionMap.set(newPos.tokenId, newPos);
    }
  });
  
  // Convert back to array
  return Array.from(positionMap.values());
}

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
        
        // Always include the position (updated or not) to preserve it
        updatedPositions.push({
          ...position,
          liquidity: currentPosition.liquidity.toString(),
          owner: owner,
          lastChecked: new Date().toISOString()
        });
        
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
                
                // Verify this is TORUS pool
                if (position.token0.toLowerCase() === CONTRACTS.TORUS.toLowerCase() &&
                    position.token1.toLowerCase() === CONTRACTS.TITANX.toLowerCase() &&
                    position.liquidity.gt(0)) {
                  
                  // Add simplified position data with default values
                  updatedPositions.push({
                    tokenId: tokenId,
                    owner: owner,
                    liquidity: position.liquidity.toString(),
                    tickLower: position.tickLower,
                    tickUpper: position.tickUpper,
                    fee: position.fee,
                    amount0: 0,
                    amount1: 0,
                    inRange: false,
                    claimableTorus: 0,
                    claimableTitanX: 0,
                    estimatedAPR: "0.00",
                    priceRange: "Calculating...",
                    lastChecked: new Date().toISOString(),
                    isNew: true
                  });
                  
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
    
    // 2. Update LP positions incrementally
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
    
    // 3. Update staking data incrementally
    log('Checking for new stake/create events...', 'cyan');
    
    try {
      // Get last block from staking data
      const lastStakeBlock = cachedData.stakingData?.metadata?.currentBlock || 
                            cachedData.stakingData?.lastBlock || 
                            22890272; // Fallback to deployment block
      
      // Only update if we have enough new blocks
      if (currentBlock - lastStakeBlock > 50) {
        const CONTRACTS = {
          TORUS_CREATE_STAKE: '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507'
        };
        
        const contractABI = [
          'event Staked(address indexed user, uint256 indexed id, uint256 amount, uint256 shares, uint16 indexed duration, uint256 timestamp)',
          'event Created(address indexed user, uint256 indexed createId, uint256 amount, uint256 shares, uint16 indexed duration, uint256 rewardDay, uint256 timestamp, address referrer)'
        ];
        
        const contract = new ethers.Contract(CONTRACTS.TORUS_CREATE_STAKE, contractABI, provider);
        
        // Fetch in chunks if needed
        const MAX_BLOCK_RANGE = 9999;
        let newStakeEvents = [];
        let newCreateEvents = [];
        
        for (let fromBlock = lastStakeBlock + 1; fromBlock <= currentBlock; fromBlock += MAX_BLOCK_RANGE) {
          const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, currentBlock);
          
          try {
            const [stakeEvents, createEvents] = await Promise.all([
              contract.queryFilter(contract.filters.Staked(), fromBlock, toBlock),
              contract.queryFilter(contract.filters.Created(), fromBlock, toBlock)
            ]);
            
            newStakeEvents.push(...stakeEvents);
            newCreateEvents.push(...createEvents);
            updateStats.rpcCalls += 2;
          } catch (e) {
            log(`  Error fetching events ${fromBlock}-${toBlock}: ${e.message}`, 'yellow');
          }
        }
        
        if (newStakeEvents.length > 0 || newCreateEvents.length > 0) {
          // Process and merge new events
          const processedStakes = newStakeEvents.map(event => ({
            user: event.args.user,
            id: event.args.id.toString(),
            principal: ethers.utils.formatEther(event.args.amount),
            shares: event.args.shares.toString(),
            duration: event.args.duration.toString(),
            timestamp: event.args.timestamp.toString(),
            blockNumber: event.blockNumber,
            // Add placeholders for missing fields
            stakingDays: parseInt(event.args.duration.toString()),
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
          }));
          
          const processedCreates = newCreateEvents.map(event => ({
            user: event.args.user,
            createId: event.args.createId.toString(),
            principal: ethers.utils.formatEther(event.args.amount),
            shares: event.args.shares.toString(),
            duration: event.args.duration.toString(),
            rewardDay: event.args.rewardDay.toString(),
            timestamp: event.args.timestamp.toString(),
            referrer: event.args.referrer,
            blockNumber: event.blockNumber,
            // Add placeholders for missing fields
            id: event.args.createId.toString(),
            stakingDays: parseInt(event.args.duration.toString()),
            power: "0",
            claimedCreate: false,
            claimedStake: false,
            costETH: "0",
            costTitanX: "0",
            rawCostETH: "0",
            rawCostTitanX: "0"
          }));
          
          // Merge with existing events
          cachedData.stakingData.stakeEvents = [
            ...(cachedData.stakingData.stakeEvents || []),
            ...processedStakes
          ];
          
          cachedData.stakingData.createEvents = [
            ...(cachedData.stakingData.createEvents || []),
            ...processedCreates
          ];
          
          // Update metadata
          cachedData.stakingData.metadata = cachedData.stakingData.metadata || {};
          cachedData.stakingData.metadata.currentBlock = currentBlock;
          cachedData.stakingData.lastBlock = currentBlock;
          
          updateStats.dataChanged = true;
          log(`  Added ${newStakeEvents.length} new stakes, ${newCreateEvents.length} new creates`, 'green');
        }
      }
    } catch (e) {
      updateStats.errors.push(`Staking update: ${e.message}`);
      log(`  Error updating staking data: ${e.message}`, 'red');
    }
    
    // 4. Update prices (lightweight)
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
    
    // 4. Update timestamp
    cachedData.lastUpdated = new Date().toISOString();
    
    // 5. Check if we need more comprehensive updates
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
    updateLog.updates.push({
      timestamp: new Date().toISOString(),
      block: currentBlock,
      rpcCalls: updateResult.rpcCalls,
      dataChanged: updateResult.dataChanged,
      errors: updateResult.errors
    });
    
    // Keep only last 100 updates
    if (updateLog.updates.length > 100) {
      updateLog.updates = updateLog.updates.slice(-100);
    }
    
    saveUpdateLog(updateLog);
    
    log(`✅ Update complete. RPC calls: ${updateResult.rpcCalls}, Data changed: ${updateResult.dataChanged}`, 'green');
    
  } catch (e) {
    log(`Fatal error: ${e.message}`, 'red');
    process.exit(1);
  }
}

// Run
main().catch(console.error);