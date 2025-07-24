#!/usr/bin/env node

/**
 * Analyze the swapETHForTorusAndBurn function calls
 */

const { ethers } = require('ethers');

const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function analyzeEthBurnFunction() {
  console.log('🔍 Analyzing swapETHForTorusAndBurn function calls...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    
    // Get the function selector for swapETHForTorusAndBurn
    const iface = new ethers.utils.Interface([
      'function swapETHForTorusAndBurn() payable'
    ]);
    const functionSelector = iface.getSighash('swapETHForTorusAndBurn');
    console.log(`Function selector for swapETHForTorusAndBurn: ${functionSelector}\n`);
    
    // Search for all transactions to this contract with ETH value
    const deployBlock = 22890272;
    const currentBlock = await provider.getBlockNumber();
    
    console.log('Searching for ETH transactions to Buy & Process contract...');
    
    // We'll need to search through blocks
    const ethTransactions = [];
    const chunkSize = 1000;
    
    for (let blockNum = deployBlock; blockNum <= currentBlock; blockNum += chunkSize) {
      const endBlock = Math.min(blockNum + chunkSize - 1, currentBlock);
      
      try {
        // Get all blocks in this range
        for (let b = blockNum; b <= endBlock; b++) {
          if (b % 1000 === 0) {
            console.log(`Checking block ${b}/${currentBlock}...`);
          }
          
          const block = await provider.getBlockWithTransactions(b);
          
          // Check each transaction
          for (const tx of block.transactions) {
            // Check if it's to our contract and has ETH value
            if (tx.to && tx.to.toLowerCase() === BUY_PROCESS_CONTRACT.toLowerCase() && tx.value && tx.value.gt(0)) {
              // Check if it's the swapETHForTorusAndBurn function
              if (tx.data.startsWith(functionSelector)) {
                const receipt = await provider.getTransactionReceipt(tx.hash);
                ethTransactions.push({
                  hash: tx.hash,
                  block: b,
                  from: tx.from,
                  value: ethers.utils.formatEther(tx.value),
                  timestamp: block.timestamp,
                  date: new Date(block.timestamp * 1000).toISOString().split('T')[0],
                  gasUsed: receipt.gasUsed.toString(),
                  status: receipt.status
                });
              }
            }
          }
        }
      } catch (error) {
        console.log(`Error processing blocks ${blockNum}-${endBlock}: ${error.message}`);
      }
    }
    
    console.log(`\nFound ${ethTransactions.length} swapETHForTorusAndBurn transactions\n`);
    
    // Group by date
    const byDate = {};
    ethTransactions.forEach(tx => {
      if (!byDate[tx.date]) {
        byDate[tx.date] = [];
      }
      byDate[tx.date].push(tx);
    });
    
    // Display results
    console.log('ETH Burn Transactions by Date:');
    console.log('==============================');
    
    let totalEth = 0;
    Object.entries(byDate).sort().forEach(([date, txs]) => {
      const dayTotal = txs.reduce((sum, tx) => sum + parseFloat(tx.value), 0);
      totalEth += dayTotal;
      
      console.log(`\n${date}: ${dayTotal.toFixed(6)} ETH total`);
      txs.forEach((tx, i) => {
        console.log(`  ${i + 1}. ${tx.value} ETH`);
        console.log(`     From: ${tx.from}`);
        console.log(`     Hash: ${tx.hash}`);
        console.log(`     Block: ${tx.block}`);
      });
    });
    
    console.log(`\nTotal ETH: ${totalEth.toFixed(6)} ETH`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

analyzeEthBurnFunction().catch(console.error);