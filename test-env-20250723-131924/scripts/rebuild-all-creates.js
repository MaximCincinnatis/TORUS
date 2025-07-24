#!/usr/bin/env node

/**
 * Rebuilds ALL create data from blockchain
 * This ensures we have complete and accurate data
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const CONTRACTS = {
  TORUS_CREATE_STAKE: '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507'
};

const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function rebuildAllCreates() {
  console.log('🔄 Rebuilding ALL creates from blockchain...\n');
  
  try {
    // Connect to Ethereum
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    
    // Contract ABI - CORRECT signature
    const contractABI = [
      'event Created(address indexed user, uint256 stakeIndex, uint256 torusAmount, uint256 endTime)',
      'function getStakePositions(address user) view returns (tuple(uint256 principal, uint256 power, uint24 stakingDays, uint256 startTime, uint24 startDayIndex, uint256 endTime, uint256 shares, bool claimedCreate, bool claimedStake, uint256 costTitanX, uint256 costETH, uint256 rewards, uint256 penalties, uint256 claimedAt, bool isCreate)[])'
    ];
    
    const contract = new ethers.Contract(CONTRACTS.TORUS_CREATE_STAKE, contractABI, provider);
    
    // Get current block
    const currentBlock = await provider.getBlockNumber();
    const DEPLOYMENT_BLOCK = 22890272;
    
    console.log(`Scanning blocks ${DEPLOYMENT_BLOCK} to ${currentBlock}`);
    console.log(`Total blocks to scan: ${currentBlock - DEPLOYMENT_BLOCK}`);
    
    // Fetch all Created events
    const chunkSize = 5000;
    let allEvents = [];
    
    for (let start = DEPLOYMENT_BLOCK; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      
      if (start % 20000 === 0) {
        const progress = Math.round((start - DEPLOYMENT_BLOCK) / (currentBlock - DEPLOYMENT_BLOCK) * 100);
        console.log(`Progress: ${progress}% - Block ${start}`);
      }
      
      try {
        const events = await contract.queryFilter(
          contract.filters.Created(),
          start,
          end
        );
        allEvents.push(...events);
      } catch (error) {
        console.error(`Error fetching blocks ${start}-${end}:`, error.message);
        // Retry with smaller chunk
        const smallChunk = 1000;
        for (let smallStart = start; smallStart <= end; smallStart += smallChunk) {
          const smallEnd = Math.min(smallStart + smallChunk - 1, end);
          try {
            const events = await contract.queryFilter(
              contract.filters.Created(),
              smallStart,
              smallEnd
            );
            allEvents.push(...events);
          } catch (e) {
            console.error(`  Failed even with small chunk ${smallStart}-${smallEnd}`);
          }
        }
      }
    }
    
    console.log(`\n✅ Found ${allEvents.length} total creates`);
    
    // Get block timestamps
    console.log('\nFetching block timestamps...');
    const blockNumbers = [...new Set(allEvents.map(e => e.blockNumber))];
    const blockTimestamps = new Map();
    
    // Fetch in batches
    const timestampBatchSize = 10;
    for (let i = 0; i < blockNumbers.length; i += timestampBatchSize) {
      const batch = blockNumbers.slice(i, i + timestampBatchSize);
      const promises = batch.map(async (blockNumber) => {
        try {
          const block = await provider.getBlock(blockNumber);
          return { blockNumber, timestamp: block.timestamp };
        } catch (e) {
          console.error(`Failed to get block ${blockNumber}`);
          return { blockNumber, timestamp: null };
        }
      });
      
      const results = await Promise.all(promises);
      results.forEach(({ blockNumber, timestamp }) => {
        if (timestamp) blockTimestamps.set(blockNumber, timestamp);
      });
      
      if (i % 100 === 0) {
        console.log(`  Timestamps progress: ${i}/${blockNumbers.length}`);
      }
    }
    
    // Process events into create data
    console.log('\nProcessing create events...');
    const processedCreates = allEvents.map((event, index) => {
      const blockTimestamp = blockTimestamps.get(event.blockNumber) || Math.floor(Date.now() / 1000);
      const endTime = parseInt(event.args.endTime.toString());
      const duration = Math.round((endTime - blockTimestamp) / 86400);
      
      return {
        // Primary fields
        user: event.args.user.toLowerCase(),
        owner: event.args.user.toLowerCase(),
        createId: event.args.stakeIndex.toString(),
        id: event.args.stakeIndex.toString(),
        stakeIndex: event.args.stakeIndex.toString(),
        
        // Amounts
        torusAmount: event.args.torusAmount.toString(),
        principal: event.args.torusAmount.toString(),
        
        // Timestamps and dates
        timestamp: blockTimestamp,
        endTime: endTime,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        
        // Calculated fields
        createDays: duration,
        stakingDays: duration,
        maturityDate: new Date(endTime * 1000).toISOString(),
        startDate: new Date(blockTimestamp * 1000).toISOString(),
        
        // Payment fields (to be populated later)
        titanAmount: "0",
        titanXAmount: "0",
        ethAmount: "0",
        shares: "0",
        power: "0",
        costETH: "0",
        costTitanX: "0",
        rawCostETH: "0",
        rawCostTitanX: "0",
        
        // Status fields
        claimedCreate: false,
        claimedStake: false,
        rewards: "0",
        penalties: "0",
        claimedAt: "0",
        isCreate: true
      };
    });
    
    // Sort by timestamp
    processedCreates.sort((a, b) => a.timestamp - b.timestamp);
    
    // Load current data
    const dataPath = path.join(__dirname, '../public/data/cached-data.json');
    const cachedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Backup current data
    const backupPath = dataPath.replace('.json', `-backup-before-rebuild-${Date.now()}.json`);
    fs.writeFileSync(backupPath, fs.readFileSync(dataPath));
    console.log(`\n📁 Backup saved to: ${path.basename(backupPath)}`);
    
    // Update cached data
    const oldCreateCount = cachedData.stakingData.createEvents.length;
    cachedData.stakingData.createEvents = processedCreates;
    cachedData.lastUpdated = new Date().toISOString();
    
    // Update metadata
    if (!cachedData.stakingData.metadata) {
      cachedData.stakingData.metadata = {};
    }
    cachedData.stakingData.metadata.lastFullRebuild = new Date().toISOString();
    cachedData.stakingData.metadata.totalCreates = processedCreates.length;
    cachedData.stakingData.metadata.rebuildBlock = currentBlock;
    
    // Save updated data
    fs.writeFileSync(dataPath, JSON.stringify(cachedData, null, 2));
    
    console.log(`\n✅ Successfully rebuilt create data`);
    console.log(`   Old count: ${oldCreateCount}`);
    console.log(`   New count: ${processedCreates.length}`);
    console.log(`   Difference: +${processedCreates.length - oldCreateCount}`);
    
    // Show sample of creates by maturity day
    const CONTRACT_START = new Date('2025-07-11T00:00:00Z');
    const maturityByDay = {};
    
    processedCreates.forEach(create => {
      const maturityDate = new Date(create.maturityDate);
      const daysSinceStart = Math.floor((maturityDate - CONTRACT_START) / (24 * 60 * 60 * 1000)) + 1;
      
      if (!maturityByDay[daysSinceStart]) {
        maturityByDay[daysSinceStart] = 0;
      }
      maturityByDay[daysSinceStart]++;
    });
    
    console.log('\n📊 Creates by maturity day (sample):');
    Object.entries(maturityByDay)
      .filter(([day]) => parseInt(day) >= 94 && parseInt(day) <= 100)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([day, count]) => {
        console.log(`   Day ${day}: ${count} creates`);
      });
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the rebuild
rebuildAllCreates().catch(console.error);