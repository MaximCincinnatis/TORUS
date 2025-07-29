#!/usr/bin/env node

/**
 * Scan recent blocks for any Created events to understand what happened
 */

const { ethers } = require('ethers');

async function scanRecentEvents() {
  console.log('🔍 Scanning recent blocks for Created events...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const STAKING_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  const contract = new ethers.Contract(STAKING_CONTRACT, [
    'event Created(address indexed user, uint256 indexed stakeIndex, uint256 torusAmount, uint256 endTime, uint256 startTime)'
  ], provider);
  
  // Scan the recent block range where we think events should be
  const startBlock = 23018900;
  const endBlock = 23019800;
  
  console.log(`Scanning blocks ${startBlock} to ${endBlock} for Created events...`);
  
  try {
    const events = await contract.queryFilter(
      contract.filters.Created(),
      startBlock,
      endBlock
    );
    
    console.log(`Found ${events.length} Created events in this range`);
    
    if (events.length > 0) {
      console.log('\nFirst 10 events:');
      events.slice(0, 10).forEach((event, i) => {
        console.log(`${i + 1}. Block ${event.blockNumber}: User ${event.args.user.slice(0, 8)}..., Index ${event.args.stakeIndex.toString()}`);
      });
      
      console.log('\nLast 10 events:');
      events.slice(-10).forEach((event, i) => {
        console.log(`${events.length - 9 + i}. Block ${event.blockNumber}: User ${event.args.user.slice(0, 8)}..., Index ${event.args.stakeIndex.toString()}`);
      });
      
      console.log('\nEvents by block:');
      const byBlock = {};
      events.forEach(e => {
        byBlock[e.blockNumber] = (byBlock[e.blockNumber] || 0) + 1;
      });
      
      Object.entries(byBlock)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .forEach(([block, count]) => {
          console.log(`  Block ${block}: ${count} events`);
        });
        
    } else {
      console.log('❌ No Created events found in this range!');
      console.log('\nThis explains why payment data recovery failed.');
      console.log('The events in cached-data.json may have been generated differently.');
    }
    
  } catch (e) {
    console.log(`❌ Error scanning: ${e.message}`);
  }
}

scanRecentEvents().catch(console.error);