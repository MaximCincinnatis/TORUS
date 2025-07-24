#!/usr/bin/env node

/**
 * Analyze Buy & Process contract functions and their selectors
 */

const { ethers } = require('ethers');

async function analyzeBuyProcessFunctions() {
  console.log('🔍 Analyzing Buy & Process Contract Function Signatures\n');
  
  // Define the actual function signatures from the contract
  const functionSignatures = [
    'swapETHForTorusAndBurn(uint32)',
    'swapTitanXForTorusAndBurn(uint32)',
    'swapETHForTorusAndBuild(uint32)',
    'swapTitanXForTorusAndBuild(uint32)',
    'burnTorus()',
    'totalTorusBurnt()',
    'totalTitanXBurnt()',
    'totalETHBurn()',
    'titanXUsedForBurns()',
    'ethUsedForBurns()'
  ];
  
  console.log('Function Selectors:');
  console.log('==================\n');
  
  const selectors = {};
  
  functionSignatures.forEach(sig => {
    const selector = ethers.utils.id(sig).slice(0, 10);
    selectors[selector] = sig;
    console.log(`${sig}`);
    console.log(`  Selector: ${selector}\n`);
  });
  
  // Now let's check recent transactions
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  
  console.log('\nFetching recent transactions to identify ETH burns...\n');
  
  try {
    const currentBlock = await provider.getBlockNumber();
    const blocksToCheck = 1000;
    const startBlock = currentBlock - blocksToCheck;
    
    console.log(`Checking blocks ${startBlock} to ${currentBlock}...`);
    
    const ethBurns = [];
    const titanXBurns = [];
    const ethBuilds = [];
    const titanXBuilds = [];
    
    // Get blocks in chunks
    for (let blockNum = startBlock; blockNum <= currentBlock; blockNum += 10) {
      const endBlock = Math.min(blockNum + 9, currentBlock);
      
      try {
        // Get all transactions in this block range
        for (let b = blockNum; b <= endBlock; b++) {
          const block = await provider.getBlockWithTransactions(b);
          
          for (const tx of block.transactions) {
            if (tx.to && tx.to.toLowerCase() === BUY_PROCESS_CONTRACT.toLowerCase()) {
              const functionSelector = tx.data.slice(0, 10);
              const functionName = selectors[functionSelector] || 'Unknown';
              
              // Check if it's an ETH transaction
              if (tx.value && tx.value.gt(0)) {
                const ethAmount = ethers.utils.formatEther(tx.value);
                
                if (functionName.includes('swapETHForTorusAndBurn')) {
                  ethBurns.push({
                    tx: tx.hash,
                    eth: ethAmount,
                    block: b,
                    timestamp: new Date(block.timestamp * 1000),
                    function: functionName
                  });
                } else if (functionName.includes('swapETHForTorusAndBuild')) {
                  ethBuilds.push({
                    tx: tx.hash,
                    eth: ethAmount,
                    block: b,
                    timestamp: new Date(block.timestamp * 1000),
                    function: functionName
                  });
                }
              } else {
                // TitanX transaction
                if (functionName.includes('swapTitanXForTorusAndBurn')) {
                  titanXBurns.push({
                    tx: tx.hash,
                    block: b,
                    timestamp: new Date(block.timestamp * 1000),
                    function: functionName
                  });
                } else if (functionName.includes('swapTitanXForTorusAndBuild')) {
                  titanXBuilds.push({
                    tx: tx.hash,
                    block: b,
                    timestamp: new Date(block.timestamp * 1000),
                    function: functionName
                  });
                }
              }
            }
          }
        }
      } catch (e) {
        // Skip errors
      }
    }
    
    console.log('\n📊 Transaction Summary:');
    console.log('======================\n');
    console.log(`ETH Burns: ${ethBurns.length}`);
    console.log(`TitanX Burns: ${titanXBurns.length}`);
    console.log(`ETH Builds: ${ethBuilds.length}`);
    console.log(`TitanX Builds: ${titanXBuilds.length}`);
    
    if (ethBurns.length > 0) {
      console.log('\n🔥 Recent ETH Burns:');
      console.log('-------------------');
      ethBurns.slice(-5).forEach((burn, i) => {
        console.log(`${i + 1}. ${burn.timestamp.toISOString()}`);
        console.log(`   Amount: ${burn.eth} ETH`);
        console.log(`   Tx: ${burn.tx}`);
        console.log(`   Block: ${burn.block}`);
      });
      
      const totalETH = ethBurns.reduce((sum, burn) => sum + parseFloat(burn.eth), 0);
      console.log(`\nTotal ETH burned: ${totalETH.toFixed(6)} ETH`);
    }
    
    // Group by day
    const dailyETH = {};
    ethBurns.forEach(burn => {
      const date = burn.timestamp.toISOString().split('T')[0];
      if (!dailyETH[date]) {
        dailyETH[date] = { count: 0, total: 0 };
      }
      dailyETH[date].count++;
      dailyETH[date].total += parseFloat(burn.eth);
    });
    
    if (Object.keys(dailyETH).length > 0) {
      console.log('\n📅 ETH Burns by Day:');
      console.log('-------------------');
      Object.entries(dailyETH).sort().forEach(([date, data]) => {
        console.log(`${date}: ${data.count} burns, ${data.total.toFixed(6)} ETH`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeBuyProcessFunctions().catch(console.error);