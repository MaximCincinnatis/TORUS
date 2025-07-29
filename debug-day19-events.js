#!/usr/bin/env node

/**
 * Debug Day 19 Event Detection
 * 
 * Check why the audit found 0 events when we expect 5 creates
 */

const { ethers } = require('ethers');

async function debugDay19() {
  console.log('🔍 Debug Day 19 Event Detection\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  // Check current block and protocol day
  const currentBlock = await provider.getBlockNumber();
  console.log(`📊 Current block: ${currentBlock}`);
  
  const stakeContractABI = [
    'event Created(uint256 indexed gId, address indexed creator, uint24 indexed payout, uint256 payoutWad, uint256 indexed maturityDay, uint256 createTime, uint256 titanAmount, uint256 indexed shareAmount)',
    'event Staked(uint256 indexed sId, address indexed staker, uint24 indexed payout, uint256 payoutWad, uint256 indexed maturityDay, uint256 stakeTime, uint256 titanAmount, uint256 indexed shareAmount)',
    'function getCurrentDayIndex() view returns (uint24)'
  ];
  
  const stakeContract = new ethers.Contract(STAKE_CONTRACT, stakeContractABI, provider);
  
  // Get current protocol day
  const currentProtocolDay = await stakeContract.getCurrentDayIndex();
  console.log(`📅 Current protocol day: ${Number(currentProtocolDay)}`);
  
  // Check if events exist at all in recent blocks
  console.log('\n🔍 Checking for ANY events in last 10,000 blocks...');
  const recentBlocks = 10000;
  const startBlock = currentBlock - recentBlocks;
  
  try {
    const [allCreated, allStaked] = await Promise.all([
      stakeContract.queryFilter(stakeContract.filters.Created(), startBlock, currentBlock),
      stakeContract.queryFilter(stakeContract.filters.Staked(), startBlock, currentBlock)
    ]);
    
    console.log(`📊 Found in last ${recentBlocks} blocks:`);
    console.log(`  - ${allCreated.length} Created events`);
    console.log(`  - ${allStaked.length} Staked events`);
    
    if (allCreated.length > 0) {
      console.log('\n📝 Recent Created events:');
      allCreated.slice(-5).forEach((event, i) => {
        console.log(`  ${i + 1}. gId: ${event.args.gId.toString()}`);
        console.log(`     Block: ${event.blockNumber}`);
        console.log(`     Tx: ${event.transactionHash}`);
      });
    }
    
    if (allStaked.length > 0) {
      console.log('\n📝 Recent Staked events:');
      allStaked.slice(-5).forEach((event, i) => {
        console.log(`  ${i + 1}. sId: ${event.args.sId.toString()}`);
        console.log(`     Block: ${event.blockNumber}`);
        console.log(`     Tx: ${event.transactionHash}`);
      });
    }
    
    // Get timestamps for recent events to calculate protocol days
    if (allCreated.length > 0 || allStaked.length > 0) {
      console.log('\n⏰ Calculating protocol days for recent events...');
      const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
      
      function getProtocolDay(timestamp) {
        const msPerDay = 24 * 60 * 60 * 1000;
        const date = new Date(timestamp * 1000);
        return Math.max(1, Math.floor((date.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1);
      }
      
      // Check last few events
      const recentEvents = [...allCreated, ...allStaked].sort((a, b) => b.blockNumber - a.blockNumber).slice(0, 10);
      
      for (const event of recentEvents) {
        const block = await provider.getBlock(event.blockNumber);
        const protocolDay = getProtocolDay(block.timestamp);
        const date = new Date(block.timestamp * 1000).toISOString();
        
        console.log(`  Block ${event.blockNumber}: Protocol Day ${protocolDay} (${date})`);
      }
    }
    
    // Check specifically for Day 19 time range
    console.log('\n🎯 Checking for events in Day 19 time range...');
    const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
    const day19Start = new Date(CONTRACT_START_DATE.getTime() + (19 - 1) * 24 * 60 * 60 * 1000);
    const day19End = new Date(day19Start.getTime() + 24 * 60 * 60 * 1000 - 1);
    
    console.log(`Day 19 range: ${day19Start.toISOString()} to ${day19End.toISOString()}`);
    
    // Find blocks closest to Day 19 start and end
    const day19StartTimestamp = Math.floor(day19Start.getTime() / 1000);
    const day19EndTimestamp = Math.floor(day19End.getTime() / 1000);
    
    // Binary search for blocks near Day 19 timestamps
    console.log(`Looking for blocks near timestamps ${day19StartTimestamp} to ${day19EndTimestamp}...`);
    
    // Get a few recent blocks to see their timestamps
    console.log('\n📊 Recent block timestamps:');
    for (let i = 0; i < 5; i++) {
      const blockNum = currentBlock - i;
      const block = await provider.getBlock(blockNum);
      const date = new Date(block.timestamp * 1000).toISOString();
      console.log(`  Block ${blockNum}: ${block.timestamp} (${date})`);
    }
    
  } catch (e) {
    console.error(`❌ Error querying events: ${e.message}`);
  }
}

debugDay19().catch(console.error);