#!/usr/bin/env node

/**
 * Incremental update for Creates and Stakes
 * Fetches new events and updates cached-data.json
 * Ensures titanAmount field is set for frontend
 */

const { ethers } = require('ethers');
const fs = require('fs');

async function updateCreatesStakes() {
  console.log('📊 Updating Creates & Stakes...');
  
  try {
    // Load existing data
    const cachedData = JSON.parse(fs.readFileSync('./clean-rebuild/data/cached-data.json', 'utf8'));
    const lastBlock = cachedData.metadata?.lastBlockCreatesStakes || 23033589;
    
    // Setup provider
    const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
    const currentBlock = await provider.getBlockNumber();
    
    if (currentBlock <= lastBlock) {
      console.log('✅ No new blocks to process');
      return;
    }
    
    console.log(`📍 Updating from block ${lastBlock + 1} to ${currentBlock}`);
    
    // Contract setup
    const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
    const abi = [
      'event Create(address indexed user, uint256 indexed eventId, uint256 reward, uint256 protocolFee, uint256 stakerFee, uint256 lpFee, address referrer)',
      'event Stake(address indexed user, uint256 indexed eventId, uint256 indexed stakeEventId, uint256 titanAmount)'
    ];
    
    const contract = new ethers.Contract(CREATE_STAKE_CONTRACT, abi, provider);
    
    // Fetch new events in chunks
    const newCreates = [];
    const newStakes = [];
    const chunkSize = 2000;
    
    for (let start = lastBlock + 1; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      
      const [creates, stakes] = await Promise.all([
        contract.queryFilter(contract.filters.Create(), start, end),
        contract.queryFilter(contract.filters.Stake(), start, end)
      ]);
      
      newCreates.push(...creates);
      newStakes.push(...stakes);
    }
    
    console.log(`📈 Found ${newCreates.length} new creates, ${newStakes.length} new stakes`);
    
    if (newCreates.length === 0 && newStakes.length === 0) {
      // Update last block even if no events
      cachedData.metadata.lastBlockCreatesStakes = currentBlock;
      fs.writeFileSync('./clean-rebuild/data/cached-data.json', JSON.stringify(cachedData, null, 2));
      return;
    }
    
    // Get block timestamps
    const blocks = new Map();
    const allBlockNumbers = [...new Set([
      ...newCreates.map(e => e.blockNumber),
      ...newStakes.map(e => e.blockNumber)
    ])];
    
    for (const blockNum of allBlockNumbers) {
      if (!blocks.has(blockNum)) {
        const block = await provider.getBlock(blockNum);
        blocks.set(blockNum, block.timestamp);
      }
    }
    
    // Helper to calculate protocol day
    const CONTRACT_START = new Date('2025-07-10T18:00:00Z').getTime() / 1000;
    function getProtocolDay(timestamp) {
      return Math.floor((timestamp - CONTRACT_START) / (24 * 60 * 60)) + 1;
    }
    
    // Process creates
    for (const event of newCreates) {
      const timestamp = blocks.get(event.blockNumber);
      const tx = await provider.getTransaction(event.transactionHash);
      
      const createData = {
        user: event.args.user.toLowerCase(),
        eventId: event.args.eventId.toString(),
        reward: event.args.reward.toString(),
        protocolFee: event.args.protocolFee.toString(),
        stakerFee: event.args.stakerFee.toString(),
        lpFee: event.args.lpFee.toString(),
        referrer: event.args.referrer.toLowerCase(),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        timestamp: timestamp.toString(),
        protocolDay: getProtocolDay(timestamp)
      };
      
      // Check if ETH or TitanX create
      if (tx.value && !tx.value.isZero()) {
        createData.costETH = tx.value.toString();
        createData.titanAmount = "0"; // Important for frontend
      } else {
        // For TitanX creates, we need to get the amount from the transaction
        // This will be captured when processing payment events
        createData.costETH = "0";
        createData.titanAmount = "0"; // Will be updated by payment matching
      }
      
      cachedData.stakingData.createEvents.push(createData);
    }
    
    // Process stakes
    for (const event of newStakes) {
      const timestamp = blocks.get(event.blockNumber);
      
      const stakeData = {
        user: event.args.user.toLowerCase(),
        eventId: event.args.eventId.toString(),
        stakeEventId: event.args.stakeEventId.toString(),
        titanAmount: event.args.titanAmount.toString(),
        rawCostTitanX: event.args.titanAmount.toString(), // For frontend
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        timestamp: timestamp.toString(),
        protocolDay: getProtocolDay(timestamp)
      };
      
      cachedData.stakingData.stakeEvents.push(stakeData);
    }
    
    // Update metadata
    cachedData.metadata.lastBlockCreatesStakes = currentBlock;
    cachedData.lastUpdated = new Date().toISOString();
    
    // Save updated data
    fs.writeFileSync('./clean-rebuild/data/cached-data.json', JSON.stringify(cachedData, null, 2));
    
    console.log('✅ Creates & Stakes updated successfully');
    
  } catch (error) {
    console.error('❌ Error updating creates/stakes:', error.message);
    process.exit(1);
  }
}

// Run the update
updateCreatesStakes();