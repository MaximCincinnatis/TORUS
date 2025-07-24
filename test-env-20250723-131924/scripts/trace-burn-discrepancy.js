#!/usr/bin/env node

/**
 * Trace where the burn discrepancy begins
 */

const { ethers } = require('ethers');

const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function traceBurnDiscrepancy() {
  console.log('🔍 Tracing burn discrepancy...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    const TORUS_CONTRACT = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
    
    // Contract ABIs
    const torusABI = [
      'event Transfer(address indexed from, address indexed to, uint256 value)'
    ];
    
    const buyProcessABI = [
      'function totalTorusBurnt() view returns (uint256)',
      'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
      'event TorusBurned(uint256 amount)'
    ];
    
    const torusContract = new ethers.Contract(TORUS_CONTRACT, torusABI, provider);
    const buyProcessContract = new ethers.Contract(BUY_PROCESS_CONTRACT, buyProcessABI, provider);
    
    // Get all burn transfers
    console.log('Fetching all burn transfers...');
    const deployBlock = 22890272;
    const currentBlock = await provider.getBlockNumber();
    
    const allBurns = [];
    const chunkSize = 5000;
    
    for (let start = deployBlock; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      
      const filter = torusContract.filters.Transfer(
        BUY_PROCESS_CONTRACT,
        '0x0000000000000000000000000000000000000000'
      );
      
      const burns = await torusContract.queryFilter(filter, start, end);
      allBurns.push(...burns);
    }
    
    console.log(`Found ${allBurns.length} burn transfers\n`);
    
    // Calculate cumulative burns and compare with totalTorusBurnt
    console.log('Comparing actual burns vs totalTorusBurnt at key points:\n');
    
    let cumulativeTransferBurns = ethers.BigNumber.from(0);
    let discrepancyFound = false;
    
    // Check after each burn
    for (let i = 0; i < Math.min(10, allBurns.length); i++) {
      const burn = allBurns[i];
      cumulativeTransferBurns = cumulativeTransferBurns.add(burn.args.value);
      
      // Get totalTorusBurnt at this block
      const totalBurnt = await buyProcessContract.totalTorusBurnt({ blockTag: burn.blockNumber });
      
      const transferTotal = parseFloat(ethers.utils.formatEther(cumulativeTransferBurns));
      const contractTotal = parseFloat(ethers.utils.formatEther(totalBurnt));
      const diff = contractTotal - transferTotal;
      
      console.log(`After burn #${i + 1} (block ${burn.blockNumber}):`);
      console.log(`  Transfer burns total: ${transferTotal.toFixed(6)} TORUS`);
      console.log(`  Contract totalTorusBurnt: ${contractTotal.toFixed(6)} TORUS`);
      console.log(`  Difference: ${diff.toFixed(6)} TORUS`);
      
      if (diff > 0.01 && !discrepancyFound) {
        console.log(`  ⚠️  DISCREPANCY FOUND!`);
        discrepancyFound = true;
        
        // Get the transaction that caused this
        const tx = await provider.getTransaction(burn.transactionHash);
        console.log(`  Transaction: ${tx.hash}`);
        console.log(`  From: ${tx.from}`);
      }
      console.log('');
    }
    
    // Check the final state
    console.log('\nFinal state:');
    let finalTransferTotal = ethers.BigNumber.from(0);
    for (const burn of allBurns) {
      finalTransferTotal = finalTransferTotal.add(burn.args.value);
    }
    
    const finalContractTotal = await buyProcessContract.totalTorusBurnt();
    
    console.log(`Total from ${allBurns.length} Transfer events: ${ethers.utils.formatEther(finalTransferTotal)} TORUS`);
    console.log(`Contract totalTorusBurnt: ${ethers.utils.formatEther(finalContractTotal)} TORUS`);
    console.log(`Discrepancy: ${ethers.utils.formatEther(finalContractTotal.sub(finalTransferTotal))} TORUS`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

traceBurnDiscrepancy().catch(console.error);