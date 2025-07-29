#!/usr/bin/env node

/**
 * Comprehensive Day 19 Search
 * Search ALL TitanX transfers to stake contract during Day 19
 * to ensure we haven't missed any creates
 */

const { ethers } = require('ethers');

async function comprehensiveDay19Search() {
  console.log('🔍 Comprehensive Day 19 Creates Search\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const TITANX = '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1';
  const STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  // Day 19 exact timestamps
  const day19Start = 1753725600; // July 28, 2025 18:00:00 UTC
  const day19End = 1753811999;   // July 29, 2025 17:59:59 UTC
  
  console.log(`📅 Day 19 Range: ${new Date(day19Start * 1000).toISOString()} to ${new Date(day19End * 1000).toISOString()}`);
  
  // Get blocks for Day 19 by checking timestamps
  console.log('\n🔍 Finding Day 19 block range...');
  
  // Start from known Day 19 blocks and expand search
  let searchStartBlock = 23019000;  // Well before first known create
  let searchEndBlock = 23020500;    // Well after last known create
  
  // Get actual Day 19 boundary blocks
  let day19StartBlock = searchStartBlock;
  let day19EndBlock = searchEndBlock;
  
  // Find actual start block
  for (let block = searchStartBlock; block <= searchStartBlock + 1000; block += 10) {
    try {
      const blockData = await provider.getBlock(block);
      if (blockData.timestamp >= day19Start) {
        day19StartBlock = block;
        console.log(`  Day 19 starts around block ${block}`);
        break;
      }
    } catch (e) {}
  }
  
  // Find actual end block
  for (let block = searchEndBlock; block >= searchEndBlock - 1000; block -= 10) {
    try {
      const blockData = await provider.getBlock(block);
      if (blockData.timestamp <= day19End) {
        day19EndBlock = block;
        console.log(`  Day 19 ends around block ${block}`);
        break;
      }
    } catch (e) {}
  }
  
  console.log(`\n📊 Searching blocks ${day19StartBlock} to ${day19EndBlock} for ALL TitanX transfers to stake contract`);
  
  // Get ALL transfers in this range
  const allTransfers = [];
  const chunkSize = 500;
  
  for (let start = day19StartBlock; start <= day19EndBlock; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, day19EndBlock);
    console.log(`  Checking blocks ${start} to ${end}...`);
    
    try {
      const filter = {
        address: TITANX,
        topics: [
          ethers.utils.id('Transfer(address,address,uint256)'),
          null,
          ethers.utils.hexZeroPad(STAKE_CONTRACT.toLowerCase(), 32)
        ],
        fromBlock: start,
        toBlock: end
      };
      
      const logs = await provider.getLogs(filter);
      allTransfers.push(...logs);
    } catch (e) {
      console.log(`    ⚠️ Error: ${e.message}`);
    }
  }
  
  console.log(`\n📊 Found ${allTransfers.length} total TitanX transfers to stake contract`);
  
  // Now check each transfer's timestamp
  const day19Transfers = [];
  
  console.log('\n🔍 Filtering for Day 19 transactions...');
  
  for (const log of allTransfers) {
    try {
      const block = await provider.getBlock(log.blockNumber);
      
      if (block.timestamp >= day19Start && block.timestamp <= day19End) {
        const tx = await provider.getTransaction(log.transactionHash);
        const iface = new ethers.utils.Interface(['event Transfer(address indexed from, address indexed to, uint256 value)']);
        const decoded = iface.parseLog(log);
        
        day19Transfers.push({
          from: decoded.args.from,
          amount: ethers.utils.formatEther(decoded.args.value),
          timestamp: block.timestamp,
          date: new Date(block.timestamp * 1000).toISOString(),
          block: log.blockNumber,
          txHash: log.transactionHash,
          function: tx.data.slice(0, 10),
          isCreate: tx.data.startsWith('0xefec9ccb')
        });
      }
    } catch (e) {
      console.log(`  ⚠️ Error processing transfer: ${e.message}`);
    }
  }
  
  console.log(`\n📊 DAY 19 RESULTS:`);
  console.log(`Total TitanX transfers on Day 19: ${day19Transfers.length}`);
  
  const creates = day19Transfers.filter(t => t.isCreate);
  const otherTransfers = day19Transfers.filter(t => !t.isCreate);
  
  console.log(`  - Creates (0xefec9ccb): ${creates.length}`);
  console.log(`  - Other transfers: ${otherTransfers.length}`);
  
  if (creates.length > 0) {
    console.log('\n📝 ALL Day 19 Creates:');
    creates.forEach((create, i) => {
      console.log(`\n${i + 1}. User: ${create.from}`);
      console.log(`   Amount: ${(parseFloat(create.amount) / 1e9).toFixed(2)}B TitanX`);
      console.log(`   Time: ${create.date}`);
      console.log(`   Block: ${create.block}`);
      console.log(`   Tx: ${create.txHash}`);
    });
    
    const total = creates.reduce((sum, c) => sum + parseFloat(c.amount), 0);
    console.log(`\nTotal TitanX in creates: ${(total / 1e9).toFixed(2)} Billion`);
  }
  
  if (otherTransfers.length > 0) {
    console.log('\n📝 Other Day 19 Transfers (not creates):');
    otherTransfers.forEach((transfer, i) => {
      console.log(`\n${i + 1}. Function: ${transfer.function}`);
      console.log(`   User: ${transfer.from}`);
      console.log(`   Amount: ${(parseFloat(transfer.amount) / 1e9).toFixed(2)}B TitanX`);
      console.log(`   Time: ${transfer.date}`);
      console.log(`   Tx: ${transfer.txHash}`);
    });
  }
  
  console.log('\n📊 FINAL ANSWER:');
  console.log(`┌─────────────────────────────────────────┐`);
  console.log(`│         DAY 19 CREATES TOTAL            │`);
  console.log(`├─────────────────────────────────────────┤`);
  console.log(`│ Total Creates Found: ${creates.length.toString().padStart(2, ' ')}                 │`);
  console.log(`└─────────────────────────────────────────┘`);
  
  if (creates.length > 5) {
    console.log(`\n⚠️ WARNING: Found ${creates.length} creates, but JSON only shows 5!`);
  } else if (creates.length === 5) {
    console.log(`\n✅ CONFIRMED: Exactly 5 creates on Day 19 - no missing creates`);
  } else {
    console.log(`\n❌ ERROR: Found only ${creates.length} creates, expected 5`);
  }
}

comprehensiveDay19Search().catch(console.error);