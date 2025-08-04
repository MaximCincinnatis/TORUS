const { ethers } = require('ethers');
require('dotenv').config();

async function verifyAllBurns() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || 'https://eth.drpc.org');
  
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  const TORUS_TOKEN = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  
  // Protocol start date
  const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
  
  console.log('=== VERIFYING ALL TORUS BURNS FROM BUY & PROCESS CONTRACT ===\n');
  
  // Load our data
  const buyProcessData = require('./public/data/buy-process-data.json');
  
  console.log('Our data shows for days 20-25:');
  const ourDays20to25 = buyProcessData.dailyData.filter(d => d.protocolDay >= 20 && d.protocolDay <= 25);
  const ourTotal = ourDays20to25.reduce((sum, d) => sum + d.torusBurned, 0);
  console.log(`Total: ${ourTotal.toFixed(6)} TORUS\n`);
  
  const transferEventSig = ethers.utils.id('Transfer(address,address,uint256)');
  
  // For days 20-25, check ALL transfers from Buy & Process to 0x0
  const startBlock = 23026000; // Approximate start of day 20
  const endBlock = 23059000; // Approximate end of day 25
  const chunkSize = 2000;
  
  const allTransfers = [];
  
  console.log('Fetching ALL transfers from Buy & Process to 0x0...\n');
  
  for (let from = startBlock; from <= endBlock; from += chunkSize) {
    const to = Math.min(from + chunkSize - 1, endBlock);
    
    const filter = {
      address: TORUS_TOKEN,
      topics: [
        transferEventSig,
        ethers.utils.hexZeroPad(BUY_PROCESS_CONTRACT, 32), // from Buy & Process
        ethers.utils.hexZeroPad(ZERO_ADDRESS, 32) // to 0x0
      ],
      fromBlock: from,
      toBlock: to
    };
    
    try {
      const logs = await provider.getLogs(filter);
      allTransfers.push(...logs);
      if (logs.length > 0) {
        console.log(`Blocks ${from}-${to}: Found ${logs.length} transfers to 0x0`);
      }
    } catch (e) {
      console.log(`Error fetching blocks ${from}-${to}, skipping...`);
    }
  }
  
  console.log(`\nTotal transfers to 0x0 found: ${allTransfers.length}\n`);
  
  // Group by protocol day
  const burnsByDay = {};
  for (let day = 20; day <= 25; day++) {
    burnsByDay[day] = { amount: ethers.BigNumber.from(0), txs: [] };
  }
  
  // Process each transfer
  for (const log of allTransfers) {
    const block = await provider.getBlock(log.blockNumber);
    const timestamp = block.timestamp;
    const protocolDay = Math.floor((timestamp - CONTRACT_START_DATE.getTime() / 1000) / (24 * 60 * 60)) + 1;
    
    if (protocolDay >= 20 && protocolDay <= 25) {
      const amount = ethers.BigNumber.from(log.data);
      burnsByDay[protocolDay].amount = burnsByDay[protocolDay].amount.add(amount);
      burnsByDay[protocolDay].txs.push({
        tx: log.transactionHash,
        amount: ethers.utils.formatEther(amount)
      });
    }
  }
  
  console.log('=== DETAILED COMPARISON ===\n');
  
  for (let day = 20; day <= 25; day++) {
    const ourAmount = ourDays20to25.find(d => d.protocolDay === day)?.torusBurned || 0;
    const onChainAmount = parseFloat(ethers.utils.formatEther(burnsByDay[day].amount));
    
    console.log(`Day ${day}:`);
    console.log(`  Our data: ${ourAmount.toFixed(6)} TORUS`);
    console.log(`  On-chain: ${onChainAmount.toFixed(6)} TORUS (${burnsByDay[day].txs.length} txs)`);
    
    if (Math.abs(ourAmount - onChainAmount) > 0.01) {
      console.log(`  ❌ MISMATCH: Difference of ${(onChainAmount - ourAmount).toFixed(6)} TORUS`);
    } else {
      console.log(`  ✅ Match within tolerance`);
    }
    console.log('');
  }
  
  // Show total comparison
  const totalOnChain = Object.values(burnsByDay).reduce((sum, day) => 
    sum.add(day.amount), ethers.BigNumber.from(0)
  );
  
  console.log('=== TOTALS ===');
  console.log(`Our data total: ${ourTotal.toFixed(6)} TORUS`);
  console.log(`On-chain total: ${ethers.utils.formatEther(totalOnChain)} TORUS`);
  console.log(`Difference: ${(parseFloat(ethers.utils.formatEther(totalOnChain)) - ourTotal).toFixed(6)} TORUS`);
  
  // Also check total contract burns
  console.log('\n=== CHECKING CONTRACT totals.torusBurnt ===');
  console.log(`Our stored total: ${buyProcessData.totals.torusBurnt} TORUS`);
  
  // Get ALL burns from contract deployment
  const allTimeBurns = [];
  const deployBlock = 22890272;
  const currentBlock = await provider.getBlockNumber();
  
  console.log('\nFetching ALL TIME burns...');
  let totalAllTime = ethers.BigNumber.from(0);
  
  for (let from = deployBlock; from <= currentBlock; from += 5000) {
    const to = Math.min(from + 4999, currentBlock);
    
    const filter = {
      address: TORUS_TOKEN,
      topics: [
        transferEventSig,
        ethers.utils.hexZeroPad(BUY_PROCESS_CONTRACT, 32),
        ethers.utils.hexZeroPad(ZERO_ADDRESS, 32)
      ],
      fromBlock: from,
      toBlock: to
    };
    
    try {
      const logs = await provider.getLogs(filter);
      for (const log of logs) {
        totalAllTime = totalAllTime.add(ethers.BigNumber.from(log.data));
      }
      if (logs.length > 0) {
        console.log(`Found ${logs.length} burns in blocks ${from}-${to}`);
      }
    } catch (e) {
      console.log(`Error fetching blocks ${from}-${to}, skipping...`);
    }
  }
  
  console.log(`\nTotal ALL TIME burns from Buy & Process: ${ethers.utils.formatEther(totalAllTime)} TORUS`);
  console.log(`Stored in our data: ${buyProcessData.totals.torusBurnt} TORUS`);
  
  const allTimeDiff = parseFloat(ethers.utils.formatEther(totalAllTime)) - parseFloat(buyProcessData.totals.torusBurnt);
  if (Math.abs(allTimeDiff) > 0.01) {
    console.log(`❌ MISMATCH: Difference of ${allTimeDiff.toFixed(6)} TORUS`);
  } else {
    console.log(`✅ All time totals match!`);
  }
}

verifyAllBurns().catch(console.error);