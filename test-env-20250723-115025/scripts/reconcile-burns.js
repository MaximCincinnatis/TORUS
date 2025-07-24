#!/usr/bin/env node

/**
 * Reconcile burn amounts between Transfer events and contract state
 */

const { ethers } = require('ethers');

const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function reconcileBurns() {
  console.log('🔍 Reconciling burn amounts...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    const TORUS_CONTRACT = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
    
    // Get contract state
    const buyProcessABI = [
      'function totalTorusBurnt() view returns (uint256)'
    ];
    
    const buyProcessContract = new ethers.Contract(BUY_PROCESS_CONTRACT, buyProcessABI, provider);
    const totalTorusBurnt = await buyProcessContract.totalTorusBurnt();
    
    console.log(`Contract state totalTorusBurnt: ${ethers.utils.formatEther(totalTorusBurnt)} TORUS`);
    
    // TORUS token ABI - including Burn event
    const torusABI = [
      'event Transfer(address indexed from, address indexed to, uint256 value)',
      'event Burn(address indexed burner, uint256 value)'
    ];
    
    const torusContract = new ethers.Contract(TORUS_CONTRACT, torusABI, provider);
    
    // Check for Burn events from Buy & Process
    const deployBlock = 22890272;
    const currentBlock = await provider.getBlockNumber();
    
    console.log('\nChecking for Burn events...');
    
    const burnEvents = [];
    const chunkSize = 5000;
    
    for (let start = deployBlock; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      
      try {
        const filter = torusContract.filters.Burn(BUY_PROCESS_CONTRACT);
        const events = await torusContract.queryFilter(filter, start, end);
        burnEvents.push(...events);
      } catch (e) {
        // Burn event might not exist
      }
    }
    
    console.log(`Found ${burnEvents.length} Burn events from Buy & Process`);
    
    if (burnEvents.length > 0) {
      let totalFromBurnEvents = ethers.BigNumber.from(0);
      burnEvents.forEach(e => {
        totalFromBurnEvents = totalFromBurnEvents.add(e.args.value);
      });
      console.log(`Total from Burn events: ${ethers.utils.formatEther(totalFromBurnEvents)} TORUS`);
    }
    
    // Let's also double-check our Transfer event count
    console.log('\nDouble-checking Transfer events to zero address...');
    
    const transferEvents = [];
    for (let start = deployBlock; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      
      try {
        const filter = torusContract.filters.Transfer(BUY_PROCESS_CONTRACT, '0x0000000000000000000000000000000000000000');
        const events = await torusContract.queryFilter(filter, start, end);
        transferEvents.push(...events);
      } catch (e) {
        console.log(`Error in blocks ${start}-${end}`);
      }
    }
    
    let totalFromTransfers = ethers.BigNumber.from(0);
    transferEvents.forEach(e => {
      totalFromTransfers = totalFromTransfers.add(e.args.value);
    });
    
    console.log(`Found ${transferEvents.length} Transfer events to zero address`);
    console.log(`Total from Transfer events: ${ethers.utils.formatEther(totalFromTransfers)} TORUS`);
    
    // The discrepancy
    const discrepancy = totalTorusBurnt.sub(totalFromTransfers);
    console.log(`\nDiscrepancy: ${ethers.utils.formatEther(discrepancy)} TORUS`);
    
    // Theory: The contract might be tracking burns that will happen but haven't yet
    // Or there might be a different burn mechanism
    
    console.log('\nPossible explanations:');
    console.log('1. The contract tracks intended burns before they execute');
    console.log('2. There are burns through a different mechanism');
    console.log('3. The contract was initialized with a non-zero totalTorusBurnt');
    
    // Check if totalTorusBurnt might have been set at deployment
    const deployTxHash = '0x5f6a3c8c88f6b9d0c5f6e9a8d4c2b1a3e7f9d2c4'; // Would need actual deploy tx
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

reconcileBurns().catch(console.error);