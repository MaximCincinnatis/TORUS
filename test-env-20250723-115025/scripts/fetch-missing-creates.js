#!/usr/bin/env node

/**
 * One-time script to fetch all missing creates from July 16-21
 * This fixes the issue where creates weren't being fetched due to wrong event signature
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Contract configuration
const STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
const CONTRACT_ABI = [
  'event Created(address indexed user, uint256 stakeIndex, uint256 torusAmount, uint256 endTime)'
];

// RPC endpoints
const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function fetchMissingCreates() {
  console.log('🔍 Fetching missing creates from blockchain...\n');
  
  try {
    // Connect to Ethereum
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const contract = new ethers.Contract(STAKE_CONTRACT, CONTRACT_ABI, provider);
    
    // Get current block
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current block: ${currentBlock}`);
    
    // Load cached data
    const dataPath = path.join(__dirname, '../public/data/cached-data.json');
    const cachedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Get existing creates to avoid duplicates
    const existingCreates = new Set();
    cachedData.stakingData.createEvents.forEach(create => {
      existingCreates.add(`${create.user}_${create.createId}_${create.blockNumber}`);
    });
    console.log(`Existing creates: ${existingCreates.size}`);
    
    // July 16, 2025 00:00 UTC in blocks (approximately)
    // Block 22954775 was around July 16 based on the data
    const july16Block = 22954775;
    
    console.log(`\nFetching creates from block ${july16Block} to ${currentBlock}`);
    console.log(`Block range: ${currentBlock - july16Block} blocks`);
    
    // Fetch in chunks to avoid RPC limits
    const MAX_BLOCK_RANGE = 9999;
    const allNewCreates = [];
    
    for (let fromBlock = july16Block; fromBlock <= currentBlock; fromBlock += MAX_BLOCK_RANGE) {
      const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, currentBlock);
      
      try {
        console.log(`\nFetching blocks ${fromBlock} to ${toBlock}...`);
        
        const filter = contract.filters.Created();
        const events = await contract.queryFilter(filter, fromBlock, toBlock);
        
        console.log(`  Found ${events.length} create events`);
        
        // Get block timestamps
        const blockNumbers = [...new Set(events.map(e => e.blockNumber))];
        const blockTimestamps = new Map();
        
        for (const blockNumber of blockNumbers) {
          try {
            const block = await provider.getBlock(blockNumber);
            blockTimestamps.set(blockNumber, block.timestamp);
          } catch (e) {
            console.error(`  Error fetching block ${blockNumber}:`, e.message);
          }
        }
        
        // Process events
        events.forEach(event => {
          const blockTimestamp = blockTimestamps.get(event.blockNumber) || Math.floor(Date.now() / 1000);
          const endTime = parseInt(event.args.endTime.toString());
          const duration = Math.round((endTime - blockTimestamp) / 86400);
          
          const createKey = `${event.args.user.toLowerCase()}_${event.args.stakeIndex.toString()}_${event.blockNumber}`;
          
          if (!existingCreates.has(createKey)) {
            const create = {
              user: event.args.user.toLowerCase(),
              owner: event.args.user.toLowerCase(),
              createId: event.args.stakeIndex.toString(),
              torusAmount: event.args.torusAmount.toString(),
              principal: event.args.torusAmount.toString(),
              timestamp: blockTimestamp,
              endTime: endTime,
              blockNumber: event.blockNumber,
              transactionHash: event.transactionHash,
              // Calculated fields
              id: event.args.stakeIndex.toString(),
              createDays: duration,
              stakingDays: duration,
              maturityDate: new Date(endTime * 1000).toISOString(),
              startDate: new Date(blockTimestamp * 1000).toISOString(),
              // Default fields
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
            
            allNewCreates.push(create);
            existingCreates.add(createKey);
          }
        });
        
      } catch (error) {
        console.error(`  Error fetching blocks ${fromBlock}-${toBlock}:`, error.message);
        // Continue with next chunk
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  Total new creates found: ${allNewCreates.length}`);
    
    if (allNewCreates.length > 0) {
      // Show sample of new creates
      console.log(`\nFirst 5 new creates:`);
      allNewCreates.slice(0, 5).forEach(create => {
        const startDate = new Date(create.timestamp * 1000);
        console.log(`  ${startDate.toISOString()} - ${(parseFloat(create.torusAmount) / 1e18).toFixed(2)} TORUS - ${create.createDays} days`);
      });
      
      // Merge with existing creates
      cachedData.stakingData.createEvents = [
        ...cachedData.stakingData.createEvents,
        ...allNewCreates
      ].sort((a, b) => a.timestamp - b.timestamp);
      
      // Update metadata
      cachedData.lastUpdated = new Date().toISOString();
      if (!cachedData.stakingData.metadata) {
        cachedData.stakingData.metadata = {};
      }
      cachedData.stakingData.metadata.lastCreateBlock = currentBlock;
      
      // Backup and save
      const backupPath = dataPath.replace('.json', `-backup-${Date.now()}.json`);
      fs.writeFileSync(backupPath, fs.readFileSync(dataPath));
      fs.writeFileSync(dataPath, JSON.stringify(cachedData, null, 2));
      
      console.log(`\n✅ Successfully added ${allNewCreates.length} new creates`);
      console.log(`✅ Total creates now: ${cachedData.stakingData.createEvents.length}`);
      console.log(`📁 Backup saved to: ${path.basename(backupPath)}`);
    } else {
      console.log('\n✅ No new creates found - data is up to date');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
fetchMissingCreates().catch(console.error);