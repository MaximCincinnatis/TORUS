const { ethers } = require('ethers');
require('dotenv').config();

async function findAllMissingBurns() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || 'https://eth.drpc.org');
  
  const TORUS_TOKEN = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  
  const transferEventSig = ethers.utils.id('Transfer(address,address,uint256)');
  
  console.log('Finding ALL burns and checking against daily data...\n');
  
  // Get all burns
  const deployBlock = 22890000;
  const currentBlock = await provider.getBlockNumber();
  const chunkSize = 10000;
  
  const burnsByDay = {};
  let totalBurns = ethers.BigNumber.from(0);
  
  for (let from = deployBlock; from <= currentBlock; from += chunkSize) {
    const to = Math.min(from + chunkSize - 1, currentBlock);
    
    const filter = {
      address: TORUS_TOKEN,
      topics: [
        transferEventSig,
        ethers.utils.hexZeroPad(BUY_PROCESS_CONTRACT.toLowerCase(), 32),
        ethers.utils.hexZeroPad(ZERO_ADDRESS, 32)
      ],
      fromBlock: from,
      toBlock: to
    };
    
    try {
      const logs = await provider.getLogs(filter);
      
      for (const log of logs) {
        const amount = ethers.BigNumber.from(log.data);
        const block = await provider.getBlock(log.blockNumber);
        
        // Calculate protocol day
        const CONTRACT_START = new Date('2025-07-10T18:00:00.000Z').getTime() / 1000;
        const protocolDay = Math.floor((block.timestamp - CONTRACT_START) / 86400) + 1;
        
        if (!burnsByDay[protocolDay]) {
          burnsByDay[protocolDay] = ethers.BigNumber.from(0);
        }
        burnsByDay[protocolDay] = burnsByDay[protocolDay].add(amount);
        totalBurns = totalBurns.add(amount);
      }
      
      if (logs.length > 0) {
        console.log(`Blocks ${from}-${to}: Found ${logs.length} burns`);
      }
    } catch (e) {
      console.log(`Error fetching blocks ${from}-${to}`);
    }
  }
  
  // Load our daily data
  const buyProcessData = require('./public/data/buy-process-data.json');
  
  console.log('\n=== COMPARISON BY DAY ===');
  
  let ourDailySum = 0;
  let actualDailySum = ethers.BigNumber.from(0);
  
  // Check each day
  for (let day = 0; day <= 26; day++) {
    const actualBurns = burnsByDay[day] ? parseFloat(ethers.utils.formatEther(burnsByDay[day])) : 0;
    const ourBurns = buyProcessData.dailyData.find(d => d.protocolDay === day)?.torusBurned || 0;
    
    if (Math.abs(actualBurns - ourBurns) > 0.01 || (actualBurns > 0 && ourBurns === 0)) {
      console.log(`\nDay ${day}:`);
      console.log(`  Actual: ${actualBurns.toFixed(6)} TORUS`);
      console.log(`  Our data: ${ourBurns.toFixed(6)} TORUS`);
      console.log(`  Difference: ${(actualBurns - ourBurns).toFixed(6)} TORUS`);
    }
    
    ourDailySum += ourBurns;
    if (burnsByDay[day]) {
      actualDailySum = actualDailySum.add(burnsByDay[day]);
    }
  }
  
  console.log('\n=== TOTALS ===');
  console.log('Actual total (on-chain):', ethers.utils.formatEther(totalBurns));
  console.log('Our total (buy-process-data.json):', buyProcessData.totals.torusBurnt);
  console.log('Sum of our daily data:', ourDailySum.toFixed(6));
  console.log('Sum of actual daily burns:', ethers.utils.formatEther(actualDailySum));
  
  // Check for LP fee burns
  const lpData = require('./public/data/buy-process-burns.json');
  console.log('\nLP fee burns:', lpData.totals.torusBurned);
  console.log('Daily + LP:', (ourDailySum + parseFloat(lpData.totals.torusBurned)).toFixed(6));
  
  console.log('\n=== ANALYSIS ===');
  const missingFromDaily = parseFloat(ethers.utils.formatEther(totalBurns)) - ourDailySum;
  console.log('Missing from daily breakdown:', missingFromDaily.toFixed(6), 'TORUS');
  console.log('This appears to be burns assigned to wrong days or day 0');
}

findAllMissingBurns().catch(console.error);