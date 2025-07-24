#!/usr/bin/env node

const { ethers } = require('ethers');

// RPC endpoints
const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function findDay15Blocks() {
  console.log('🔍 Finding exact blocks for Day 15 (July 24, 2025)\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    
    // Day 15 timestamps
    const day15Start = Math.floor(new Date('2025-07-24T18:00:00Z').getTime() / 1000);
    const day15End = day15Start + 86400;
    
    console.log(`Day 15 Start: ${new Date(day15Start * 1000).toISOString()} (${day15Start})`);
    console.log(`Day 15 End: ${new Date(day15End * 1000).toISOString()} (${day15End})`);
    
    // Binary search for start block
    let low = 22980000;
    let high = 23000000;
    let startBlock = 0;
    
    console.log('\nSearching for start block...');
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const block = await provider.getBlock(mid);
      
      if (block.timestamp < day15Start) {
        low = mid + 1;
      } else {
        startBlock = mid;
        high = mid - 1;
      }
      
      if (Math.abs(block.timestamp - day15Start) < 100) {
        console.log(`Block ${mid}: ${new Date(block.timestamp * 1000).toISOString()}`);
      }
    }
    
    // Binary search for end block
    low = startBlock;
    high = startBlock + 10000;
    let endBlock = 0;
    
    console.log('\nSearching for end block...');
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const block = await provider.getBlock(mid);
      
      if (block.timestamp < day15End) {
        low = mid + 1;
        endBlock = mid;
      } else {
        high = mid - 1;
      }
      
      if (Math.abs(block.timestamp - day15End) < 100) {
        console.log(`Block ${mid}: ${new Date(block.timestamp * 1000).toISOString()}`);
      }
    }
    
    console.log(`\n✅ Day 15 Block Range: ${startBlock} to ${endBlock}`);
    console.log(`Total blocks: ${endBlock - startBlock + 1}`);
    
    // Verify the blocks
    const startBlockData = await provider.getBlock(startBlock);
    const endBlockData = await provider.getBlock(endBlock);
    
    console.log(`\nVerification:`);
    console.log(`Start Block ${startBlock}: ${new Date(startBlockData.timestamp * 1000).toISOString()}`);
    console.log(`End Block ${endBlock}: ${new Date(endBlockData.timestamp * 1000).toISOString()}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
findDay15Blocks().catch(console.error);