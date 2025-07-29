#!/usr/bin/env node

/**
 * Rebuild Buy & Process Data with Fixed Attribution
 * Rebuilds all historical data using correct protocol day attribution
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// RPC endpoints with fallbacks
const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function getProvider() {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(endpoint);
      await provider.getBlockNumber();
      console.log(`✅ Using RPC: ${endpoint}`);
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
      console.log(`RPC call failed, retry ${i + 1}/${retries}: ${e.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function rebuildBuyProcessData() {
  console.log('🔄 Rebuilding Buy & Process data with FIXED protocol day attribution...\n');
  
  try {
    const provider = await getProvider();
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    const TORUS_CONTRACT = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
    
    // Contract start date (6 PM UTC - actual protocol start time)
    const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
    
    // FIXED: Helper function to calculate protocol day from timestamp
    function getProtocolDay(timestamp) {
      const msPerDay = 24 * 60 * 60 * 1000;
      const dateObj = new Date(timestamp * 1000);
      const daysDiff = Math.floor((dateObj.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1;
      return Math.max(1, daysDiff);
    }
    
    // Get protocol day date for a given protocol day number
    function getProtocolDayDate(protocolDay) {
      const msPerDay = 24 * 60 * 60 * 1000;
      const dayStartTime = new Date(CONTRACT_START_DATE.getTime() + (protocolDay - 1) * msPerDay);
      return dayStartTime.toISOString().split('T')[0];
    }
    
    // Contract ABIs
    const buyProcessABI = [
      'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
      'event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)',
      'event FractalFundsReleased(uint256 releasedTitanX, uint256 releasedETH)',
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
    const STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
    const stakeContract = new ethers.Contract(STAKE_CONTRACT, stakeContractABI, provider);
    
    // Get current block
    const currentBlock = await retryRPC(() => provider.getBlockNumber());
    const startBlock = 22890272; // Contract deployment
    
    console.log(`Fetching ALL events from block ${startBlock} to ${currentBlock}`);
    console.log('This may take several minutes...\n');
    
    // Fetch ALL events from the beginning
    const allBuyAndBurnEvents = [];
    const allBuyAndBuildEvents = [];
    const allFractalEvents = [];
    const allBurnTransfers = [];
    
    const chunkSize = 2000;
    const totalChunks = Math.ceil((currentBlock - startBlock) / chunkSize);
    let chunkCount = 0;
    
    for (let start = startBlock; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      chunkCount++;
      
      console.log(`📊 Processing chunk ${chunkCount}/${totalChunks} (blocks ${start}-${end})`);
      
      try {
        const [burnEvents, buildEvents, fractals, torusBurns] = await retryRPC(() => Promise.all([
          buyProcessContract.queryFilter(buyProcessContract.filters.BuyAndBurn(), start, end),
          buyProcessContract.queryFilter(buyProcessContract.filters.BuyAndBuild(), start, end),
          buyProcessContract.queryFilter(buyProcessContract.filters.FractalFundsReleased(), start, end),
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
        allFractalEvents.push(...fractals);
        allBurnTransfers.push(...torusBurns);
        
        console.log(`  Found: ${burnEvents.length} burns, ${buildEvents.length} builds, ${fractals.length} fractals, ${torusBurns.length} burn transfers`);
        
      } catch (e) {
        console.log(`  ❌ Error fetching chunk ${start}-${end}, skipping...`);
      }
    }
    
    console.log(`\n📈 Total events fetched:`);
    console.log(`🔥 Buy & Burn events: ${allBuyAndBurnEvents.length}`);
    console.log(`🏗️  Buy & Build events: ${allBuyAndBuildEvents.length}`);
    console.log(`💎 Fractal events: ${allFractalEvents.length}`);
    console.log(`🔥 TORUS burn transfers: ${allBurnTransfers.length}\n`);
    
    // Get block timestamps for all events
    const allBlocks = new Set([
      ...allBuyAndBurnEvents.map(e => e.blockNumber),
      ...allBuyAndBuildEvents.map(e => e.blockNumber),
      ...allFractalEvents.map(e => e.blockNumber),
      ...allBurnTransfers.map(e => e.blockNumber)
    ]);
    
    console.log(`📅 Fetching timestamps for ${allBlocks.size} unique blocks...`);
    
    const blockTimestamps = new Map();
    const blockArray = Array.from(allBlocks);
    
    for (let i = 0; i < blockArray.length; i += 10) {
      const batch = blockArray.slice(i, i + 10);
      console.log(`  Timestamps batch ${Math.floor(i/10) + 1}/${Math.ceil(blockArray.length/10)}`);
      
      const promises = batch.map(async (blockNumber) => {
        const block = await provider.getBlock(blockNumber);
        return { blockNumber, timestamp: block.timestamp };
      });
      
      const results = await Promise.all(promises);
      results.forEach(({ blockNumber, timestamp }) => {
        blockTimestamps.set(blockNumber, timestamp);
      });
    }
    
    console.log(`\n✅ All timestamps fetched\n`);
    
    // Process events into protocol day data (FIXED attribution)
    const protocolDayData = {};
    
    console.log('🔄 Processing events with FIXED protocol day attribution...');
    
    // Process TORUS burn transfers by protocol day
    console.log('📊 Processing TORUS burn transfers...');
    for (const transfer of allBurnTransfers) {
      const timestamp = blockTimestamps.get(transfer.blockNumber);
      const protocolDay = getProtocolDay(timestamp);
      
      if (!protocolDayData[protocolDay]) {
        protocolDayData[protocolDay] = {
          date: getProtocolDayDate(protocolDay),
          protocolDay: protocolDay,
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
        };
      }
      
      const burnAmount = parseFloat(ethers.utils.formatEther(transfer.args.value));
      protocolDayData[protocolDay].torusBurned += burnAmount;
    }
    
    // Process Buy & Burn events
    console.log('🔥 Processing Buy & Burn events...');
    let ethBurnProcessed = 0;
    
    for (const event of allBuyAndBurnEvents) {
      const timestamp = blockTimestamps.get(event.blockNumber);
      const protocolDay = getProtocolDay(timestamp);
      
      if (!protocolDayData[protocolDay]) {
        protocolDayData[protocolDay] = {
          date: getProtocolDayDate(protocolDay),
          protocolDay: protocolDay,
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
        };
      }
      
      protocolDayData[protocolDay].buyAndBurnCount++;
      const titanXAmount = parseFloat(ethers.utils.formatEther(event.args.titanXAmount));
      protocolDayData[protocolDay].titanXUsed += titanXAmount;
      protocolDayData[protocolDay].titanXUsedForBurns += titanXAmount;
      
      // Check if this is an ETH burn and get actual ETH amount
      try {
        const tx = await retryRPC(() => provider.getTransaction(event.transactionHash));
        const functionSelector = tx.data.slice(0, 10);
        
        if (functionSelector === '0x39b6ce64') {
          // ETH burn - get WETH deposit amount
          const receipt = await retryRPC(() => provider.getTransactionReceipt(event.transactionHash));
          const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
          const depositTopic = ethers.utils.id('Deposit(address,uint256)');
          
          const wethDeposits = receipt.logs.filter(log => 
            log.address.toLowerCase() === WETH.toLowerCase() &&
            log.topics[0] === depositTopic
          );
          
          if (wethDeposits.length > 0) {
            const ethAmount = parseFloat(ethers.utils.formatEther(ethers.BigNumber.from(wethDeposits[0].data)));
            protocolDayData[protocolDay].ethUsed += ethAmount;
            protocolDayData[protocolDay].ethUsedForBurns += ethAmount;
            
            ethBurnProcessed++;
            if (ethBurnProcessed % 10 === 0) {
              console.log(`  Processed ${ethBurnProcessed} ETH burns...`);
            }
          }
        }
      } catch (e) {
        // Skip on error
      }
    }
    
    console.log(`✅ Processed ${ethBurnProcessed} ETH burn transactions`);
    
    // Process Buy & Build events
    console.log('🏗️  Processing Buy & Build events...');
    for (const event of allBuyAndBuildEvents) {
      const timestamp = blockTimestamps.get(event.blockNumber);
      const protocolDay = getProtocolDay(timestamp);
      
      if (!protocolDayData[protocolDay]) {
        protocolDayData[protocolDay] = {
          date: getProtocolDayDate(protocolDay),
          protocolDay: protocolDay,
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
        };
      }
      
      protocolDayData[protocolDay].buyAndBuildCount++;
      const torusPurchased = parseFloat(ethers.utils.formatEther(event.args.torusPurchased));
      protocolDayData[protocolDay].torusPurchased += torusPurchased;
      
      // Check transaction type for builds
      try {
        const tx = await retryRPC(() => provider.getTransaction(event.transactionHash));
        const functionSelector = tx.data.slice(0, 10);
        
        if (functionSelector === '0x53ad9b96') {
          // ETH build
          if (tx.value && !tx.value.isZero()) {
            const ethAmount = parseFloat(ethers.utils.formatEther(tx.value));
            protocolDayData[protocolDay].ethUsed += ethAmount;
            protocolDayData[protocolDay].ethUsedForBuilds += ethAmount;
          }
        } else {
          // TitanX build
          const titanXAmount = parseFloat(ethers.utils.formatEther(event.args.tokenAllocated));
          protocolDayData[protocolDay].titanXUsed += titanXAmount;
          protocolDayData[protocolDay].titanXUsedForBuilds += titanXAmount;
        }
      } catch (e) {
        // Default to TitanX if detection fails
        const titanXAmount = parseFloat(ethers.utils.formatEther(event.args.tokenAllocated));
        protocolDayData[protocolDay].titanXUsed += titanXAmount;
        protocolDayData[protocolDay].titanXUsedForBuilds += titanXAmount;
      }
    }
    
    // Process Fractal events
    console.log('💎 Processing Fractal events...');
    for (const event of allFractalEvents) {
      const timestamp = blockTimestamps.get(event.blockNumber);
      const protocolDay = getProtocolDay(timestamp);
      
      if (!protocolDayData[protocolDay]) {
        protocolDayData[protocolDay] = {
          date: getProtocolDayDate(protocolDay),
          protocolDay: protocolDay,
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
        };
      }
      
      protocolDayData[protocolDay].fractalCount++;
      protocolDayData[protocolDay].fractalTitanX += parseFloat(ethers.utils.formatEther(event.args.releasedTitanX));
      protocolDayData[protocolDay].fractalETH += parseFloat(ethers.utils.formatEther(event.args.releasedETH));
    }
    
    // Convert to array and sort
    const dailyData = Object.values(protocolDayData).sort((a, b) => a.protocolDay - b.protocolDay);
    
    // Get totals and current day
    console.log('\n📊 Getting totals from contracts...');
    const [
      totalTitanXBurnt,
      totalETHBurn,
      titanXUsedForBurns,
      ethUsedForBurns,
      currentProtocolDay
    ] = await Promise.all([
      buyProcessContract.totalTitanXBurnt(),
      buyProcessContract.totalETHBurn(),
      buyProcessContract.titanXUsedForBurns(),
      buyProcessContract.ethUsedForBurns(),
      stakeContract.getCurrentDayIndex()
    ]);
    
    // Calculate actual total TORUS burnt
    let totalTorusBurnt = ethers.BigNumber.from(0);
    for (const transfer of allBurnTransfers) {
      totalTorusBurnt = totalTorusBurnt.add(transfer.args.value);
    }
    
    const currentDayNumber = Number(currentProtocolDay);
    
    // Fill in missing days up to current protocol day
    const lastDataDay = dailyData.length > 0 
      ? Math.max(...dailyData.map(d => d.protocolDay))
      : 0;
    
    if (lastDataDay < currentDayNumber) {
      console.log(`📊 Filling in missing days ${lastDataDay + 1} to ${currentDayNumber}`);
      
      for (let day = lastDataDay + 1; day <= currentDayNumber; day++) {
        const dateKey = getProtocolDayDate(day);
        
        if (!dailyData.find(d => d.protocolDay === day)) {
          dailyData.push({
            date: dateKey,
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
      }
      
      dailyData.sort((a, b) => a.protocolDay - b.protocolDay);
    }
    
    // Create output data
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
        fractal: allFractalEvents.length
      },
      metadata: {
        lastBlock: currentBlock,
        rebuildDate: new Date().toISOString(),
        rebuildReason: "Fixed protocol day attribution - no longer groups by calendar date",
        totalEventsProcessed: allBuyAndBurnEvents.length + allBuyAndBuildEvents.length + allFractalEvents.length
      }
    };
    
    // Create backup and save
    const dataPath = path.join(__dirname, 'public/data/buy-process-data.json');
    const backupPath = path.join(__dirname, 'public/data/backups/buy-process-data-before-rebuild.json');
    
    // Create backup directory
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Backup existing file
    if (fs.existsSync(dataPath)) {
      fs.copyFileSync(dataPath, backupPath);
      console.log('✅ Backup created');
    }
    
    // Save new data
    fs.writeFileSync(dataPath, JSON.stringify(outputData, null, 2));
    
    console.log(`\n🎉 REBUILD COMPLETE!`);
    console.log(`📊 Total protocol days: ${dailyData.length}`);
    console.log(`🔥 Total TORUS burned: ${ethers.utils.formatEther(totalTorusBurnt)} TORUS`);
    console.log(`📈 Total events processed: ${outputData.metadata.totalEventsProcessed}`);
    console.log(`🔧 Protocol day attribution FIXED`);
    
    // Show Day 19 data for verification
    const day19Data = dailyData.find(d => d.protocolDay === 19);
    if (day19Data) {
      console.log(`\n✅ Day 19 FIXED data:`);
      console.log(`   Protocol Day: ${day19Data.protocolDay}`);
      console.log(`   Date: ${day19Data.date}`);
      console.log(`   ETH Used for Burns: ${day19Data.ethUsedForBurns}`);
      console.log(`   Buy & Burn Count: ${day19Data.buyAndBurnCount}`);
    }
    
  } catch (error) {
    console.error('❌ Error rebuilding data:', error);
    process.exit(1);
  }
}

rebuildBuyProcessData();