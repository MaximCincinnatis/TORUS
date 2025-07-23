#!/usr/bin/env node

/**
 * Analyze ETH usage in Buy & Burn operations
 */

const { ethers } = require('ethers');

const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function analyzeEthBurns() {
  console.log('🔍 Analyzing ETH burns...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    
    // Contract ABI - including the burn functions
    const contractABI = [
      'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
      'function swapETHForTorusAndBurn() payable',
      'function swapTitanXForTorusAndBurn(uint256 titanXAmount)',
      'function ethUsedForBurns() view returns (uint256)'
    ];
    
    const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, contractABI, provider);
    
    // Get total ETH used for burns from contract
    const totalEthUsedForBurns = await contract.ethUsedForBurns();
    console.log(`Total ETH used for burns (from contract): ${ethers.utils.formatEther(totalEthUsedForBurns)} ETH\n`);
    
    // Fetch all Buy & Burn events
    const deployBlock = 22890272;
    const currentBlock = await provider.getBlockNumber();
    
    console.log('Fetching all Buy & Burn events to find ETH burns...');
    
    const allBuyAndBurnEvents = [];
    const chunkSize = 5000;
    
    for (let start = deployBlock; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      try {
        const events = await contract.queryFilter(contract.filters.BuyAndBurn(), start, end);
        allBuyAndBurnEvents.push(...events);
      } catch (e) {
        console.log(`Error fetching blocks ${start}-${end}, skipping...`);
      }
    }
    
    console.log(`Found ${allBuyAndBurnEvents.length} Buy & Burn events\n`);
    
    // Check transactions to find ETH burns
    console.log('Analyzing transactions to find ETH burns...');
    const ethBurns = [];
    
    for (const event of allBuyAndBurnEvents) {
      try {
        const tx = await provider.getTransaction(event.transactionHash);
        const receipt = await provider.getTransactionReceipt(event.transactionHash);
        
        // Check if this is an ETH burn (has ETH value)
        if (tx.value && tx.value.gt(0)) {
          const block = await provider.getBlock(event.blockNumber);
          const date = new Date(block.timestamp * 1000);
          
          ethBurns.push({
            txHash: event.transactionHash,
            date: date.toISOString().split('T')[0],
            ethAmount: ethers.utils.formatEther(tx.value),
            torusBurned: ethers.utils.formatEther(event.args.torusBurnt),
            titanXAmount: ethers.utils.formatEther(event.args.titanXAmount),
            functionSelector: tx.data.slice(0, 10),
            from: tx.from
          });
        }
      } catch (error) {
        console.error(`Error analyzing tx ${event.transactionHash}:`, error.message);
      }
    }
    
    console.log(`\nFound ${ethBurns.length} ETH burn transactions\n`);
    
    // Display ETH burns by date
    console.log('ETH Burns by Date:');
    console.log('==================');
    
    const burnsByDate = {};
    ethBurns.forEach(burn => {
      if (!burnsByDate[burn.date]) {
        burnsByDate[burn.date] = {
          count: 0,
          totalEth: 0,
          transactions: []
        };
      }
      burnsByDate[burn.date].count++;
      burnsByDate[burn.date].totalEth += parseFloat(burn.ethAmount);
      burnsByDate[burn.date].transactions.push(burn);
    });
    
    Object.entries(burnsByDate).sort().forEach(([date, data]) => {
      console.log(`\n${date}:`);
      console.log(`  Total ETH: ${data.totalEth.toFixed(6)} ETH`);
      console.log(`  Transactions: ${data.count}`);
      data.transactions.forEach((tx, i) => {
        console.log(`    ${i + 1}. ${tx.ethAmount} ETH -> ${parseFloat(tx.torusBurned).toFixed(2)} TORUS burned`);
        console.log(`       tx: ${tx.txHash}`);
        console.log(`       titanX in event: ${tx.titanXAmount}`);
      });
    });
    
    // Summary
    const totalEthFromEvents = ethBurns.reduce((sum, burn) => sum + parseFloat(burn.ethAmount), 0);
    console.log(`\n\nSummary:`);
    console.log(`========`);
    console.log(`Total ETH from analyzing transactions: ${totalEthFromEvents.toFixed(6)} ETH`);
    console.log(`Total ETH from contract state: ${ethers.utils.formatEther(totalEthUsedForBurns)} ETH`);
    console.log(`Difference: ${(parseFloat(ethers.utils.formatEther(totalEthUsedForBurns)) - totalEthFromEvents).toFixed(6)} ETH`);
    
    // Check function selectors
    console.log(`\nFunction selectors used:`);
    const selectors = [...new Set(ethBurns.map(b => b.functionSelector))];
    selectors.forEach(sel => {
      const count = ethBurns.filter(b => b.functionSelector === sel).length;
      console.log(`  ${sel}: ${count} transactions`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

analyzeEthBurns().catch(console.error);