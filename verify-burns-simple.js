const { ethers } = require('ethers');
require('dotenv').config();

async function verifyBurnsSimple() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || 'https://eth.drpc.org');
  
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  const TORUS_TOKEN = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  
  // Protocol start date
  const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
  
  console.log('=== SIMPLE BURNS VERIFICATION FOR DAYS 20-25 ===\n');
  
  // Load our data
  const buyProcessData = require('./public/data/buy-process-data.json');
  
  console.log('Our data shows:');
  const ourDays20to25 = buyProcessData.dailyData.filter(d => d.protocolDay >= 20 && d.protocolDay <= 25);
  const ourTotals = {};
  ourDays20to25.forEach(day => {
    ourTotals[day.protocolDay] = day.torusBurned;
    console.log(`Day ${day.protocolDay}: ${day.torusBurned.toFixed(6)} TORUS`);
  });
  
  console.log('\nFetching specific Buy & Burn transactions...\n');
  
  // Get the Buy & Process contract ABI for BuyAndBurn events
  const BUY_PROCESS_ABI = [
    'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)'
  ];
  
  const buyProcessContract = new ethers.Contract(BUY_PROCESS_CONTRACT, BUY_PROCESS_ABI, provider);
  
  try {
    // For days 20-25, fetch BuyAndBurn events in smaller chunks
    // Day 20 starts at block ~23026000
    // Day 25 ends at block ~23059000
    
    const startBlock = 23026000;
    const endBlock = 23059000;
    const chunkSize = 2000;
    
    const allBuyAndBurnEvents = [];
    
    console.log('Fetching BuyAndBurn events...');
    for (let from = startBlock; from <= endBlock; from += chunkSize) {
      const to = Math.min(from + chunkSize - 1, endBlock);
      try {
        const events = await buyProcessContract.queryFilter(
          buyProcessContract.filters.BuyAndBurn(),
          from,
          to
        );
        allBuyAndBurnEvents.push(...events);
        if (events.length > 0) {
          console.log(`Blocks ${from}-${to}: Found ${events.length} BuyAndBurn events`);
        }
      } catch (e) {
        console.log(`Error fetching blocks ${from}-${to}, skipping...`);
      }
    }
    
    console.log(`\nTotal BuyAndBurn events found: ${allBuyAndBurnEvents.length}\n`);
    
    // Group burns by protocol day
    const burnsByDay = {};
    for (let day = 20; day <= 25; day++) {
      burnsByDay[day] = ethers.BigNumber.from(0);
    }
    
    // Process each event
    for (const event of allBuyAndBurnEvents) {
      const block = await provider.getBlock(event.blockNumber);
      const timestamp = block.timestamp;
      const protocolDay = Math.floor((timestamp - CONTRACT_START_DATE.getTime() / 1000) / (24 * 60 * 60)) + 1;
      
      if (protocolDay >= 20 && protocolDay <= 25) {
        const burnAmount = event.args.torusBurnt;
        burnsByDay[protocolDay] = burnsByDay[protocolDay].add(burnAmount);
        
        console.log(`Day ${protocolDay}: ${ethers.utils.formatEther(burnAmount)} TORUS burned`);
        console.log(`  Tx: ${event.transactionHash}`);
      }
    }
    
    // Also check for LP fee burns (these show as direct transfers to 0x0)
    console.log('\nChecking for LP fee burns...\n');
    
    const transferEventSig = ethers.utils.id('Transfer(address,address,uint256)');
    const torusContract = new ethers.Contract(TORUS_TOKEN, ['event Transfer(address indexed from, address indexed to, uint256 value)'], provider);
    
    // Check the specific LP fee burn transactions we know about
    const knownLPBurns = [
      { tx: '0xa7342ca7f20e164e57ce5f4ab3eabdf5b862b3da70867f7ae44e309a143a5753', day: 19, amount: '38.108102380258301157' }
    ];
    
    for (const lpBurn of knownLPBurns) {
      if (lpBurn.day >= 20 && lpBurn.day <= 25) {
        console.log(`Checking LP burn on day ${lpBurn.day}: ${lpBurn.amount} TORUS`);
        burnsByDay[lpBurn.day] = burnsByDay[lpBurn.day].add(ethers.utils.parseEther(lpBurn.amount));
      }
    }
    
    console.log('\n=== FINAL COMPARISON ===');
    console.log('Day | Our Data    | On-Chain    | Difference');
    console.log('----+-------------+-------------+-----------');
    
    let totalOurs = 0;
    let totalOnChain = ethers.BigNumber.from(0);
    
    for (let day = 20; day <= 25; day++) {
      const ourAmount = ourTotals[day] || 0;
      const onChainAmount = parseFloat(ethers.utils.formatEther(burnsByDay[day]));
      const diff = ourAmount - onChainAmount;
      
      totalOurs += ourAmount;
      totalOnChain = totalOnChain.add(burnsByDay[day]);
      
      console.log(
        `${day.toString().padStart(3)} | ${ourAmount.toFixed(6).padStart(11)} | ${onChainAmount.toFixed(6).padStart(11)} | ${diff.toFixed(6).padStart(10)}`
      );
    }
    
    console.log('----+-------------+-------------+-----------');
    const totalDiff = totalOurs - parseFloat(ethers.utils.formatEther(totalOnChain));
    console.log(
      `TOT | ${totalOurs.toFixed(6).padStart(11)} | ${ethers.utils.formatEther(totalOnChain).padStart(11)} | ${totalDiff.toFixed(6).padStart(10)}`
    );
    
    console.log('\n=== ANALYSIS ===');
    if (Math.abs(totalDiff) < 0.01) {
      console.log('✅ Burns data matches on-chain within acceptable tolerance!');
    } else {
      console.log('⚠️  There is a discrepancy between our data and on-chain burns.');
      console.log('This could be due to:');
      console.log('1. LP fee burns that are included in totals but not in BuyAndBurn events');
      console.log('2. Direct burns from other sources');
      console.log('3. Timing differences in block processing');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

verifyBurnsSimple().catch(console.error);