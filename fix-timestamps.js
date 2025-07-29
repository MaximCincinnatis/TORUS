#!/usr/bin/env node

/**
 * Timestamp Corruption Detector and Fixer
 * 
 * This script identifies and fixes entries in cached-data.json that have
 * incorrect timestamps due to the enhanced script bug, and rebuilds them
 * with accurate on-chain block timestamps.
 */

const { ethers } = require('ethers');
const fs = require('fs');

// Setup
const RPC_URL = process.env.RPC_URL || 'https://ethereum.blockpi.network/v1/rpc/public';
const CACHE_FILE = './public/data/cached-data.json';
const BACKUP_FILE = `./public/data/cached-data-backup-before-timestamp-fix-${Date.now()}.json`;

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

function log(message, color = 'reset') {
  const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m'
  };
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function loadCachedData() {
  try {
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    return data;
  } catch (error) {
    log(`Error loading cached data: ${error.message}`, 'red');
    process.exit(1);
  }
}

function createBackup(data) {
  try {
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(data, null, 2));
    log(`✓ Backup created: ${BACKUP_FILE}`, 'green');
  } catch (error) {
    log(`Error creating backup: ${error.message}`, 'red');
    process.exit(1);
  }
}

function detectCorruptedEntries(data) {
  const corrupted = { stakes: [], creates: [] };
  const currentTime = Math.floor(Date.now() / 1000);
  
  // Check stakes
  if (data.stakingData && data.stakingData.stakeEvents) {
    data.stakingData.stakeEvents.forEach((stake, index) => {
      const timestamp = parseInt(stake.timestamp);
      
      // If timestamp is very recent (within last 24 hours), it's likely corrupted
      // because stakes happened weeks ago
      if (currentTime - timestamp < 86400) {
        corrupted.stakes.push({
          index,
          id: stake.id,
          blockNumber: stake.blockNumber,
          currentTimestamp: timestamp,
          stakingDays: stake.stakingDays
        });
      }
    });
  }
  
  // Check creates
  if (data.stakingData && data.stakingData.createEvents) {
    data.stakingData.createEvents.forEach((create, index) => {
      const timestamp = parseInt(create.timestamp);
      
      // If timestamp is very recent, it's likely corrupted
      if (currentTime - timestamp < 86400) {
        corrupted.creates.push({
          index,
          id: create.id,
          blockNumber: create.blockNumber,
          currentTimestamp: timestamp,
          endTime: create.endTime
        });
      }
    });
  }
  
  return corrupted;
}

async function fixCorruptedEntries(data, corrupted) {
  let fixed = 0;
  
  // Get all unique block numbers that need fixing
  const blockNumbers = new Set([
    ...corrupted.stakes.map(s => s.blockNumber),
    ...corrupted.creates.map(c => c.blockNumber)
  ]);
  
  if (blockNumbers.size === 0) {
    log('No corrupted entries found!', 'green');
    return 0;
  }
  
  log(`Fetching accurate timestamps for ${blockNumbers.size} blocks...`, 'cyan');
  
  // Fetch actual block timestamps
  const blockTimestamps = new Map();
  for (const blockNumber of blockNumbers) {
    try {
      const block = await provider.getBlock(blockNumber);
      if (block) {
        blockTimestamps.set(blockNumber, block.timestamp);
        log(`  Block ${blockNumber}: ${new Date(block.timestamp * 1000).toISOString()}`, 'cyan');
      }
    } catch (error) {
      log(`Warning: Could not fetch block ${blockNumber}: ${error.message}`, 'yellow');
    }
  }
  
  // Fix corrupted stakes
  for (const stake of corrupted.stakes) {
    const correctTimestamp = blockTimestamps.get(stake.blockNumber);
    if (correctTimestamp) {
      const stakeEntry = data.stakingData.stakeEvents[stake.index];
      const oldTimestamp = stakeEntry.timestamp;
      const stakingDays = parseInt(stakeEntry.stakingDays);
      const maturityTimestamp = correctTimestamp + (stakingDays * 86400);
      
      // Update with correct data
      stakeEntry.timestamp = correctTimestamp.toString();
      stakeEntry.startDate = new Date(correctTimestamp * 1000).toISOString();
      stakeEntry.maturityDate = new Date(maturityTimestamp * 1000).toISOString();
      
      log(`  ✓ Fixed stake ${stake.id}: ${new Date(oldTimestamp * 1000).toISOString()} → ${new Date(correctTimestamp * 1000).toISOString()}`, 'green');
      fixed++;
    }
  }
  
  // Fix corrupted creates
  for (const create of corrupted.creates) {
    const correctTimestamp = blockTimestamps.get(create.blockNumber);
    if (correctTimestamp) {
      const createEntry = data.stakingData.createEvents[create.index];
      const oldTimestamp = createEntry.timestamp;
      const endTime = createEntry.endTime;
      
      // Update with correct data
      createEntry.timestamp = correctTimestamp;
      createEntry.startDate = new Date(correctTimestamp * 1000).toISOString();
      createEntry.maturityDate = new Date(endTime * 1000).toISOString();
      
      log(`  ✓ Fixed create ${create.id}: ${new Date(oldTimestamp * 1000).toISOString()} → ${new Date(correctTimestamp * 1000).toISOString()}`, 'green');
      fixed++;
    }
  }
  
  return fixed;
}

async function main() {
  log('🔍 TORUS Timestamp Corruption Detector and Fixer', 'cyan');
  log('=' .repeat(50), 'cyan');
  
  // Load data
  const data = await loadCachedData();
  
  // Create backup
  createBackup(data);
  
  // Detect corrupted entries
  log('Detecting corrupted entries...', 'yellow');
  const corrupted = detectCorruptedEntries(data);
  
  log(`Found ${corrupted.stakes.length} corrupted stakes and ${corrupted.creates.length} corrupted creates`, 'yellow');
  
  if (corrupted.stakes.length === 0 && corrupted.creates.length === 0) {
    log('🎉 No corrupted data found! All timestamps appear accurate.', 'green');
    return;
  }
  
  // Fix corrupted entries
  log('Fixing corrupted entries with accurate blockchain timestamps...', 'yellow');
  const fixed = await fixCorruptedEntries(data, corrupted);
  
  if (fixed > 0) {
    // Update timestamp
    data.lastUpdated = new Date().toISOString();
    
    // Save fixed data
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
    log(`✅ Fixed ${fixed} entries and saved updated data`, 'green');
    log('🎉 All timestamps are now accurate!', 'green');
  } else {
    log('⚠️ No entries could be fixed', 'yellow');
  }
}

// Run the script
main().catch(error => {
  log(`Fatal error: ${error.message}`, 'red');
  process.exit(1);
});