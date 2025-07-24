#!/usr/bin/env node

/**
 * Updates Buy & Process data to track burns and builds separately
 * This fixes the issue where titanXUsed and ethUsed aggregate both operations
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// RPC endpoints
const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function fixBuyProcessTracking() {
  console.log('🔧 Fixing Buy & Process data tracking...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    
    // Contract ABI
    const contractABI = [
      'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
      'event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)',
      'event FractalFundsReleased(uint256 releasedTitanX, uint256 releasedETH)'
    ];
    
    const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, contractABI, provider);
    
    // Load existing data
    const dataPath = path.join(__dirname, '../public/data/buy-process-data.json');
    const existingData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    console.log('Re-fetching all events to properly separate burns and builds...');
    
    // Fetch all events from contract deployment
    const deployBlock = 22890272;
    const currentBlock = await provider.getBlockNumber();
    
    const allBuyAndBurnEvents = [];
    const allBuyAndBuildEvents = [];
    const allFractalEvents = [];
    
    const chunkSize = 5000;
    for (let start = deployBlock; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      console.log(`Fetching blocks ${start}-${end}...`);
      
      try {
        const [burnEvents, buildEvents, fractals] = await Promise.all([
          contract.queryFilter(contract.filters.BuyAndBurn(), start, end),
          contract.queryFilter(contract.filters.BuyAndBuild(), start, end),
          contract.queryFilter(contract.filters.FractalFundsReleased(), start, end)
        ]);
        
        allBuyAndBurnEvents.push(...burnEvents);
        allBuyAndBuildEvents.push(...buildEvents);
        allFractalEvents.push(...fractals);
      } catch (e) {
        console.log(`Error fetching blocks ${start}-${end}, skipping...`);
      }
    }
    
    console.log(`Found ${allBuyAndBurnEvents.length} Buy & Burn events`);
    console.log(`Found ${allBuyAndBuildEvents.length} Buy & Build events`);
    console.log(`Found ${allFractalEvents.length} Fractal events`);
    
    // Get block timestamps
    const allBlocks = new Set([
      ...allBuyAndBurnEvents.map(e => e.blockNumber),
      ...allBuyAndBuildEvents.map(e => e.blockNumber),
      ...allFractalEvents.map(e => e.blockNumber)
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
    
    // Process events into daily data with proper separation
    const dailyData = {};
    
    // Process Buy & Burn events
    allBuyAndBurnEvents.forEach(event => {
      const timestamp = blockTimestamps.get(event.blockNumber);
      const date = new Date(timestamp * 1000);
      const dateKey = date.toISOString().split('T')[0];
      
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {
          date: dateKey,
          buyAndBurnCount: 0,
          buyAndBuildCount: 0,
          fractalCount: 0,
          torusBurned: 0,
          titanXUsed: 0,          // Total for backward compatibility
          ethUsed: 0,             // Total for backward compatibility
          titanXUsedForBurns: 0,  // NEW: Burn-specific
          ethUsedForBurns: 0,     // NEW: Burn-specific
          titanXUsedForBuilds: 0, // NEW: Build-specific
          ethUsedForBuilds: 0,    // NEW: Build-specific
          torusPurchased: 0,
          fractalTitanX: 0,
          fractalETH: 0
        };
      }
      
      dailyData[dateKey].buyAndBurnCount++;
      dailyData[dateKey].torusBurned += parseFloat(ethers.utils.formatEther(event.args.torusBurnt));
      const titanXAmount = parseFloat(ethers.utils.formatEther(event.args.titanXAmount));
      dailyData[dateKey].titanXUsedForBurns += titanXAmount;
      dailyData[dateKey].titanXUsed += titanXAmount; // Also add to total
    });
    
    // Process Buy & Build events
    console.log('Processing Buy & Build events to determine ETH vs TitanX...');
    for (const event of allBuyAndBuildEvents) {
      const timestamp = blockTimestamps.get(event.blockNumber);
      const date = new Date(timestamp * 1000);
      const dateKey = date.toISOString().split('T')[0];
      
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {
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
      
      dailyData[dateKey].buyAndBuildCount++;
      dailyData[dateKey].torusPurchased += parseFloat(ethers.utils.formatEther(event.args.torusPurchased));
      
      // Get transaction to determine if it's ETH or TitanX
      try {
        const tx = await provider.getTransaction(event.transactionHash);
        const functionSelector = tx.data.slice(0, 10);
        
        // Function selectors:
        // swapETHForTorusAndBuild: 0x53ad9b96
        // swapTitanXForTorusAndBuild: 0xfc9b61ae
        const amount = parseFloat(ethers.utils.formatEther(event.args.tokenAllocated));
        
        if (functionSelector === '0x53ad9b96') {
          // ETH build
          dailyData[dateKey].ethUsedForBuilds += amount;
          dailyData[dateKey].ethUsed += amount; // Also add to total
        } else if (functionSelector === '0xfc9b61ae') {
          // TitanX build
          dailyData[dateKey].titanXUsedForBuilds += amount;
          dailyData[dateKey].titanXUsed += amount; // Also add to total
        }
      } catch (error) {
        console.error(`Error fetching transaction ${event.transactionHash}:`, error);
      }
    }
    
    // Process Fractal events
    allFractalEvents.forEach(event => {
      const timestamp = blockTimestamps.get(event.blockNumber);
      const date = new Date(timestamp * 1000);
      const dateKey = date.toISOString().split('T')[0];
      
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {
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
      
      dailyData[dateKey].fractalCount++;
      dailyData[dateKey].fractalTitanX += parseFloat(ethers.utils.formatEther(event.args.releasedTitanX));
      dailyData[dateKey].fractalETH += parseFloat(ethers.utils.formatEther(event.args.releasedETH));
    });
    
    // Convert to array and sort
    const dailyDataArray = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
    
    // Calculate totals
    const totals = {
      torusBurnt: existingData.totals.torusBurnt,
      titanXBurnt: existingData.totals.titanXBurnt,
      ethBurn: existingData.totals.ethBurn,
      titanXUsedForBurns: existingData.totals.titanXUsedForBurns,
      ethUsedForBurns: existingData.totals.ethUsedForBurns,
      // Add build-specific totals
      titanXUsedForBuilds: dailyDataArray.reduce((sum, day) => sum + day.titanXUsedForBuilds, 0).toFixed(18),
      ethUsedForBuilds: dailyDataArray.reduce((sum, day) => sum + day.ethUsedForBuilds, 0).toFixed(18)
    };
    
    // Save updated data
    const outputData = {
      lastUpdated: new Date().toISOString(),
      totals: totals,
      dailyData: dailyDataArray,
      eventCounts: {
        buyAndBurn: allBuyAndBurnEvents.length,
        buyAndBuild: allBuyAndBuildEvents.length,
        fractal: allFractalEvents.length
      },
      metadata: {
        lastBlock: currentBlock
      }
    };
    
    fs.writeFileSync(dataPath, JSON.stringify(outputData, null, 2));
    
    console.log(`\n✅ Fixed Buy & Process data tracking`);
    console.log(`📊 Total days with data: ${dailyDataArray.length}`);
    console.log(`\nBurn vs Build breakdown:`);
    console.log(`- TitanX for Burns: ${(parseFloat(totals.titanXUsedForBurns) / 1e9).toFixed(2)}B`);
    console.log(`- TitanX for Builds: ${(parseFloat(totals.titanXUsedForBuilds) / 1e9).toFixed(2)}B`);
    console.log(`- ETH for Burns: ${parseFloat(totals.ethUsedForBurns).toFixed(4)}`);
    console.log(`- ETH for Builds: ${parseFloat(totals.ethUsedForBuilds).toFixed(4)}`);
    
  } catch (error) {
    console.error('❌ Error fixing Buy & Process data:', error);
    process.exit(1);
  }
}

// Run the fix
fixBuyProcessTracking().catch(console.error);