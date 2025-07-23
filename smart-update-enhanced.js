#!/usr/bin/env node

// Smart update script with enhanced LP position handling
// This version uses incremental LP updates instead of triggering full rebuilds

const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const runEnhancedLPUpdate = require('./scripts/enhanced-incremental-lp-update');

// Configuration
const RPC_URL = 'https://eth.llamarpc.com';
const CACHE_FILE = path.join(__dirname, 'data', 'cached-data.json');
const STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
const CREATE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';

// Logging with colors
function log(message, color = 'white') {
  const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bright: '\x1b[1m'
  };
  console.log(`${colors[color] || ''}[${new Date().toISOString()}] ${message}\x1b[0m`);
}

// Get block range
async function getBlockRange(provider, cachedData) {
  const currentBlock = await provider.getBlockNumber();
  const lastBlock = cachedData.lastBlock || currentBlock - 1000;
  return { currentBlock, lastBlock, blocksSinceLastUpdate: currentBlock - lastBlock };
}

// Check for new events
async function checkForNewEvents(provider, contract, eventName, fromBlock, toBlock) {
  try {
    const filter = contract.filters[eventName]();
    const events = await contract.queryFilter(filter, fromBlock, toBlock);
    return events;
  } catch (error) {
    console.error(`Error checking ${eventName} events:`, error.message);
    return [];
  }
}

