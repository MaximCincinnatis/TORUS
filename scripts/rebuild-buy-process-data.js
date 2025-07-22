#!/usr/bin/env node

/**
 * Rebuilds Buy & Process data from scratch with proper ETH tracking
 * This script correctly distinguishes between ETH and TitanX in BuyAndBuild events
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

async function rebuildBuyProcessData() {
  console.log('🔨 Rebuilding Buy & Process data from scratch...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    const DEPLOYMENT_BLOCK = 22890272; // Contract deployment block
    
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
    
    // Get current block
    const currentBlock = await provider.getBlockNumber();
    console.log(`Fetching events from block ${DEPLOYMENT_BLOCK} to ${currentBlock}`);
    
    // Fetch all events
    const buyAndBurnEvents = [];
    const buyAndBuildEvents = [];
    const fractalEvents = [];
    
    const chunkSize = 5000;
    for (let start = DEPLOYMENT_BLOCK; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      console.log(`Fetching blocks ${start}-${end}...`);
      
      try {
        const [burnEvents, buildEvents, fractals] = await Promise.all([
          contract.queryFilter(contract.filters.BuyAndBurn(), start, end),
          contract.queryFilter(contract.filters.BuyAndBuild(), start, end),
          contract.queryFilter(contract.filters.FractalFundsReleased(), start, end)
        ]);
        
        buyAndBurnEvents.push(...burnEvents);
        buyAndBuildEvents.push(...buildEvents);
        fractalEvents.push(...fractals);
      } catch (e) {
        console.log(`Error fetching blocks ${start}-${end}, skipping...`);
      }
    }
    
    console.log(`\nFound ${buyAndBurnEvents.length} Buy & Burn events`);
    console.log(`Found ${buyAndBuildEvents.length} Buy & Build events`);
    console.log(`Found ${fractalEvents.length} Fractal events`);
    
    // Get block timestamps
    const allBlocks = new Set([
      ...buyAndBurnEvents.map(e => e.blockNumber),
      ...buyAndBuildEvents.map(e => e.blockNumber),
      ...fractalEvents.map(e => e.blockNumber)
    ]);
    
    const blockTimestamps = new Map();
    const blockArray = Array.from(allBlocks);
    
    console.log('\nFetching block timestamps...');
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
    
    // Process events into daily data
    const dailyData = {};
    
    // Process Buy & Burn events - need to check if ETH or TitanX was used
    console.log('\nProcessing Buy & Burn events and checking transaction types...');
    let ethBurnCount = 0;
    let titanXBurnCount = 0;
    
    for (const event of buyAndBurnEvents) {
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
          torusPurchased: 0,
          fractalTitanX: 0,
          fractalETH: 0
        };
      }
      
      dailyData[dateKey].buyAndBurnCount++;
      dailyData[dateKey].torusBurned += parseFloat(ethers.utils.formatEther(event.args.torusBurnt));
      
      // Get transaction to determine if it's ETH or TitanX burn
      try {
        const tx = await provider.getTransaction(event.transactionHash);
        const functionSelector = tx.data.slice(0, 10);
        
        // Function selectors:
        // swapETHForTorusAndBurn: 0x39b6ce64
        // swapTitanXForTorusAndBurn: 0xd6d315a4
        if (functionSelector === '0x39b6ce64') {
          // ETH burn - we need to track this ETH somehow
          // The event only shows titanXAmount, not the original ETH
          // For now, just count it
          ethBurnCount++;
        } else if (functionSelector === '0xd6d315a4') {
          // TitanX burn
          dailyData[dateKey].titanXUsed += parseFloat(ethers.utils.formatEther(event.args.titanXAmount));
          titanXBurnCount++;
        } else {
          console.warn(`Unknown burn function: ${functionSelector}`);
          // Default to TitanX
          dailyData[dateKey].titanXUsed += parseFloat(ethers.utils.formatEther(event.args.titanXAmount));
        }
      } catch (error) {
        console.error(`Error fetching transaction ${event.transactionHash}:`, error);
        // Default to TitanX
        dailyData[dateKey].titanXUsed += parseFloat(ethers.utils.formatEther(event.args.titanXAmount));
      }
    }
    
    console.log(`  ETH burns: ${ethBurnCount}`);
    console.log(`  TitanX burns: ${titanXBurnCount}`);
    
    // Process Buy & Build events with proper ETH/TitanX distinction
    console.log('\nProcessing Buy & Build events and checking transaction types...');
    let ethBuilds = 0;
    let titanXBuilds = 0;
    
    for (const event of buyAndBuildEvents) {
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
        
        // Function selectors (CORRECTED):
        // swapETHForTorusAndBuild: 0x53ad9b96
        // swapTitanXForTorusAndBuild: 0xfc9b61ae
        if (functionSelector === '0x53ad9b96') {
          // ETH build
          dailyData[dateKey].ethUsed += parseFloat(ethers.utils.formatEther(event.args.tokenAllocated));
          ethBuilds++;
        } else if (functionSelector === '0xfc9b61ae') {
          // TitanX build
          dailyData[dateKey].titanXUsed += parseFloat(ethers.utils.formatEther(event.args.tokenAllocated));
          titanXBuilds++;
        } else {
          console.warn(`Unknown function selector for BuyAndBuild: ${functionSelector} in tx ${event.transactionHash}`);
        }
      } catch (error) {
        console.error(`Error fetching transaction ${event.transactionHash}:`, error);
      }
    }
    
    console.log(`  ETH builds: ${ethBuilds}`);
    console.log(`  TitanX builds: ${titanXBuilds}`);
    
    // Process Fractal events
    fractalEvents.forEach(event => {
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
    
    // Get totals from contract
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
    
    // Calculate total ETH from our data
    const totalETHFromBuildEvents = dailyDataArray.reduce((sum, day) => sum + day.ethUsed + day.fractalETH, 0);
    const totalETHForBurns = parseFloat(ethers.utils.formatEther(ethUsedForBurns));
    const totalETHForBuilds = totalETHFromBuildEvents; // We calculated this from events
    
    console.log(`\n📊 ETH Tracking Summary:`);
    console.log(`  ETH from build events: ${totalETHFromBuildEvents.toFixed(6)} ETH`);
    console.log(`  ETH for burns (contract): ${totalETHForBurns.toFixed(6)} ETH`);
    console.log(`  ETH for builds (contract): ${totalETHForBuilds.toFixed(6)} ETH`);
    console.log(`  Total ETH used: ${(totalETHForBurns + totalETHForBuilds).toFixed(6)} ETH`);
    console.log(`  ETH burn transactions: ${ethBurnCount}`);
    console.log(`  TitanX burn transactions: ${titanXBurnCount}`);
    
    // Distribute burn ETH proportionally across days that had ETH burns
    // We know total ETH for burns but not individual amounts
    if (ethBurnCount > 0 && totalETHForBurns > 0) {
      console.log('\n📊 Distributing burn ETH across days...');
      
      // Use average ETH per burn and distribute proportionally
      const avgETHPerBurn = totalETHForBurns / ethBurnCount;
      console.log(`  Average ETH per burn: ${avgETHPerBurn.toFixed(6)} ETH`);
      
      // Distribute ETH proportionally
      const ethPerBurn = totalETHForBurns / ethBurnCount;
      for (const [date, burnCount] of Object.entries(ethBurnsByDay)) {
        const dayData = dailyDataArray.find(d => d.date === date);
        if (dayData) {
          const ethForDay = burnCount * ethPerBurn;
          dayData.ethUsed = (dayData.ethUsed || 0) + ethForDay;
          console.log(`  ${date}: +${ethForDay.toFixed(6)} ETH (${burnCount} burns)`);
        }
      }
    }
    
    // Save data
    const outputData = {
      lastUpdated: new Date().toISOString(),
      totals: {
        torusBurnt: ethers.utils.formatEther(totalTorusBurnt),
        titanXBurnt: ethers.utils.formatEther(totalTitanXBurnt),
        ethBurn: ethers.utils.formatEther(totalETHBurn),
        titanXUsedForBurns: ethers.utils.formatEther(titanXUsedForBurns),
        ethUsedForBurns: ethers.utils.formatEther(ethUsedForBurns)
      },
      dailyData: dailyDataArray,
      eventCounts: {
        buyAndBurn: buyAndBurnEvents.length,
        buyAndBuild: buyAndBuildEvents.length,
        fractal: fractalEvents.length
      },
      metadata: {
        lastBlock: currentBlock,
        ethBuilds: ethBuilds,
        titanXBuilds: titanXBuilds
      }
    };
    
    const dataPath = path.join(__dirname, '../public/data/buy-process-data.json');
    fs.writeFileSync(dataPath, JSON.stringify(outputData, null, 2));
    
    console.log(`\n✅ Buy & Process data rebuilt successfully`);
    console.log(`📊 Total days with data: ${dailyDataArray.length}`);
    
  } catch (error) {
    console.error('❌ Error rebuilding Buy & Process data:', error);
    process.exit(1);
  }
}

// Run the rebuild
rebuildBuyProcessData().catch(console.error);