#!/usr/bin/env node

/**
 * Properly identify ETH vs TitanX burns using correct function selectors
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Correct function selectors from our analysis
const FUNCTION_SELECTORS = {
  '0x39b6ce64': 'swapETHForTorusAndBurn',     // ETH burn
  '0xd6d315a4': 'swapTitanXForTorusAndBurn',  // TitanX burn
  '0x53ad9b96': 'swapETHForTorusAndBuild',    // ETH build
  '0xfc9b61ae': 'swapTitanXForTorusAndBuild', // TitanX build
  '0xf6b8cd5a': 'burnTorus'
};

async function identifyBurns() {
  console.log('🔍 Identifying ETH vs TitanX Burns with Correct Function Selectors\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  
  // Contract ABI
  const contractABI = [
    'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
    'event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)'
  ];
  
  const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, contractABI, provider);
  
  try {
    // Focus on recent blocks - days 13-15 (July 23-25)
    const currentBlock = await provider.getBlockNumber();
    const blocksToCheck = 10000; // About 1.5 days of blocks
    const startBlock = currentBlock - blocksToCheck;
    
    console.log(`Fetching BuyAndBurn events from blocks ${startBlock} to ${currentBlock}...`);
    
    // Fetch events
    const events = await contract.queryFilter(
      contract.filters.BuyAndBurn(),
      startBlock,
      currentBlock
    );
    
    console.log(`Found ${events.length} BuyAndBurn events\n`);
    
    // Analyze each event
    const ethBurns = [];
    const titanXBurns = [];
    const unknownBurns = [];
    
    console.log('Analyzing transactions...');
    
    for (const event of events) {
      try {
        const tx = await provider.getTransaction(event.transactionHash);
        const block = await provider.getBlock(event.blockNumber);
        const functionSelector = tx.data.slice(0, 10);
        const functionName = FUNCTION_SELECTORS[functionSelector] || 'Unknown';
        
        const timestamp = new Date(block.timestamp * 1000);
        const date = timestamp.toISOString().split('T')[0];
        
        const burnData = {
          tx: event.transactionHash,
          block: event.blockNumber,
          timestamp: timestamp,
          date: date,
          torusBurned: ethers.utils.formatEther(event.args.torusBurnt),
          caller: event.args.caller,
          functionSelector: functionSelector,
          functionName: functionName
        };
        
        if (functionSelector === '0x39b6ce64') {
          // ETH burn - tx.value contains the ETH amount
          burnData.ethAmount = ethers.utils.formatEther(tx.value);
          burnData.type = 'ETH';
          ethBurns.push(burnData);
        } else if (functionSelector === '0xd6d315a4') {
          // TitanX burn - titanXAmount from event
          burnData.titanXAmount = ethers.utils.formatEther(event.args.titanXAmount);
          burnData.type = 'TitanX';
          titanXBurns.push(burnData);
        } else {
          // Unknown function
          burnData.type = 'Unknown';
          unknownBurns.push(burnData);
        }
      } catch (error) {
        console.error(`Error processing tx ${event.transactionHash}:`, error.message);
      }
    }
    
    // Display results
    console.log('\n📊 Burn Analysis Results:');
    console.log('========================\n');
    console.log(`Total burns analyzed: ${events.length}`);
    console.log(`ETH burns: ${ethBurns.length}`);
    console.log(`TitanX burns: ${titanXBurns.length}`);
    console.log(`Unknown burns: ${unknownBurns.length}`);
    
    if (ethBurns.length > 0) {
      console.log('\n🔥 ETH Burns:');
      console.log('-------------');
      let totalETH = 0;
      ethBurns.forEach((burn, i) => {
        console.log(`${i + 1}. ${burn.timestamp.toISOString()}`);
        console.log(`   ETH: ${burn.ethAmount}`);
        console.log(`   TORUS burned: ${burn.torusBurned}`);
        console.log(`   Tx: ${burn.tx}`);
        console.log(`   Caller: ${burn.caller}`);
        totalETH += parseFloat(burn.ethAmount);
      });
      console.log(`\nTotal ETH burned: ${totalETH.toFixed(6)} ETH`);
    }
    
    // Group by date
    const dailyStats = {};
    
    [...ethBurns, ...titanXBurns].forEach(burn => {
      if (!dailyStats[burn.date]) {
        dailyStats[burn.date] = {
          date: burn.date,
          ethBurns: 0,
          titanXBurns: 0,
          totalETH: 0,
          totalTitanX: 0,
          totalTorusBurned: 0
        };
      }
      
      if (burn.type === 'ETH') {
        dailyStats[burn.date].ethBurns++;
        dailyStats[burn.date].totalETH += parseFloat(burn.ethAmount);
      } else {
        dailyStats[burn.date].titanXBurns++;
        dailyStats[burn.date].totalTitanX += parseFloat(burn.titanXAmount || 0);
      }
      
      dailyStats[burn.date].totalTorusBurned += parseFloat(burn.torusBurned);
    });
    
    console.log('\n📅 Daily Burn Summary:');
    console.log('--------------------');
    Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date)).forEach(day => {
      console.log(`\n${day.date}:`);
      console.log(`  ETH burns: ${day.ethBurns} (${day.totalETH.toFixed(6)} ETH)`);
      console.log(`  TitanX burns: ${day.titanXBurns} (${day.totalTitanX.toFixed(2)} TitanX)`);
      console.log(`  Total TORUS burned: ${day.totalTorusBurned.toFixed(2)}`);
    });
    
    // Save results
    const results = {
      timestamp: new Date().toISOString(),
      summary: {
        totalBurns: events.length,
        ethBurns: ethBurns.length,
        titanXBurns: titanXBurns.length,
        unknownBurns: unknownBurns.length
      },
      ethBurns: ethBurns,
      titanXBurns: titanXBurns,
      dailyStats: dailyStats,
      functionSelectors: FUNCTION_SELECTORS
    };
    
    const outputPath = path.join(__dirname, '../public/data/burn-analysis-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    
    console.log(`\n✅ Results saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

identifyBurns().catch(console.error);