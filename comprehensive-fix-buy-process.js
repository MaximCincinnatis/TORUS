#!/usr/bin/env node

/**
 * Comprehensive Fix for Buy & Process Data Issues
 * 
 * Issues addressed:
 * 1. Missing ETH detection on Day 19 (and other days)
 * 2. Incorrect protocol day attribution
 * 3. Missing events due to block range issues
 * 4. Silent failures in ETH detection
 * 
 * This script rebuilds all data from scratch with proper attribution
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function getProvider() {
  const endpoints = [
    'https://eth.drpc.org',
    'https://ethereum.publicnode.com',
    'https://eth.llamarpc.com',
    'https://rpc.payload.de'
  ];
  
  for (const endpoint of endpoints) {
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

async function retryRPC(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries - 1) throw e;
      console.log(`RPC retry ${i + 1}/${retries}: ${e.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function comprehensiveFix() {
  console.log('🔧 Comprehensive Buy & Process Data Fix Starting...\n');
  
  const provider = await getProvider();
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  const TORUS_CONTRACT = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
  const STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  // Contract start date
  const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
  
  // Helper to calculate protocol day from timestamp
  function getProtocolDay(timestamp) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const date = new Date(timestamp * 1000);
    return Math.max(1, Math.floor((date.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1);
  }
  
  // Helper to get protocol day date
  function getProtocolDayDate(protocolDay) {
    const dayStartTime = new Date(CONTRACT_START_DATE.getTime() + (protocolDay - 1) * 24 * 60 * 60 * 1000);
    return dayStartTime.toISOString().split('T')[0];
  }
  
  // Contract ABIs
  const buyProcessABI = [
    'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
    'event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)',
    'function totalTitanXBurnt() view returns (uint256)',
    'function totalETHBurn() view returns (uint256)',
    'function titanXUsedForBurns() view returns (uint256)',
    'function ethUsedForBurns() view returns (uint256)'
  ];
  
  const stakeContractABI = [
    'function getCurrentDayIndex() view returns (uint24)'
  ];
  
  const torusABI = [
    'event Transfer(address indexed from, address indexed to, uint256 value)'
  ];
  
  const buyProcessContract = new ethers.Contract(BUY_PROCESS_CONTRACT, buyProcessABI, provider);
  const torusContract = new ethers.Contract(TORUS_CONTRACT, torusABI, provider);
  const stakeContract = new ethers.Contract(STAKE_CONTRACT, stakeContractABI, provider);
  
  // Get current protocol day
  const currentProtocolDay = await retryRPC(() => stakeContract.getCurrentDayIndex());
  const currentDayNumber = Number(currentProtocolDay);
  console.log(`📅 Current protocol day: ${currentDayNumber}`);
  
  // Get current block
  const currentBlock = await retryRPC(() => provider.getBlockNumber());
  const deploymentBlock = 22890272;
  console.log(`📊 Processing blocks ${deploymentBlock} to ${currentBlock}`);
  
  // Fetch ALL events from deployment
  console.log('\n🔍 Fetching all events from contract deployment...');
  
  const allBuyAndBurnEvents = [];
  const allBuyAndBuildEvents = [];
  const allBurnTransfers = [];
  
  const chunkSize = 2000;
  let processedChunks = 0;
  const totalChunks = Math.ceil((currentBlock - deploymentBlock) / chunkSize);
  
  for (let start = deploymentBlock; start <= currentBlock; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, currentBlock);
    processedChunks++;
    
    console.log(`  Chunk ${processedChunks}/${totalChunks}: blocks ${start}-${end}`);
    
    try {
      const [burnEvents, buildEvents, torusBurns] = await retryRPC(() => Promise.all([
        buyProcessContract.queryFilter(buyProcessContract.filters.BuyAndBurn(), start, end),
        buyProcessContract.queryFilter(buyProcessContract.filters.BuyAndBuild(), start, end),
        torusContract.queryFilter(
          torusContract.filters.Transfer(
            BUY_PROCESS_CONTRACT,
            '0x0000000000000000000000000000000000000000'
          ),
          start,
          end
        )
      ]));
      
      allBuyAndBurnEvents.push(...burnEvents);
      allBuyAndBuildEvents.push(...buildEvents);
      allBurnTransfers.push(...torusBurns);
      
    } catch (e) {
      console.log(`  ❌ Error in chunk ${processedChunks}: ${e.message}`);
    }
  }
  
  console.log(`\n📊 Found events:`);
  console.log(`  - ${allBuyAndBurnEvents.length} BuyAndBurn events`);
  console.log(`  - ${allBuyAndBuildEvents.length} BuyAndBuild events`);
  console.log(`  - ${allBurnTransfers.length} TORUS burn transfers`);
  
  // Get unique block numbers and fetch timestamps
  console.log('\n⏰ Fetching block timestamps...');
  
  const allBlocks = new Set([
    ...allBuyAndBurnEvents.map(e => e.blockNumber),
    ...allBuyAndBuildEvents.map(e => e.blockNumber),
    ...allBurnTransfers.map(e => e.blockNumber)
  ]);
  
  const blockTimestamps = new Map();
  const blockArray = Array.from(allBlocks);
  
  // Fetch timestamps in batches
  for (let i = 0; i < blockArray.length; i += 10) {
    const batch = blockArray.slice(i, i + 10);
    const promises = batch.map(async (blockNumber) => {
      try {
        const block = await retryRPC(() => provider.getBlock(blockNumber));
        return { blockNumber, timestamp: block.timestamp };
      } catch (e) {
        console.log(`Failed to get block ${blockNumber}: ${e.message}`);
        return null;
      }
    });
    
    const results = await Promise.all(promises);
    results.forEach(result => {
      if (result) {
        blockTimestamps.set(result.blockNumber, result.timestamp);
      }
    });
  }
  
  console.log(`  ✅ Got timestamps for ${blockTimestamps.size} blocks`);
  
  // Initialize protocol day data
  const protocolDayData = new Map();
  
  // Create empty data for all protocol days
  for (let day = 1; day <= currentDayNumber; day++) {
    protocolDayData.set(day, {
      date: getProtocolDayDate(day),
      protocolDay: day,
      buyAndBurnCount: 0,
      buyAndBuildCount: 0,
      fractalCount: 0,
      torusBurned: 0,
      titanXUsed: 0,
      ethUsed: 0,
      titanXUsedForBurns: 0,
      ethUsedForBurns: 0,
      titanXUsedForBuilds: 0,
      ethUsedForBuilds: 0,
      torusPurchased: 0,
      fractalTitanX: 0,
      fractalETH: 0
    });
  }
  
  // Process TORUS burns by protocol day
  console.log('\n🔥 Processing TORUS burn transfers...');
  for (const transfer of allBurnTransfers) {
    const timestamp = blockTimestamps.get(transfer.blockNumber);
    if (!timestamp) continue;
    
    const protocolDay = getProtocolDay(timestamp);
    if (protocolDayData.has(protocolDay)) {
      const dayData = protocolDayData.get(protocolDay);
      dayData.torusBurned += parseFloat(ethers.utils.formatEther(transfer.args.value));
    }
  }
  
  // Enhanced ETH detection function
  async function detectETHUsage(event, provider) {
    try {
      const tx = await retryRPC(() => provider.getTransaction(event.transactionHash));
      const receipt = await retryRPC(() => provider.getTransactionReceipt(event.transactionHash));
      
      const functionSelector = tx.data.slice(0, 10);
      
      // ETH burn detection
      if (functionSelector === '0x39b6ce64') {
        const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
        const depositTopic = ethers.utils.id('Deposit(address,uint256)');
        
        const wethDeposits = receipt.logs.filter(log => 
          log.address.toLowerCase() === WETH.toLowerCase() &&
          log.topics[0] === depositTopic
        );
        
        if (wethDeposits.length > 0) {
          const ethAmount = parseFloat(ethers.utils.formatEther(ethers.BigNumber.from(wethDeposits[0].data)));
          return { type: 'burn', ethAmount, success: true };
        }
      }
      
      // ETH build detection  
      if (functionSelector === '0x53ad9b96') {
        if (tx.value && !tx.value.isZero()) {
          const ethAmount = parseFloat(ethers.utils.formatEther(tx.value));
          return { type: 'build', ethAmount, success: true };
        }
      }
      
      return { type: null, ethAmount: 0, success: true };
    } catch (e) {
      console.log(`ETH detection failed for tx ${event.transactionHash}: ${e.message}`);
      return { type: null, ethAmount: 0, success: false };
    }
  }
  
  // Process Buy & Burn events with ETH detection
  console.log('\n💰 Processing BuyAndBurn events with ETH detection...');
  let ethDetectionFailures = 0;
  
  for (const event of allBuyAndBurnEvents) {
    const timestamp = blockTimestamps.get(event.blockNumber);
    if (!timestamp) continue;
    
    const protocolDay = getProtocolDay(timestamp);
    if (!protocolDayData.has(protocolDay)) continue;
    
    const dayData = protocolDayData.get(protocolDay);
    dayData.buyAndBurnCount++;
    
    const titanXAmount = parseFloat(ethers.utils.formatEther(event.args.titanXAmount));
    dayData.titanXUsed += titanXAmount;
    dayData.titanXUsedForBurns += titanXAmount;
    
    // Detect ETH usage
    const ethInfo = await detectETHUsage(event, provider);
    if (ethInfo.success && ethInfo.type === 'burn' && ethInfo.ethAmount > 0) {
      dayData.ethUsed += ethInfo.ethAmount;
      dayData.ethUsedForBurns += ethInfo.ethAmount;
    } else if (!ethInfo.success) {
      ethDetectionFailures++;
    }
  }
  
  // Process Buy & Build events with ETH detection
  console.log('\n🏗️  Processing BuyAndBuild events with ETH detection...');
  
  for (const event of allBuyAndBuildEvents) {
    const timestamp = blockTimestamps.get(event.blockNumber);
    if (!timestamp) continue;
    
    const protocolDay = getProtocolDay(timestamp);
    if (!protocolDayData.has(protocolDay)) continue;
    
    const dayData = protocolDayData.get(protocolDay);
    dayData.buyAndBuildCount++;
    
    const torusPurchased = parseFloat(ethers.utils.formatEther(event.args.torusPurchased));
    dayData.torusPurchased += torusPurchased;
    
    // Detect transaction type
    const ethInfo = await detectETHUsage(event, provider);
    if (ethInfo.success && ethInfo.type === 'build' && ethInfo.ethAmount > 0) {
      dayData.ethUsed += ethInfo.ethAmount;
      dayData.ethUsedForBuilds += ethInfo.ethAmount;
    } else {
      // TitanX build
      const titanXAmount = parseFloat(ethers.utils.formatEther(event.args.tokenAllocated));
      dayData.titanXUsed += titanXAmount;
      dayData.titanXUsedForBuilds += titanXAmount;
    }
    
    if (!ethInfo.success) {
      ethDetectionFailures++;
    }
  }
  
  console.log(`⚠️  ETH detection failures: ${ethDetectionFailures}`);
  
  // Get contract totals
  console.log('\n📈 Getting contract totals...');
  const [
    totalTitanXBurnt,
    totalETHBurn,
    titanXUsedForBurns,
    ethUsedForBurns
  ] = await retryRPC(() => Promise.all([
    buyProcessContract.totalTitanXBurnt(),
    buyProcessContract.totalETHBurn(),
    buyProcessContract.titanXUsedForBurns(),
    buyProcessContract.ethUsedForBurns()
  ]));
  
  // Calculate total TORUS burned from transfers
  let totalTorusBurnt = ethers.BigNumber.from(0);
  for (const transfer of allBurnTransfers) {
    totalTorusBurnt = totalTorusBurnt.add(transfer.args.value);
  }
  
  // Create final data structure
  const dailyData = Array.from(protocolDayData.values()).sort((a, b) => a.protocolDay - b.protocolDay);
  
  const outputData = {
    lastUpdated: new Date().toISOString(),
    currentDay: currentDayNumber,
    totals: {
      torusBurnt: ethers.utils.formatEther(totalTorusBurnt),
      titanXBurnt: ethers.utils.formatEther(totalTitanXBurnt),
      ethBurn: ethers.utils.formatEther(totalETHBurn),
      titanXUsedForBurns: ethers.utils.formatEther(titanXUsedForBurns),
      ethUsedForBurns: ethers.utils.formatEther(ethUsedForBurns),
      ethUsedForBuilds: dailyData.reduce((sum, day) => sum + (day.ethUsedForBuilds || 0), 0).toFixed(18)
    },
    dailyData: dailyData,
    eventCounts: {
      buyAndBurn: allBuyAndBurnEvents.length,
      buyAndBuild: allBuyAndBuildEvents.length,
      fractal: 0
    },
    metadata: {
      lastBlock: currentBlock,
      comprehensiveFixApplied: true,
      fixTimestamp: new Date().toISOString(),
      ethDetectionFailures: ethDetectionFailures
    }
  };
  
  // Backup existing data
  const dataPath = path.join(__dirname, 'public/data/buy-process-data.json');
  if (fs.existsSync(dataPath)) {
    const backupPath = path.join(__dirname, `public/data/buy-process-data-backup-${Date.now()}.json`);
    fs.copyFileSync(dataPath, backupPath);
    console.log(`💾 Backup created: ${backupPath}`);
  }
  
  // Save new data
  fs.writeFileSync(dataPath, JSON.stringify(outputData, null, 2));
  
  console.log('\n✅ Comprehensive fix completed!');
  console.log(`📊 Total days: ${dailyData.length}`);
  console.log(`🔥 Total TORUS burned: ${ethers.utils.formatEther(totalTorusBurnt)} TORUS`);
  console.log(`⚡ Total ETH failures: ${ethDetectionFailures}`);
  
  // Validate Day 19 specifically
  const day19 = dailyData.find(d => d.protocolDay === 19);
  if (day19) {
    console.log('\n📊 Day 19 Validation:');
    console.log(`  BuyAndBurn: ${day19.buyAndBurnCount} events`);
    console.log(`  BuyAndBuild: ${day19.buyAndBuildCount} events`);
    console.log(`  ETH for burns: ${day19.ethUsedForBurns} ETH`);
    console.log(`  ETH for builds: ${day19.ethUsedForBuilds} ETH`);
    console.log(`  TitanX for burns: ${(day19.titanXUsedForBurns / 1e9).toFixed(2)}B`);
    console.log(`  TitanX for builds: ${(day19.titanXUsedForBuilds / 1e9).toFixed(2)}B`);
  }
}

comprehensiveFix().catch(console.error);