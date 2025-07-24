const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function trackBuyProcessEvents() {
  console.log('📊 Tracking Buy & Process Events...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  
  // Contract ABI based on Etherscan
  const contractABI = [
    'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
    'event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)',
    'event FractalFundsReleased(uint256 releasedTitanX, uint256 releasedETH)',
    
    // Functions to get totals
    'function totalTorusBurnt() view returns (uint256)',
    'function totalTitanXBurnt() view returns (uint256)',
    'function totalETHBurn() view returns (uint256)',
    'function titanXUsedForBurns() view returns (uint256)',
    'function ethUsedForBurns() view returns (uint256)'
  ];
  
  const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, contractABI, provider);
  
  try {
    // Get current totals from contract
    console.log('Fetching current totals from contract...');
    const [
      totalTorusBurnt,
      totalTitanXBurnt,
      totalETHBurn,
      titanXUsedForBurns,
      ethUsedForBurns
    ] = await Promise.all([
      contract.totalTorusBurnt().catch(() => ethers.BigNumber.from(0)),
      contract.totalTitanXBurnt().catch(() => ethers.BigNumber.from(0)),
      contract.totalETHBurn().catch(() => ethers.BigNumber.from(0)),
      contract.titanXUsedForBurns().catch(() => ethers.BigNumber.from(0)),
      contract.ethUsedForBurns().catch(() => ethers.BigNumber.from(0))
    ]);
    
    console.log('\n📈 Current Totals:');
    console.log('Total TORUS Burnt:', ethers.utils.formatEther(totalTorusBurnt), 'TORUS');
    console.log('Total TitanX Burnt:', ethers.utils.formatEther(totalTitanXBurnt), 'TitanX');
    console.log('Total ETH Burn:', ethers.utils.formatEther(totalETHBurn), 'ETH');
    console.log('TitanX Used for Burns:', ethers.utils.formatEther(titanXUsedForBurns), 'TitanX');
    console.log('ETH Used for Burns:', ethers.utils.formatEther(ethUsedForBurns), 'ETH');
    
    // Get historical events
    const currentBlock = await provider.getBlockNumber();
    const DEPLOYMENT_BLOCK = 22890272; // Contract deployment
    
    console.log(`\nFetching events from block ${DEPLOYMENT_BLOCK} to ${currentBlock}...`);
    
    // Fetch all events
    const buyAndBurnEvents = [];
    const buyAndBuildEvents = [];
    const fractalEvents = [];
    
    const chunkSize = 5000;
    for (let start = DEPLOYMENT_BLOCK; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      
      if (start % 20000 === 0) {
        const progress = Math.round((start - DEPLOYMENT_BLOCK) / (currentBlock - DEPLOYMENT_BLOCK) * 100);
        console.log(`Progress: ${progress}%`);
      }
      
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
        console.log(`Error fetching blocks ${start}-${end}, retrying in smaller chunks...`);
      }
    }
    
    console.log(`\n✅ Found events:`);
    console.log(`- Buy & Burn: ${buyAndBurnEvents.length}`);
    console.log(`- Buy & Build: ${buyAndBuildEvents.length}`);
    console.log(`- Fractal: ${fractalEvents.length}`);
    
    // Get block timestamps for all events
    console.log('\nFetching timestamps...');
    const allBlocks = new Set([
      ...buyAndBurnEvents.map(e => e.blockNumber),
      ...buyAndBuildEvents.map(e => e.blockNumber),
      ...fractalEvents.map(e => e.blockNumber)
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
    
    // Process events into daily data
    const dailyData = {};
    const CONTRACT_START = new Date('2025-07-11T00:00:00Z');
    
    // Process Buy & Burn events
    buyAndBurnEvents.forEach(event => {
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
      dailyData[dateKey].titanXUsed += parseFloat(ethers.utils.formatEther(event.args.titanXAmount));
    });
    
    // Process Buy & Build events
    buyAndBuildEvents.forEach(event => {
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
      // tokenAllocated could be ETH or TitanX, need to determine from transaction
    });
    
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
    
    // Save the data
    const outputPath = path.join(__dirname, '../public/data/buy-process-data.json');
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
      }
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    
    console.log(`\n💾 Data saved to: ${outputPath}`);
    
    // Show sample of daily data
    console.log('\n📊 Sample Daily Data (last 5 days):');
    dailyDataArray.slice(-5).forEach(day => {
      console.log(`\n${day.date}:`);
      console.log(`  Buy & Burn: ${day.buyAndBurnCount} (burned ${day.torusBurned.toFixed(2)} TORUS)`);
      console.log(`  Buy & Build: ${day.buyAndBuildCount} (purchased ${day.torusPurchased.toFixed(2)} TORUS)`);
      console.log(`  Fractal: ${day.fractalCount} (${day.fractalTitanX.toFixed(2)} TitanX, ${day.fractalETH.toFixed(4)} ETH)`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

trackBuyProcessEvents().catch(console.error);