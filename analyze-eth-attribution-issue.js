#!/usr/bin/env node

/**
 * Analyze ETH Attribution Issue
 * Investigates why cached data shows more ETH than actual Day 19 burns
 */

const { ethers } = require('ethers');
const fs = require('fs');

// Contract addresses
const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
const WETH_CONTRACT = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

// RPC endpoints
const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com'
];

async function getProvider() {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(endpoint);
      await provider.getBlockNumber();
      return provider;
    } catch (e) {
      continue;
    }
  }
  throw new Error('No working RPC providers available');
}

// Helper function to calculate protocol day from timestamp
function getProtocolDay(timestamp) {
  const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
  const msPerDay = 24 * 60 * 60 * 1000;
  let dateObj;
  
  if (typeof timestamp === 'number') {
    dateObj = new Date(timestamp * 1000);
  } else {
    dateObj = timestamp;
  }
  
  const daysDiff = Math.floor((dateObj.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1;
  return Math.max(1, daysDiff);
}

async function analyzeETHAttributionIssue() {
  console.log('🔍 Analyzing ETH Attribution Issue\n');
  
  try {
    const provider = await getProvider();
    
    // Expand search to include day boundaries (Day 18-20)
    const day18Start = new Date('2025-07-27T18:00:00.000Z');
    const day20End = new Date('2025-07-30T18:00:00.000Z');
    
    console.log(`Extended time range: ${day18Start.toISOString()} to ${day20End.toISOString()}`);
    
    // Get block numbers for this range
    const startTimestamp = Math.floor(day18Start.getTime() / 1000);
    const endTimestamp = Math.floor(day20End.getTime() / 1000);
    
    const currentBlock = await provider.getBlockNumber();
    const currentBlockData = await provider.getBlock(currentBlock);
    const currentTimestamp = currentBlockData.timestamp;
    
    const blocksPerSecond = 1 / 12;
    const startBlock = Math.floor(currentBlock - (currentTimestamp - startTimestamp) * blocksPerSecond);
    const endBlock = Math.floor(currentBlock - (currentTimestamp - endTimestamp) * blocksPerSecond);
    
    console.log(`Block range: ${startBlock} to ${endBlock}\n`);
    
    // Get Buy & Process contract events
    const buyProcessABI = [
      'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)'
    ];
    
    const buyProcessContract = new ethers.Contract(BUY_PROCESS_CONTRACT, buyProcessABI, provider);
    
    console.log('Fetching BuyAndBurn events for Days 18-20...');
    const burnEvents = await buyProcessContract.queryFilter(
      buyProcessContract.filters.BuyAndBurn(),
      startBlock,
      endBlock
    );
    
    console.log(`Found ${burnEvents.length} BuyAndBurn events\n`);
    
    // Group events by protocol day and analyze ETH detection
    const dayData = {};
    
    for (const event of burnEvents) {
      const tx = await provider.getTransaction(event.transactionHash);
      const receipt = await provider.getTransactionReceipt(event.transactionHash);
      const block = await provider.getBlock(event.blockNumber);
      
      const blockTimestamp = block.timestamp;
      const protocolDay = getProtocolDay(blockTimestamp);
      const blockDate = new Date(blockTimestamp * 1000);
      
      if (!dayData[protocolDay]) {
        dayData[protocolDay] = {
          events: [],
          totalETH: 0,
          ethBurnCount: 0
        };
      }
      
      let ethAmount = 0;
      let isETHBurn = false;
      
      // Check if this is an ETH burn transaction
      const functionSelector = tx.data.slice(0, 10);
      if (functionSelector === '0x39b6ce64') {
        isETHBurn = true;
        
        // Look for WETH deposit events
        const depositTopic = ethers.utils.id('Deposit(address,uint256)');
        const wethDeposits = receipt.logs.filter(log => 
          log.address.toLowerCase() === WETH_CONTRACT.toLowerCase() &&
          log.topics[0] === depositTopic
        );
        
        if (wethDeposits.length > 0) {
          ethAmount = parseFloat(ethers.utils.formatEther(ethers.BigNumber.from(wethDeposits[0].data)));
          dayData[protocolDay].totalETH += ethAmount;
          dayData[protocolDay].ethBurnCount++;
        }
      }
      
      dayData[protocolDay].events.push({
        txHash: event.transactionHash,
        block: event.blockNumber,
        timestamp: blockTimestamp,
        date: blockDate.toISOString(),
        isETHBurn,
        ethAmount,
        titanXAmount: parseFloat(ethers.utils.formatEther(event.args.titanXAmount)),
        torusBurnt: parseFloat(ethers.utils.formatEther(event.args.torusBurnt))
      });
    }
    
    // Display results by protocol day
    console.log('=== ETH ATTRIBUTION BY PROTOCOL DAY ===\n');
    
    for (const [day, data] of Object.entries(dayData).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
      console.log(`--- Protocol Day ${day} ---`);
      console.log(`Events: ${data.events.length}`);
      console.log(`ETH Burns: ${data.ethBurnCount}`);
      console.log(`Total ETH: ${data.totalETH.toFixed(6)} ETH`);
      
      // Show ETH burn transactions for this day
      const ethBurns = data.events.filter(e => e.isETHBurn);
      if (ethBurns.length > 0) {
        console.log('ETH Burn Transactions:');
        ethBurns.forEach(burn => {
          console.log(`  ${burn.txHash}: ${burn.ethAmount.toFixed(6)} ETH at ${burn.date}`);
        });
      }
      console.log('');
    }
    
    // Compare with cached data
    const buyProcessData = JSON.parse(fs.readFileSync('./public/data/buy-process-data.json', 'utf8'));
    
    console.log('=== COMPARISON WITH CACHED DATA ===\n');
    
    for (const [day, data] of Object.entries(dayData).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
      const cachedDay = buyProcessData.dailyData.find(d => d.protocolDay === parseInt(day));
      
      if (cachedDay) {
        const difference = Math.abs(data.totalETH - cachedDay.ethUsedForBurns);
        console.log(`Day ${day}:`);
        console.log(`  Detected: ${data.totalETH.toFixed(6)} ETH`);
        console.log(`  Cached: ${cachedDay.ethUsedForBurns} ETH`);
        
        if (difference > 0.000001) {
          console.log(`  ⚠️  Difference: ${difference.toFixed(6)} ETH`);
        } else {
          console.log(`  ✅ Match`);
        }
        console.log('');
      }
    }
    
    // Specifically focus on Day 19 discrepancy
    if (dayData[19]) {
      console.log('=== DAY 19 DETAILED ANALYSIS ===');
      console.log(`Protocol Day 19 detected ETH: ${dayData[19].totalETH.toFixed(6)} ETH`);
      
      const cachedDay19 = buyProcessData.dailyData.find(d => d.protocolDay === 19);
      if (cachedDay19) {
        console.log(`Cached Day 19 ETH: ${cachedDay19.ethUsedForBurns} ETH`);
        console.log(`Missing ETH: ${(cachedDay19.ethUsedForBurns - dayData[19].totalETH).toFixed(6)} ETH`);
        
        console.log('\nPossible causes:');
        console.log('1. Transaction attributed to Day 19 but occurred outside protocol day boundaries');
        console.log('2. Data update script using different date calculation than our audit');
        console.log('3. Historical update that merged data incorrectly');
        console.log('4. WETH detection difference in update script vs audit script');
      }
    }
    
  } catch (error) {
    console.error('❌ Error during analysis:', error);
  }
}

analyzeETHAttributionIssue();