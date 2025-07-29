#!/usr/bin/env node

/**
 * Corrupted Data Cleanup Script
 * 
 * This script removes corrupted entries that have wrong timestamps
 * and rebuilds them with accurate blockchain data using the same
 * logic as the working smart-update-fixed.js script.
 */

const { ethers } = require('ethers');
const fs = require('fs');

// Setup - use the same RPC as the working scripts
const RPC_URL = process.env.RPC_URL || 'https://ethereum.blockpi.network/v1/rpc/public';
const CACHE_FILE = './public/data/cached-data.json';
const BACKUP_FILE = `./public/data/cached-data-backup-before-cleanup-${Date.now()}.json`;

// Contract setup
const STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
const CONTRACT_ABI = [
  'event Created(address indexed user, uint256 stakeIndex, uint256 torusAmount, uint256 endTime)',
  'function getCurrentDayIndex() view returns (uint24)'
];

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

function identifyCorruptedCreates(data) {
  const corrupted = [];
  const currentTime = Math.floor(Date.now() / 1000);
  
  if (data.stakingData && data.stakingData.createEvents) {
    data.stakingData.createEvents.forEach((create, index) => {
      const timestamp = parseInt(create.timestamp);
      
      // If timestamp is very recent (within last 48 hours), it's likely corrupted
      // because creates happened days/weeks ago
      if (currentTime - timestamp < 172800) { // 48 hours
        corrupted.push({
          index,
          id: create.id,
          blockNumber: create.blockNumber,
          corruptedTimestamp: timestamp,
          endTime: create.endTime
        });
      }
    });
  }
  
  return corrupted;
}

async function rebuildCorruptedCreates(data, corrupted) {
  if (corrupted.length === 0) {
    log('No corrupted creates found!', 'green');
    return 0;
  }
  
  log(`Found ${corrupted.length} corrupted creates. Rebuilding with accurate blockchain data...`, 'yellow');
  
  // Create contract instance
  const contract = new ethers.Contract(STAKE_CONTRACT, CONTRACT_ABI, provider);
  
  // Get block range for corrupted entries
  const blockNumbers = corrupted.map(c => c.blockNumber);
  const minBlock = Math.min(...blockNumbers);
  const maxBlock = Math.max(...blockNumbers);
  
  log(`Fetching Create events from blocks ${minBlock} to ${maxBlock}...`, 'cyan');
  
  try {
    // Fetch all Create events in the range
    const createEvents = await contract.queryFilter(
      contract.filters.Created(),
      minBlock,
      maxBlock
    );
    
    log(`Found ${createEvents.length} Create events in blockchain`, 'cyan');
    
    // Fetch block timestamps for these events efficiently
    const uniqueBlocks = [...new Set(createEvents.map(e => e.blockNumber))];
    const blockTimestamps = new Map();
    
    log(`Fetching timestamps for ${uniqueBlocks.length} unique blocks...`, 'cyan');
    
    // Batch fetch block data (limit concurrent requests)
    const batchSize = 5;
    for (let i = 0; i < uniqueBlocks.length; i += batchSize) {
      const batch = uniqueBlocks.slice(i, i + batchSize);
      const promises = batch.map(async (blockNumber) => {
        try {
          const block = await provider.getBlock(blockNumber);
          if (block) {
            blockTimestamps.set(blockNumber, block.timestamp);
          }
        } catch (error) {
          log(`Warning: Could not fetch block ${blockNumber}: ${error.message}`, 'yellow');
        }
      });
      
      await Promise.all(promises);
      log(`  Processed ${Math.min(i + batchSize, uniqueBlocks.length)}/${uniqueBlocks.length} blocks`, 'cyan');
    }
    
    // Remove corrupted entries from the data
    const indicesToRemove = corrupted.map(c => c.index).sort((a, b) => b - a); // Sort descending
    for (const index of indicesToRemove) {
      data.stakingData.createEvents.splice(index, 1);
    }
    
    log(`Removed ${corrupted.length} corrupted entries`, 'yellow');
    
    // Rebuild accurate entries from blockchain data
    let rebuilt = 0;
    
    for (const event of createEvents) {
      // Check if this event was one of the corrupted ones
      const wasCorrupted = corrupted.some(c => 
        c.blockNumber === event.blockNumber && 
        c.id === event.args.stakeIndex.toString()
      );
      
      if (wasCorrupted) {
        const blockTimestamp = blockTimestamps.get(event.blockNumber);
        
        if (blockTimestamp) {
          const endTime = Number(event.args.endTime);
          
          // Calculate protocol day from timestamp
          const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
          const eventDate = new Date(blockTimestamp * 1000);
          const msPerDay = 24 * 60 * 60 * 1000;
          const protocolDay = Math.max(1, Math.floor((eventDate.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1);
          
          const accurateCreateData = {
            user: event.args.user.toLowerCase(),
            owner: event.args.user.toLowerCase(),
            createId: event.args.stakeIndex.toString(),
            torusAmount: event.args.torusAmount.toString(),
            principal: event.args.torusAmount.toString(),
            timestamp: blockTimestamp,
            endTime: endTime,
            blockNumber: event.blockNumber,
            id: event.args.stakeIndex.toString(),
            createDays: Math.round((endTime - blockTimestamp) / 86400),
            stakingDays: Math.round((endTime - blockTimestamp) / 86400),
            maturityDate: new Date(endTime * 1000).toISOString(),
            startDate: new Date(blockTimestamp * 1000).toISOString(),
            protocolDay: protocolDay,
            power: "0",
            claimedCreate: false,
            claimedStake: false
          };
          
          data.stakingData.createEvents.push(accurateCreateData);
          rebuilt++;
          
          log(`  ✓ Rebuilt create ${event.args.stakeIndex}: ${new Date(blockTimestamp * 1000).toISOString()} → ${new Date(endTime * 1000).toISOString()}`, 'green');
        }
      }
    }
    
    // Sort events by timestamp to maintain order
    data.stakingData.createEvents.sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp));
    
    log(`Successfully rebuilt ${rebuilt} create entries with accurate blockchain data`, 'green');
    return rebuilt;
    
  } catch (error) {
    log(`Error rebuilding creates: ${error.message}`, 'red');
    return 0;
  }
}

async function main() {
  log('🧹 TORUS Corrupted Data Cleanup', 'cyan');
  log('=' .repeat(40), 'cyan');
  
  // Load data
  const data = await loadCachedData();
  
  // Create backup
  createBackup(data);
  
  // Identify corrupted creates
  const corrupted = identifyCorruptedCreates(data);
  
  if (corrupted.length === 0) {
    log('🎉 No corrupted data found! Cache is clean.', 'green');
    return;
  }
  
  log(`Found ${corrupted.length} corrupted create entries with recent timestamps`, 'yellow');
  
  // Show some examples
  corrupted.slice(0, 3).forEach(c => {
    log(`  Create ${c.id} at block ${c.blockNumber}: timestamp ${new Date(c.corruptedTimestamp * 1000).toISOString()}`, 'yellow');
  });
  
  // Rebuild corrupted data
  const rebuilt = await rebuildCorruptedCreates(data, corrupted);
  
  if (rebuilt > 0) {
    // Update timestamp
    data.lastUpdated = new Date().toISOString();
    
    // Save cleaned data
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
    log(`✅ Cleaned up ${rebuilt} entries and saved updated data`, 'green');
    log('🎉 All data is now accurate with blockchain timestamps!', 'green');
  } else {
    log('⚠️ No entries could be rebuilt', 'yellow');
  }
}

// Run the script
main().catch(error => {
  log(`Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});