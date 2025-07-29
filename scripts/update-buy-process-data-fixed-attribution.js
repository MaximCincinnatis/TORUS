#!/usr/bin/env node

/**
 * FIXED Buy & Process Data Updater
 * Fixes the date/protocol day attribution issue
 * 
 * ROOT CAUSE IDENTIFIED: The original script groups transactions by calendar date
 * but then assigns them to protocol days based on timestamp, causing misattribution.
 * 
 * FIX: Group transactions directly by protocol day from timestamp, not by calendar date.
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// RPC endpoints with fallbacks
const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.payload.de'
];

// Get working provider with fallback
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

// Retry wrapper for RPC calls
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

async function updateBuyProcessDataFixed() {
  console.log('💰 Updating Buy & Process data (FIXED: Accurate Protocol Day Attribution)...\n');
  
  try {
    const provider = await getProvider();
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    const TORUS_CONTRACT = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
    
    // Contract start date (6 PM UTC - actual protocol start time)
    const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
    
    // FIXED: Helper function to calculate protocol day from timestamp
    function getProtocolDay(timestamp) {
      const msPerDay = 24 * 60 * 60 * 1000;
      const dateObj = new Date(timestamp * 1000); // Always use timestamp directly
      const daysDiff = Math.floor((dateObj.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1;
      return Math.max(1, daysDiff);
    }
    
    // FIXED: Get protocol day date for a given protocol day number
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
    
    // Load existing data
    const dataPath = path.join(__dirname, '../public/data/buy-process-data.json');
    let existingData = null;
    let lastProcessedBlock = 22890272; // Contract deployment
    
    if (fs.existsSync(dataPath)) {
      existingData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      if (existingData.metadata?.lastBlock) {
        lastProcessedBlock = existingData.metadata.lastBlock;
      }
    }
    
    // Get current block with retry
    const currentBlock = await retryRPC(() => provider.getBlockNumber());
    console.log(`Updating from block ${lastProcessedBlock + 1} to ${currentBlock}`);
    
    if (currentBlock <= lastProcessedBlock) {
      console.log('No new blocks to process');
      return;
    }
    
    // Fetch new events
    const newBuyAndBurnEvents = [];
    const newBuyAndBuildEvents = [];
    const newFractalEvents = [];
    const newBurnTransfers = []; // Track actual TORUS burns to 0x0
    
    const chunkSize = 2000; // Reduced to avoid RPC limits
    for (let start = lastProcessedBlock + 1; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      
      try {
        const [burnEvents, buildEvents, fractals, torusBurns] = await retryRPC(() => Promise.all([
          buyProcessContract.queryFilter(buyProcessContract.filters.BuyAndBurn(), start, end),
          buyProcessContract.queryFilter(buyProcessContract.filters.BuyAndBuild(), start, end),
          buyProcessContract.queryFilter(buyProcessContract.filters.FractalFundsReleased(), start, end),
          // Get actual TORUS burns (transfers from Buy & Process to 0x0)
          torusContract.queryFilter(
            torusContract.filters.Transfer(
              BUY_PROCESS_CONTRACT,
              '0x0000000000000000000000000000000000000000'
            ),
            start,
            end
          )
        ]));
        
        newBuyAndBurnEvents.push(...burnEvents);
        newBuyAndBuildEvents.push(...buildEvents);
        newFractalEvents.push(...fractals);
        newBurnTransfers.push(...torusBurns);
      } catch (e) {
        console.log(`Error fetching blocks ${start}-${end}, skipping...`);
      }
    }
    
    console.log(`Found ${newBuyAndBurnEvents.length} new Buy & Burn events`);
    console.log(`Found ${newBuyAndBuildEvents.length} new Buy & Build events`);
    console.log(`Found ${newFractalEvents.length} new Fractal events`);
    console.log(`Found ${newBurnTransfers.length} new TORUS burn transfers to 0x0`);
    
    // Get block timestamps for new events
    const allBlocks = new Set([
      ...newBuyAndBurnEvents.map(e => e.blockNumber),
      ...newBuyAndBuildEvents.map(e => e.blockNumber),
      ...newFractalEvents.map(e => e.blockNumber),
      ...newBurnTransfers.map(e => e.blockNumber)
    ]);
    
    const blockTimestamps = new Map();
    const blockArray = Array.from(allBlocks);
    
    for (let i = 0; i < blockArray.length; i += 10) {
      const batch = blockArray.slice(i, i + 10);
      const promises = batch.map(async (blockNumber) => {
        const block = await provider.getBlock(blockNumber);
        return { blockNumber, timestamp: block.timestamp };
      });
      
      const results = await Promise.all(promises);
      results.forEach(({ blockNumber, timestamp }) => {
        blockTimestamps.set(blockNumber, timestamp);
      });
    }
    
    // FIXED: Process new events into protocol day data (not calendar date)
    const newDailyData = {};
    
    // First, process TORUS burn transfers to get accurate burn amounts by protocol day
    const burnsByProtocolDay = {};
    
    for (const transfer of newBurnTransfers) {
      const timestamp = blockTimestamps.get(transfer.blockNumber);
      const protocolDay = getProtocolDay(timestamp);
      
      if (!burnsByProtocolDay[protocolDay]) {
        burnsByProtocolDay[protocolDay] = ethers.BigNumber.from(0);
      }
      
      burnsByProtocolDay[protocolDay] = burnsByProtocolDay[protocolDay].add(transfer.args.value);
    }
    
    // Process Buy & Burn events (for counts and TitanX amounts)
    for (const event of newBuyAndBurnEvents) {
      const timestamp = blockTimestamps.get(event.blockNumber);
      const protocolDay = getProtocolDay(timestamp);
      const dateKey = getProtocolDayDate(protocolDay); // Use protocol day date, not transaction date
      
      if (!newDailyData[protocolDay]) {
        newDailyData[protocolDay] = {
          date: dateKey,
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
      
      newDailyData[protocolDay].buyAndBurnCount++;
      const titanXAmount = parseFloat(ethers.utils.formatEther(event.args.titanXAmount));
      newDailyData[protocolDay].titanXUsed += titanXAmount;
      newDailyData[protocolDay].titanXUsedForBurns += titanXAmount;
      
      // Check if this is an ETH burn and get actual ETH amount with retry
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
            newDailyData[protocolDay].ethUsed += ethAmount;
            newDailyData[protocolDay].ethUsedForBurns += ethAmount;
            
            console.log(`📊 ETH burn: ${ethAmount.toFixed(6)} ETH attributed to Protocol Day ${protocolDay} (tx: ${event.transactionHash})`);
          } else {
            console.log(`⚠️  No WETH deposit found for ETH burn tx ${event.transactionHash}`);
          }
        }
      } catch (e) {
        console.log(`⚠️  Failed to detect ETH for burn tx ${event.transactionHash}: ${e.message}`);
      }
    }
    
    // Set actual TORUS burned amounts from Transfer events
    for (const [protocolDay, burnAmount] of Object.entries(burnsByProtocolDay)) {
      const day = parseInt(protocolDay);
      const dateKey = getProtocolDayDate(day);
      
      if (!newDailyData[day]) {
        newDailyData[day] = {
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
        };
      }
      
      // Use actual burn amount from Transfer events
      newDailyData[day].torusBurned = parseFloat(ethers.utils.formatEther(burnAmount));
    }
    
    // Process Buy & Build events
    for (const event of newBuyAndBuildEvents) {
      const timestamp = blockTimestamps.get(event.blockNumber);
      const protocolDay = getProtocolDay(timestamp);
      const dateKey = getProtocolDayDate(protocolDay);
      
      if (!newDailyData[protocolDay]) {
        newDailyData[protocolDay] = {
          date: dateKey,
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
      
      newDailyData[protocolDay].buyAndBuildCount++;
      const torusPurchased = parseFloat(ethers.utils.formatEther(event.args.torusPurchased));
      newDailyData[protocolDay].torusPurchased += torusPurchased;
      
      // Check transaction type for builds with retry
      try {
        const tx = await retryRPC(() => provider.getTransaction(event.transactionHash));
        const functionSelector = tx.data.slice(0, 10);
        
        if (functionSelector === '0x53ad9b96') {
          // ETH build - check transaction value
          if (tx.value && !tx.value.isZero()) {
            const ethAmount = parseFloat(ethers.utils.formatEther(tx.value));
            newDailyData[protocolDay].ethUsed += ethAmount;
            newDailyData[protocolDay].ethUsedForBuilds += ethAmount;
          }
        } else {
          // TitanX build
          const titanXAmount = parseFloat(ethers.utils.formatEther(event.args.tokenAllocated));
          newDailyData[protocolDay].titanXUsed += titanXAmount;
          newDailyData[protocolDay].titanXUsedForBuilds += titanXAmount;
        }
      } catch (e) {
        // Default to TitanX if detection fails
        const titanXAmount = parseFloat(ethers.utils.formatEther(event.args.tokenAllocated));
        newDailyData[protocolDay].titanXUsed += titanXAmount;
        newDailyData[protocolDay].titanXUsedForBuilds += titanXAmount;
      }
    }
    
    // Process Fractal events
    for (const event of newFractalEvents) {
      const timestamp = blockTimestamps.get(event.blockNumber);
      const protocolDay = getProtocolDay(timestamp);
      const dateKey = getProtocolDayDate(protocolDay);
      
      if (!newDailyData[protocolDay]) {
        newDailyData[protocolDay] = {
          date: dateKey,
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
      
      newDailyData[protocolDay].fractalCount++;
      newDailyData[protocolDay].fractalTitanX += parseFloat(ethers.utils.formatEther(event.args.releasedTitanX));
      newDailyData[protocolDay].fractalETH += parseFloat(ethers.utils.formatEther(event.args.releasedETH));
    }
    
    // FIXED: Merge with existing data by protocol day, not date
    let mergedDailyData = existingData?.dailyData || [];
    const dailyDataMap = new Map();
    
    // Add existing data to map by protocol day
    mergedDailyData.forEach(day => {
      dailyDataMap.set(day.protocolDay, day);
    });
    
    // Merge new data by protocol day
    Object.entries(newDailyData).forEach(([protocolDay, data]) => {
      const day = parseInt(protocolDay);
      
      if (dailyDataMap.has(day)) {
        const existing = dailyDataMap.get(day);
        dailyDataMap.set(day, {
          ...existing,
          date: data.date, // Update date to match protocol day
          buyAndBurnCount: existing.buyAndBurnCount + data.buyAndBurnCount,
          buyAndBuildCount: existing.buyAndBuildCount + data.buyAndBuildCount,
          fractalCount: existing.fractalCount + data.fractalCount,
          torusBurned: existing.torusBurned + data.torusBurned,
          titanXUsed: existing.titanXUsed + data.titanXUsed,
          ethUsed: existing.ethUsed + data.ethUsed,
          titanXUsedForBurns: (existing.titanXUsedForBurns || 0) + (data.titanXUsedForBurns || 0),
          ethUsedForBurns: (existing.ethUsedForBurns || 0) + (data.ethUsedForBurns || 0),
          titanXUsedForBuilds: (existing.titanXUsedForBuilds || 0) + (data.titanXUsedForBuilds || 0),
          ethUsedForBuilds: (existing.ethUsedForBuilds || 0) + (data.ethUsedForBuilds || 0),
          torusPurchased: existing.torusPurchased + data.torusPurchased,
          fractalTitanX: existing.fractalTitanX + data.fractalTitanX,
          fractalETH: existing.fractalETH + data.fractalETH
        });
      } else {
        dailyDataMap.set(day, data);
      }
    });
    
    // Convert back to array and sort by protocol day
    mergedDailyData = Array.from(dailyDataMap.values()).sort((a, b) => a.protocolDay - b.protocolDay);
    
    // Ensure all protocol days have proper dates
    mergedDailyData.forEach(day => {
      if (!day.date || day.date === '') {
        day.date = getProtocolDayDate(day.protocolDay);
      }
    });
    
    // Get totals and current protocol day
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
    
    // Calculate actual total TORUS burnt from all transfer events
    const allBurnTransfers = [];
    for (let start = 22890272; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      try {
        const transfers = await torusContract.queryFilter(
          torusContract.filters.Transfer(
            BUY_PROCESS_CONTRACT,
            '0x0000000000000000000000000000000000000000'
          ),
          start,
          end
        );
        allBurnTransfers.push(...transfers);
      } catch (e) {
        console.log(`Error fetching total burns for blocks ${start}-${end}, skipping...`);
      }
    }
    
    let totalTorusBurnt = ethers.BigNumber.from(0);
    for (const transfer of allBurnTransfers) {
      totalTorusBurnt = totalTorusBurnt.add(transfer.args.value);
    }
    
    const currentDayNumber = Number(currentProtocolDay);
    console.log(`\n📅 Current protocol day from contract: ${currentDayNumber}`);
    
    // Fill in missing days up to current protocol day
    const lastDataDay = mergedDailyData.length > 0 
      ? Math.max(...mergedDailyData.map(d => d.protocolDay))
      : 0;
    
    if (lastDataDay < currentDayNumber) {
      console.log(`📊 Filling in missing days ${lastDataDay + 1} to ${currentDayNumber}`);
      
      for (let day = lastDataDay + 1; day <= currentDayNumber; day++) {
        const dateKey = getProtocolDayDate(day);
        
        // Only add if we don't already have data for this protocolDay
        if (!mergedDailyData.find(d => d.protocolDay === day)) {
          mergedDailyData.push({
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
      
      // Re-sort after adding missing days
      mergedDailyData.sort((a, b) => a.protocolDay - b.protocolDay);
    }
    
    // Update event counts
    const eventCounts = existingData?.eventCounts || { buyAndBurn: 0, buyAndBuild: 0, fractal: 0 };
    eventCounts.buyAndBurn += newBuyAndBurnEvents.length;
    eventCounts.buyAndBuild += newBuyAndBuildEvents.length;
    eventCounts.fractal += newFractalEvents.length;
    
    // Save updated data
    const outputData = {
      lastUpdated: new Date().toISOString(),
      currentDay: currentDayNumber,
      totals: {
        torusBurnt: ethers.utils.formatEther(totalTorusBurnt), // Use actual burn amount
        titanXBurnt: ethers.utils.formatEther(totalTitanXBurnt),
        ethBurn: ethers.utils.formatEther(totalETHBurn),
        titanXUsedForBurns: ethers.utils.formatEther(titanXUsedForBurns),
        ethUsedForBurns: ethers.utils.formatEther(ethUsedForBurns),
        ethUsedForBuilds: mergedDailyData.reduce((sum, day) => sum + (day.ethUsedForBuilds || 0), 0).toFixed(18)
      },
      dailyData: mergedDailyData,
      eventCounts: eventCounts,
      metadata: {
        lastBlock: currentBlock,
        fixApplied: "Protocol day attribution fix applied",
        fixDate: new Date().toISOString()
      }
    };
    
    // Create backup before saving
    if (existingData) {
      const backupPath = path.join(__dirname, '../public/data/backups/buy-process-data-before-fix.json');
      const backupDir = path.dirname(backupPath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      fs.writeFileSync(backupPath, JSON.stringify(existingData, null, 2));
      console.log('✅ Backup created before applying fix');
    }
    
    fs.writeFileSync(dataPath, JSON.stringify(outputData, null, 2));
    
    console.log(`\n✅ Buy & Process data updated successfully with FIXED attribution`);
    console.log(`📊 Total days with data: ${mergedDailyData.length}`);
    console.log(`🔥 Total TORUS burned (actual): ${ethers.utils.formatEther(totalTorusBurnt)} TORUS`);
    console.log(`🔧 Protocol day attribution fix applied`);
    
  } catch (error) {
    console.error('❌ Error updating Buy & Process data:', error);
    process.exit(1);
  }
}

// Run the update
updateBuyProcessDataFixed();