// Smart update function with enhanced LP handling
async function performSmartUpdate() {
  log('Starting enhanced smart update...', 'bright');
  
  const updateStats = {
    timestamp: new Date().toISOString(),
    dataChanged: false,
    rpcCalls: 0,
    errors: [],
    lpUpdateRequired: false,
    needsFullUpdate: false
  };

  try {
    // Load cached data
    let cachedData = {};
    if (fs.existsSync(CACHE_FILE)) {
      cachedData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    }
    const originalData = JSON.stringify(cachedData);

    // Initialize provider
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const { currentBlock, lastBlock, blocksSinceLastUpdate } = await getBlockRange(provider, cachedData);
    updateStats.rpcCalls++;

    log(`Blocks since last update: ${blocksSinceLastUpdate} (${lastBlock} → ${currentBlock})`, 'cyan');

    // 1. Check stakes
    if (blocksSinceLastUpdate > 0) {
      try {
        const stakeABI = ['event Staked(address indexed user, uint256 amount, uint128 indexed id, uint128 shares, uint16 indexed term, uint256 timestamp)'];
        const stakeContract = new ethers.Contract(STAKE_CONTRACT, stakeABI, provider);
        
        const stakeEvents = await checkForNewEvents(provider, stakeContract, 'Staked', lastBlock + 1, currentBlock);
        updateStats.rpcCalls++;
        
        if (stakeEvents.length > 0) {
          log(`Found ${stakeEvents.length} new stake events`, 'green');
          updateStats.dataChanged = true;
          
          // Trigger full update only for large number of stakes
          if (stakeEvents.length > 50) {
            log(`Large number of stakes (${stakeEvents.length}), considering full update`, 'yellow');
            updateStats.needsFullUpdate = true;
          }
        }
      } catch (e) {
        updateStats.errors.push(`Stake check: ${e.message}`);
      }
    }

    // 2. Check creates  
    if (blocksSinceLastUpdate > 0) {
      try {
        const createABI = ['event UserMintInfo(address indexed user, uint256 indexed mintInfo, address indexed userMintAddress, uint256 timestamp)'];
        const createContract = new ethers.Contract(CREATE_CONTRACT, createABI, provider);
        
        const createEvents = await checkForNewEvents(provider, createContract, 'UserMintInfo', lastBlock + 1, currentBlock);
        updateStats.rpcCalls++;
        
        if (createEvents.length > 0) {
          log(`Found ${createEvents.length} new create events`, 'green');
          updateStats.dataChanged = true;
          
          // Trigger full update only for large number of creates
          if (createEvents.length > 50) {
            log(`Large number of creates (${createEvents.length}), considering full update`, 'yellow');
            updateStats.needsFullUpdate = true;
          }
        }
      } catch (e) {
        updateStats.errors.push(`Create check: ${e.message}`);
      }
    }

    // 3. Check LP positions with enhanced handling
    if (blocksSinceLastUpdate > 100) {
      try {
        const poolAddress = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
        const poolABI = ['event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)'];
        const pool = new ethers.Contract(poolAddress, poolABI, provider);
        
        const mintEvents = await checkForNewEvents(provider, pool, 'Mint', currentBlock - 100, currentBlock);
        updateStats.rpcCalls++;
        
        if (mintEvents.length > 0) {
          log(`Found ${mintEvents.length} new Mint events`, 'yellow');
          updateStats.dataChanged = true;
          updateStats.lpUpdateRequired = true;
          
          // NO LONGER TRIGGER FULL UPDATE - Use enhanced LP updater instead
          log(`Will use enhanced LP updater for ${mintEvents.length} new positions`, 'cyan');
        }
      } catch (e) {
        updateStats.errors.push(`LP check: ${e.message}`);
      }
    }

    // 4. Update prices (lightweight)
    try {
      if (cachedData.poolData && cachedData.poolData.sqrtPriceX96) {
        const sqrtPriceX96 = ethers.BigNumber.from(cachedData.poolData.sqrtPriceX96);
        const Q96 = ethers.BigNumber.from(2).pow(96);
        const price = sqrtPriceX96.mul(sqrtPriceX96).mul(ethers.utils.parseEther('1')).div(Q96).div(Q96);
        const titanxPerTorus = parseFloat(ethers.utils.formatEther(price));
        
        const torusPrice = titanxPerTorus * 0.00001; // Assuming TitanX = $0.00001
        
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

    // 5. Handle LP updates with enhanced updater
    if (updateStats.lpUpdateRequired) {
      log('Running enhanced LP position update...', 'blue');
      try {
        const lpResult = await runEnhancedLPUpdate();
        if (lpResult.success) {
          log('✅ Enhanced LP update completed successfully', 'green');
          updateStats.dataChanged = true;
          // Reload cached data after LP update
          cachedData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        } else {
          log('❌ Enhanced LP update failed', 'red');
          updateStats.errors.push('LP update failed');
        }
      } catch (e) {
        log(`LP update error: ${e.message}`, 'red');
        updateStats.errors.push(`LP update: ${e.message}`);
      }
    }

    // 6. Update block number and timestamp
    cachedData.lastBlock = currentBlock;
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

// Run full update if needed (only for stake/create events)
async function runFullUpdate() {
  log('Running full update for stake/create events...', 'bright');
  try {
    execSync('node scripts/data-updates/update-all-dashboard-data.js', { 
      stdio: 'inherit',
      timeout: 300000 // 5 minute timeout
    });
    
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
      log('No changes to commit', 'yellow');
      return false;
    }

    // Commit changes
    execSync('git add data/cached-data.json');
    const commitMessage = `Auto-update: ${new Date().toISOString().split('T')[0]}`;
    execSync(`git commit -m "${commitMessage}"`);
    
    // Push changes
    execSync('git push');
    log('Changes pushed to git', 'green');
    return true;
  } catch (e) {
    log(`Git operation failed: ${e.message}`, 'red');
    return false;
  }
}

// Main execution
async function main() {
  log('='.repeat(50), 'bright');
  log('Enhanced Smart Update Script', 'bright');
  log('='.repeat(50), 'bright');

  try {
    // Perform smart update
    const updateResult = await performSmartUpdate();
    
    // Check if full update is needed (only for large stake/create changes)
    if (updateResult.needsFullUpdate || updateResult.errors.length > 2) {
      log('Full update required for stake/create events', 'yellow');
      const fullUpdateSuccess = await runFullUpdate();
      
      if (!fullUpdateSuccess) {
        log('Full update failed, but continuing...', 'red');
      }
    }

    // Push to git if changes were made
    if (updateResult.dataChanged) {
      await gitPush();
    }

    // Summary
    log('='.repeat(50), 'bright');
    log('Update Summary:', 'bright');
    log(`  Data changed: ${updateResult.dataChanged}`, updateResult.dataChanged ? 'green' : 'yellow');
    log(`  RPC calls: ${updateResult.rpcCalls}`, 'cyan');
    log(`  Errors: ${updateResult.errors.length}`, updateResult.errors.length > 0 ? 'red' : 'green');
    
    if (updateResult.errors.length > 0) {
      log('  Error details:', 'red');
      updateResult.errors.forEach(e => log(`    - ${e}`, 'red'));
    }

    log('='.repeat(50), 'bright');

  } catch (error) {
    log(`Fatal error: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    log(`Unexpected error: ${error}`, 'red');
    process.exit(1);
  });
}

module.exports = { performSmartUpdate, log };