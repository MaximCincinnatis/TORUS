#!/usr/bin/env node

/**
 * Updates Buy & Process data incrementally
 * This script is called by the auto-update routine
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
// ETH tracking now done directly from events (BuyAndBuild.tokenAllocated)

// RPC endpoints
const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function updateBuyProcessData() {
  console.log('💰 Updating Buy & Process data...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    
    // Contract ABI
    const contractABI = [
      'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
      'event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)',
      'event FractalFundsReleased(uint256 releasedTitanX, uint256 releasedETH)',
      'function totalTorusBurnt() view returns (uint256)',
      'function totalTitanXBurnt() view returns (uint256)',
      'function totalETHBurn() view returns (uint256)',
      'function titanXUsedForBurns() view returns (uint256)',
      'function ethUsedForBurns() view returns (uint256)'
    ];
    
    const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, contractABI, provider);
    
    // Load existing data
    const dataPath = path.join(__dirname, '../public/data/buy-process-data.json');
    let existingData = null;
    let lastProcessedBlock = 22890272; // Contract deployment
    
    if (fs.existsSync(dataPath)) {
      existingData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      // Find the highest block number from existing events
      if (existingData.dailyData && existingData.dailyData.length > 0) {
        // Get last update block from metadata if available
        lastProcessedBlock = existingData.metadata?.lastBlock || 22890272;
      }
    }
    
    // Get current block
    const currentBlock = await provider.getBlockNumber();
    console.log(`Updating from block ${lastProcessedBlock + 1} to ${currentBlock}`);
    
    if (currentBlock <= lastProcessedBlock) {
      console.log('No new blocks to process');
      return;
    }
    
    // Fetch new events
    const newBuyAndBurnEvents = [];
    const newBuyAndBuildEvents = [];
    const newFractalEvents = [];
    
    const chunkSize = 5000;
    for (let start = lastProcessedBlock + 1; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      
      try {
        const [burnEvents, buildEvents, fractals] = await Promise.all([
          contract.queryFilter(contract.filters.BuyAndBurn(), start, end),
          contract.queryFilter(contract.filters.BuyAndBuild(), start, end),
          contract.queryFilter(contract.filters.FractalFundsReleased(), start, end)
        ]);
        
        newBuyAndBurnEvents.push(...burnEvents);
        newBuyAndBuildEvents.push(...buildEvents);
        newFractalEvents.push(...fractals);
      } catch (e) {
        console.log(`Error fetching blocks ${start}-${end}, skipping...`);
      }
    }
    
    console.log(`Found ${newBuyAndBurnEvents.length} new Buy & Burn events`);
    console.log(`Found ${newBuyAndBuildEvents.length} new Buy & Build events`);
    console.log(`Found ${newFractalEvents.length} new Fractal events`);
    
    // Get block timestamps for new events
    const allBlocks = new Set([
      ...newBuyAndBurnEvents.map(e => e.blockNumber),
      ...newBuyAndBuildEvents.map(e => e.blockNumber),
      ...newFractalEvents.map(e => e.blockNumber)
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
    
    // Process new events into daily data
    const newDailyData = {};
    
    // Process new Buy & Burn events
    newBuyAndBurnEvents.forEach(event => {
      const timestamp = blockTimestamps.get(event.blockNumber);
      const date = new Date(timestamp * 1000);
      const dateKey = date.toISOString().split('T')[0];
      
      if (!newDailyData[dateKey]) {
        newDailyData[dateKey] = {
          date: dateKey,
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
      
      newDailyData[dateKey].buyAndBurnCount++;
      newDailyData[dateKey].torusBurned += parseFloat(ethers.utils.formatEther(event.args.torusBurnt));
      const titanXAmount = parseFloat(ethers.utils.formatEther(event.args.titanXAmount));
      newDailyData[dateKey].titanXUsed += titanXAmount;
      newDailyData[dateKey].titanXUsedForBurns += titanXAmount;
    });
    
    // Process new Buy & Build events
    // Need to fetch transactions to determine if tokenAllocated is ETH or TitanX
    console.log('Processing Buy & Build events...');
    for (const event of newBuyAndBuildEvents) {
      const timestamp = blockTimestamps.get(event.blockNumber);
      const date = new Date(timestamp * 1000);
      const dateKey = date.toISOString().split('T')[0];
      
      if (!newDailyData[dateKey]) {
        newDailyData[dateKey] = {
          date: dateKey,
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
      
      newDailyData[dateKey].buyAndBuildCount++;
      newDailyData[dateKey].torusPurchased += parseFloat(ethers.utils.formatEther(event.args.torusPurchased));
      
      // Get transaction to determine if it's ETH or TitanX
      try {
        const tx = await provider.getTransaction(event.transactionHash);
        const functionSelector = tx.data.slice(0, 10);
        
        // Function selectors (CORRECTED):
        // swapETHForTorusAndBuild: 0x53ad9b96
        // swapTitanXForTorusAndBuild: 0xfc9b61ae
        const amount = parseFloat(ethers.utils.formatEther(event.args.tokenAllocated));
        
        if (functionSelector === '0x53ad9b96') {
          // ETH build
          newDailyData[dateKey].ethUsed += amount;
          newDailyData[dateKey].ethUsedForBuilds += amount;
        } else if (functionSelector === '0xfc9b61ae') {
          // TitanX build
          newDailyData[dateKey].titanXUsed += amount;
          newDailyData[dateKey].titanXUsedForBuilds += amount;
        } else {
          console.warn(`Unknown function selector for BuyAndBuild: ${functionSelector}`);
        }
      } catch (error) {
        console.error(`Error fetching transaction ${event.transactionHash}:`, error);
      }
    }
    
    // Process new Fractal events
    newFractalEvents.forEach(event => {
      const timestamp = blockTimestamps.get(event.blockNumber);
      const date = new Date(timestamp * 1000);
      const dateKey = date.toISOString().split('T')[0];
      
      if (!newDailyData[dateKey]) {
        newDailyData[dateKey] = {
          date: dateKey,
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
      
      newDailyData[dateKey].fractalCount++;
      newDailyData[dateKey].fractalTitanX += parseFloat(ethers.utils.formatEther(event.args.releasedTitanX));
      newDailyData[dateKey].fractalETH += parseFloat(ethers.utils.formatEther(event.args.releasedETH));
    });
    
    // Merge with existing daily data
    let mergedDailyData = existingData?.dailyData || [];
    
    // Convert to map for easier merging
    const dailyDataMap = new Map();
    mergedDailyData.forEach(day => dailyDataMap.set(day.date, day));
    
    // Add or update with new data
    Object.entries(newDailyData).forEach(([date, data]) => {
      if (dailyDataMap.has(date)) {
        // Merge with existing
        const existing = dailyDataMap.get(date);
        dailyDataMap.set(date, {
          date: date,
          buyAndBurnCount: existing.buyAndBurnCount + data.buyAndBurnCount,
          buyAndBuildCount: existing.buyAndBuildCount + data.buyAndBuildCount,
          fractalCount: existing.fractalCount + data.fractalCount,
          torusBurned: existing.torusBurned + data.torusBurned,
          titanXUsed: existing.titanXUsed + data.titanXUsed,
          ethUsed: existing.ethUsed + data.ethUsed,  // ETH from BuyAndBuild events
          titanXUsedForBurns: (existing.titanXUsedForBurns || 0) + (data.titanXUsedForBurns || 0),
          ethUsedForBurns: (existing.ethUsedForBurns || 0) + (data.ethUsedForBurns || 0),
          titanXUsedForBuilds: (existing.titanXUsedForBuilds || 0) + (data.titanXUsedForBuilds || 0),
          ethUsedForBuilds: (existing.ethUsedForBuilds || 0) + (data.ethUsedForBuilds || 0),
          torusPurchased: existing.torusPurchased + data.torusPurchased,
          fractalTitanX: existing.fractalTitanX + data.fractalTitanX,
          fractalETH: existing.fractalETH + data.fractalETH  // ETH from Fractal events
        });
      } else {
        dailyDataMap.set(date, data);
      }
    });
    
    // Convert back to array and sort
    mergedDailyData = Array.from(dailyDataMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    
    // Get updated totals from contract first (needed for ETH estimation)
    const [
      totalTorusBurnt,
      totalTitanXBurnt,
      totalETHBurn,
      titanXUsedForBurns,
      ethUsedForBurns
    ] = await Promise.all([
      contract.totalTorusBurnt(),
      contract.totalTitanXBurnt(),
      contract.totalETHBurn(),
      contract.titanXUsedForBurns(),
      contract.ethUsedForBurns()
    ]);
    
    // Note: ETH tracking is now done directly from events
    // - BuyAndBuild events include ETH in tokenAllocated parameter
    // - FractalFundsReleased events include ETH amounts
    // - BuyAndBurn events don't include ETH directly, handled separately
    
    // Update event counts
    const eventCounts = existingData?.eventCounts || { buyAndBurn: 0, buyAndBuild: 0, fractal: 0 };
    eventCounts.buyAndBurn += newBuyAndBurnEvents.length;
    eventCounts.buyAndBuild += newBuyAndBuildEvents.length;
    eventCounts.fractal += newFractalEvents.length;
    
    // Note: ETH validation - we're tracking ETH from BuyAndBuild events
    // The ethUsedForBurns contract value includes burn ETH which we don't track from events
    
    // Save updated data
    const outputData = {
      lastUpdated: new Date().toISOString(),
      totals: {
        torusBurnt: ethers.utils.formatEther(totalTorusBurnt),
        titanXBurnt: ethers.utils.formatEther(totalTitanXBurnt),
        ethBurn: ethers.utils.formatEther(totalETHBurn),
        titanXUsedForBurns: ethers.utils.formatEther(titanXUsedForBurns),
        ethUsedForBurns: ethers.utils.formatEther(ethUsedForBurns)
      },
      dailyData: mergedDailyData,
      eventCounts: eventCounts,
      metadata: {
        lastBlock: currentBlock
      }
    };
    
    fs.writeFileSync(dataPath, JSON.stringify(outputData, null, 2));
    
    console.log(`\n✅ Buy & Process data updated successfully`);
    console.log(`📊 Total days with data: ${mergedDailyData.length}`);
    
  } catch (error) {
    console.error('❌ Error updating Buy & Process data:', error);
    process.exit(1);
  }
}

// Run the update
updateBuyProcessData().catch(console.error);