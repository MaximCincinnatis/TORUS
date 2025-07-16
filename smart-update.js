#!/usr/bin/env node

/**
 * TORUS Dashboard - Smart Update Script
 * 
 * Optimized for frequent updates (every 30 minutes)
 * Minimizes RPC calls by only updating what's changed
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const UPDATE_LOG_FILE = 'update-log.json';
const CACHE_FILE = './public/data/cached-data.json';
const MAX_RPC_CALLS_PER_UPDATE = 100; // Safety limit

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
    
    // 1. Update only essential data
    log('Updating essential data only...', 'cyan');
    
    // Update pool data (1 RPC call)
    try {
      const poolAddress = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
      const poolABI = ['function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)'];
      const pool = new ethers.Contract(poolAddress, poolABI, provider);
      const slot0 = await pool.slot0();
      updateStats.rpcCalls++;
      
      // Update pool data if changed
      if (cachedData.poolData && cachedData.poolData.currentTick !== slot0.tick) {
        cachedData.poolData.currentTick = slot0.tick;
        cachedData.poolData.sqrtPriceX96 = slot0.sqrtPriceX96.toString();
        updateStats.dataChanged = true;
        log('Pool data updated', 'green');
      }
    } catch (e) {
      updateStats.errors.push(`Pool update: ${e.message}`);
    }
    
    // 2. Check for new LP positions (only if many blocks passed)
    if (blocksSinceLastUpdate > 100) {
      log('Checking for new LP positions...', 'cyan');
      // Simplified LP check - only look for new Mint events
      try {
        const poolAddress = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
        const poolABI = ['event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)'];
        const pool = new ethers.Contract(poolAddress, poolABI, provider);
        
        const mintFilter = pool.filters.Mint();
        const mintEvents = await pool.queryFilter(mintFilter, currentBlock - 100, currentBlock);
        updateStats.rpcCalls++;
        
        if (mintEvents.length > 0) {
          log(`Found ${mintEvents.length} new Mint events`, 'yellow');
          updateStats.dataChanged = true;
          // Mark for full update
          return { ...updateStats, needsFullUpdate: true };
        }
      } catch (e) {
        updateStats.errors.push(`LP check: ${e.message}`);
      }
    }
    
    // 3. Update prices (lightweight)
    try {
      // Calculate current TORUS price based on pool ratio
      if (cachedData.poolData && cachedData.poolData.sqrtPriceX96) {
        const sqrtPriceX96 = ethers.BigNumber.from(cachedData.poolData.sqrtPriceX96);
        const Q96 = ethers.BigNumber.from(2).pow(96);
        const price = sqrtPriceX96.mul(sqrtPriceX96).mul(ethers.utils.parseEther('1')).div(Q96).div(Q96);
        const titanxPerTorus = parseFloat(ethers.utils.formatEther(price));
        
        // Assuming TitanX = $0.00001 for rough calculation
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
    
    // Save if data changed
    if (updateStats.dataChanged || originalData !== JSON.stringify(cachedData)) {
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

// Run full update if needed
async function runFullUpdate() {
  log('Running full update...', 'bright');
  try {
    execSync('node scripts/data-updates/update-all-dashboard-data.js', { 
      stdio: 'inherit',
      timeout: 300000 // 5 minute timeout
    });
    
    // Also run LP fixes
    if (fs.existsSync('fetch-all-lp-positions.js')) {
      execSync('node fetch-all-lp-positions.js && node fix-lp-positions-simple.js', {
        stdio: 'inherit',
        timeout: 120000
      });
    }
    
    return true;
  } catch (e) {
    log(`Full update failed: ${e.message}`, 'red');
    return false;
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
    
    const message = `Smart update - ${new Date().toISOString()}

Incremental data refresh
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
  log('🔄 TORUS Smart Update Starting', 'bright');
  
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
    
    // If needs full update or too many errors
    if (updateResult.needsFullUpdate || updateResult.errors.length > 2) {
      log('Full update required', 'yellow');
      const fullUpdateSuccess = await runFullUpdate();
      if (fullUpdateSuccess) {
        updateResult.dataChanged = true;
      }
    }
    
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