const { ethers } = require('ethers');
require('dotenv').config();

async function verifyBurnsForDays20to25() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || 'https://eth.drpc.org');
  
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  const TORUS_TOKEN = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  
  // Protocol start date
  const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
  
  // Days 20-25 correspond to July 29 - August 3, 2025
  // Day 20 starts at: July 29, 2025 18:00 UTC
  // Day 25 ends at: August 4, 2025 17:59:59 UTC
  
  const day20StartTimestamp = CONTRACT_START_DATE.getTime() / 1000 + (19 * 24 * 60 * 60); // Start of day 20
  const day25EndTimestamp = CONTRACT_START_DATE.getTime() / 1000 + (25 * 24 * 60 * 60) - 1; // End of day 25
  
  console.log('=== VERIFYING TORUS BURNS FOR DAYS 20-25 ===\n');
  console.log(`Day 20 starts: ${new Date(day20StartTimestamp * 1000).toISOString()}`);
  console.log(`Day 25 ends: ${new Date(day25EndTimestamp * 1000).toISOString()}\n`);
  
  // Load our data for comparison
  const buyProcessData = require('./public/data/buy-process-data.json');
  
  console.log('Our data shows for days 20-25:');
  const ourDays20to25 = buyProcessData.dailyData.filter(d => d.protocolDay >= 20 && d.protocolDay <= 25);
  ourDays20to25.forEach(day => {
    console.log(`Day ${day.protocolDay}: ${day.torusBurned.toFixed(2)} TORUS burned`);
  });
  
  const ourTotalDays20to25 = ourDays20to25.reduce((sum, d) => sum + d.torusBurned, 0);
  console.log(`Total our data: ${ourTotalDays20to25.toFixed(6)} TORUS\n`);
  
  // Get approximate blocks for the time range
  const startBlock = 23002000; // Approximate block for day 20
  const endBlock = await provider.getBlockNumber();
  
  console.log('Fetching on-chain data...\n');
  
  const transferEventSig = ethers.utils.id('Transfer(address,address,uint256)');
  
  // Track burns by protocol day
  const burnsByDay = {};
  for (let i = 20; i <= 25; i++) {
    burnsByDay[i] = ethers.BigNumber.from(0);
  }
  
  try {
    // Fetch Transfer events from Buy & Process to 0x0 in chunks
    const allLogs = [];
    const chunkSize = 5000;
    
    for (let fromBlock = startBlock; fromBlock <= endBlock; fromBlock += chunkSize) {
      const toBlock = Math.min(fromBlock + chunkSize - 1, endBlock);
      
      const filter = {
        address: TORUS_TOKEN,
        topics: [
          transferEventSig,
          ethers.utils.hexZeroPad(BUY_PROCESS_CONTRACT, 32), // from Buy & Process
          ethers.utils.hexZeroPad(ZERO_ADDRESS, 32) // to 0x0
        ],
        fromBlock: fromBlock,
        toBlock: toBlock
      };
      
      try {
        const logs = await provider.getLogs(filter);
        allLogs.push(...logs);
        console.log(`Fetched blocks ${fromBlock}-${toBlock}: found ${logs.length} burns`);
      } catch (e) {
        console.log(`Error fetching blocks ${fromBlock}-${toBlock}, skipping...`);
      }
    }
    
    console.log(`\nTotal burn events found: ${allLogs.length}\n`);
    
    let relevantBurns = 0;
    
    for (const log of allLogs) {
      const amount = ethers.BigNumber.from(log.data);
      
      // Get block timestamp
      const block = await provider.getBlock(log.blockNumber);
      const timestamp = block.timestamp;
      
      // Only process if within days 20-25
      if (timestamp >= day20StartTimestamp && timestamp <= day25EndTimestamp) {
        // Calculate protocol day
        const protocolDay = Math.floor((timestamp - CONTRACT_START_DATE.getTime() / 1000) / (24 * 60 * 60)) + 1;
        
        if (protocolDay >= 20 && protocolDay <= 25) {
          relevantBurns++;
          burnsByDay[protocolDay] = burnsByDay[protocolDay].add(amount);
          
          console.log(`Day ${protocolDay} burn: ${ethers.utils.formatEther(amount)} TORUS`);
          console.log(`  Block: ${log.blockNumber}, Tx: ${log.transactionHash}`);
          console.log(`  Time: ${new Date(timestamp * 1000).toISOString()}\n`);
        }
      }
    }
    
    console.log(`\nProcessed ${relevantBurns} burns for days 20-25\n`);
    
    // Compare results
    console.log('=== COMPARISON ===');
    console.log('Day | Our Data    | On-Chain    | Match?');
    console.log('----+-------------+-------------+-------');
    
    let totalOnChain = ethers.BigNumber.from(0);
    let allMatch = true;
    
    for (let day = 20; day <= 25; day++) {
      const ourAmount = ourDays20to25.find(d => d.protocolDay === day)?.torusBurned || 0;
      const onChainAmount = parseFloat(ethers.utils.formatEther(burnsByDay[day]));
      totalOnChain = totalOnChain.add(burnsByDay[day]);
      
      const match = Math.abs(ourAmount - onChainAmount) < 0.0001;
      if (!match) allMatch = false;
      
      console.log(`${day.toString().padStart(3)} | ${ourAmount.toFixed(6).padStart(11)} | ${onChainAmount.toFixed(6).padStart(11)} | ${match ? '✅' : '❌'}`);
    }
    
    console.log('----+-------------+-------------+-------');
    console.log(`TOT | ${ourTotalDays20to25.toFixed(6).padStart(11)} | ${ethers.utils.formatEther(totalOnChain).padStart(11)} | ${allMatch ? '✅' : '❌'}`);
    
    console.log('\n=== SUMMARY ===');
    if (allMatch) {
      console.log('✅ All burns for days 20-25 match on-chain data perfectly!');
    } else {
      console.log('❌ Discrepancies found between our data and on-chain burns');
    }
    
  } catch (error) {
    console.error('Error fetching on-chain data:', error.message);
  }
}

verifyBurnsForDays20to25().catch(console.error);