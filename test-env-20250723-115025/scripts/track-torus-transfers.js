#!/usr/bin/env node

/**
 * Track all TORUS transfers to the Buy & Process contract
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function trackTorusTransfers() {
  console.log('🔍 Tracking TORUS transfers to Buy & Process contract...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    const TORUS_CONTRACT = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
    
    // TORUS token ABI
    const torusABI = [
      'event Transfer(address indexed from, address indexed to, uint256 value)'
    ];
    
    const torusContract = new ethers.Contract(TORUS_CONTRACT, torusABI, provider);
    
    // Fetch all transfers TO the Buy & Process contract
    const deployBlock = 22890272;
    const currentBlock = await provider.getBlockNumber();
    
    console.log('Fetching all TORUS transfers to Buy & Process contract...');
    
    const allTransfers = [];
    const chunkSize = 5000;
    
    for (let start = deployBlock; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      console.log(`Scanning blocks ${start}-${end}...`);
      
      try {
        // Get all Transfer events where 'to' is the Buy & Process contract
        const filter = torusContract.filters.Transfer(null, BUY_PROCESS_CONTRACT);
        const events = await torusContract.queryFilter(filter, start, end);
        allTransfers.push(...events);
      } catch (e) {
        console.log(`Error fetching blocks ${start}-${end}, skipping...`);
      }
    }
    
    console.log(`\nFound ${allTransfers.length} TORUS transfers to Buy & Process\n`);
    
    // Get timestamps and analyze transfers
    const transfersBySource = {};
    let totalTransferred = ethers.BigNumber.from(0);
    
    for (const event of allTransfers) {
      const from = event.args.from;
      const amount = event.args.value;
      
      if (!transfersBySource[from]) {
        transfersBySource[from] = {
          count: 0,
          totalAmount: ethers.BigNumber.from(0),
          transfers: []
        };
      }
      
      transfersBySource[from].count++;
      transfersBySource[from].totalAmount = transfersBySource[from].totalAmount.add(amount);
      transfersBySource[from].transfers.push({
        txHash: event.transactionHash,
        block: event.blockNumber,
        amount: ethers.utils.formatEther(amount)
      });
      
      totalTransferred = totalTransferred.add(amount);
    }
    
    // Display results
    console.log('TORUS Transfers by Source:');
    console.log('==========================');
    
    Object.entries(transfersBySource).forEach(([address, data]) => {
      console.log(`\nFrom: ${address}`);
      console.log(`  Transfers: ${data.count}`);
      console.log(`  Total: ${ethers.utils.formatEther(data.totalAmount)} TORUS`);
      
      // Show first few transfers
      data.transfers.slice(0, 3).forEach((tx, i) => {
        console.log(`    ${i + 1}. ${tx.amount} TORUS (tx: ${tx.txHash.substring(0, 10)}...)`);
      });
      if (data.transfers.length > 3) {
        console.log(`    ... and ${data.transfers.length - 3} more transfers`);
      }
    });
    
    console.log(`\n\nTotal TORUS transferred to Buy & Process: ${ethers.utils.formatEther(totalTransferred)}`);
    
    // Compare with our tracked data
    const dataPath = path.join(__dirname, '../public/data/buy-process-data.json');
    const buyProcessData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    console.log(`\nComparison:`);
    console.log(`===========`);
    console.log(`Total transferred to contract: ${ethers.utils.formatEther(totalTransferred)} TORUS`);
    console.log(`Total burned by contract: ${buyProcessData.totals.torusBurnt} TORUS`);
    console.log(`Difference: ${(parseFloat(ethers.utils.formatEther(totalTransferred)) - parseFloat(buyProcessData.totals.torusBurnt)).toFixed(6)} TORUS`);
    
    // Check which addresses are sending TORUS
    console.log('\nAnalyzing sources:');
    const uniswapV3Router = '0xe592427a0aece92de3edee1f18e0157c05861564';
    const uniswapV2Router = '0x7a250d5630b4cf539739df2c5dacb4c659f2488d';
    
    Object.entries(transfersBySource).forEach(([address, data]) => {
      if (address.toLowerCase() === uniswapV3Router.toLowerCase()) {
        console.log(`- Uniswap V3 Router: ${ethers.utils.formatEther(data.totalAmount)} TORUS`);
      } else if (address.toLowerCase() === uniswapV2Router.toLowerCase()) {
        console.log(`- Uniswap V2 Router: ${ethers.utils.formatEther(data.totalAmount)} TORUS`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

trackTorusTransfers().catch(console.error);