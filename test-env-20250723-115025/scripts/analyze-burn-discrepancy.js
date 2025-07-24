#!/usr/bin/env node

/**
 * Analyze the 947 TORUS discrepancy in detail
 */

const { ethers } = require('ethers');

const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function analyzeBurnDiscrepancy() {
  console.log('🔍 Analyzing the 947 TORUS burn discrepancy...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    const TORUS_CONTRACT = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
    
    // Contract ABIs
    const buyProcessABI = [
      'function totalTorusBurnt() view returns (uint256)',
      'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
      'event TorusBurned(uint256 indexed amount)'
    ];
    
    const torusABI = [
      'function balanceOf(address account) view returns (uint256)'
    ];
    
    const buyProcessContract = new ethers.Contract(BUY_PROCESS_CONTRACT, buyProcessABI, provider);
    const torusContract = new ethers.Contract(TORUS_CONTRACT, torusABI, provider);
    
    // Get current state
    const totalTorusBurnt = await buyProcessContract.totalTorusBurnt();
    const currentBalance = await torusContract.balanceOf(BUY_PROCESS_CONTRACT);
    
    console.log('Current Contract State:');
    console.log(`  totalTorusBurnt: ${ethers.utils.formatEther(totalTorusBurnt)} TORUS`);
    console.log(`  Current TORUS balance: ${ethers.utils.formatEther(currentBalance)} TORUS\n`);
    
    // Get all BuyAndBurn events to sum up torusBurnt amounts
    const deployBlock = 22890272;
    const currentBlock = await provider.getBlockNumber();
    const chunkSize = 5000;
    
    console.log('Analyzing BuyAndBurn events...');
    const allBuyAndBurnEvents = [];
    
    for (let start = deployBlock; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      
      const events = await buyProcessContract.queryFilter(
        buyProcessContract.filters.BuyAndBurn(),
        start,
        end
      );
      
      allBuyAndBurnEvents.push(...events);
    }
    
    // Sum up torusBurnt from events
    let totalFromBuyAndBurnEvents = ethers.BigNumber.from(0);
    for (const event of allBuyAndBurnEvents) {
      totalFromBuyAndBurnEvents = totalFromBuyAndBurnEvents.add(event.args.torusBurnt);
    }
    
    console.log(`\nTotal from ${allBuyAndBurnEvents.length} BuyAndBurn events: ${ethers.utils.formatEther(totalFromBuyAndBurnEvents)} TORUS`);
    
    // Get all TorusBurned events
    console.log('\nAnalyzing TorusBurned events...');
    const allTorusBurnedEvents = [];
    
    for (let start = deployBlock; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      
      const events = await buyProcessContract.queryFilter(
        buyProcessContract.filters.TorusBurned(),
        start,
        end
      );
      
      allTorusBurnedEvents.push(...events);
    }
    
    let totalFromTorusBurnedEvents = ethers.BigNumber.from(0);
    for (const event of allTorusBurnedEvents) {
      totalFromTorusBurnedEvents = totalFromTorusBurnedEvents.add(event.args.amount);
    }
    
    console.log(`Total from ${allTorusBurnedEvents.length} TorusBurned events: ${ethers.utils.formatEther(totalFromTorusBurnedEvents)} TORUS`);
    
    // Analysis
    console.log('\n📊 Analysis Summary:');
    console.log('=====================');
    console.log(`Contract totalTorusBurnt state: ${ethers.utils.formatEther(totalTorusBurnt)} TORUS`);
    console.log(`Sum of BuyAndBurn event amounts: ${ethers.utils.formatEther(totalFromBuyAndBurnEvents)} TORUS`);
    console.log(`Sum of TorusBurned event amounts: ${ethers.utils.formatEther(totalFromTorusBurnedEvents)} TORUS`);
    console.log(`Current contract balance: ${ethers.utils.formatEther(currentBalance)} TORUS`);
    
    const diff1 = parseFloat(ethers.utils.formatEther(totalTorusBurnt)) - parseFloat(ethers.utils.formatEther(totalFromBuyAndBurnEvents));
    const diff2 = parseFloat(ethers.utils.formatEther(totalTorusBurnt)) - parseFloat(ethers.utils.formatEther(totalFromTorusBurnedEvents));
    
    console.log(`\nDiscrepancies:`);
    console.log(`  totalTorusBurnt vs BuyAndBurn events: ${diff1.toFixed(6)} TORUS`);
    console.log(`  totalTorusBurnt vs TorusBurned events: ${diff2.toFixed(6)} TORUS`);
    
    if (Math.abs(diff1) < 0.01) {
      console.log('\n✅ The contract\'s totalTorusBurnt matches the sum of BuyAndBurn event amounts!');
      console.log('This means the contract is tracking the INTENDED burn amounts, not actual burns.');
    }
    
    if (diff2 > 0) {
      console.log(`\n⚠️  There\'s a ${diff2.toFixed(2)} TORUS difference between intended and actual burns.`);
      console.log('This could mean:');
      console.log('1. Some burns were accounted for but not executed');
      console.log('2. The contract burns ALL its balance, not just the purchased amount');
      console.log('3. There might be other sources of TORUS in the contract');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

analyzeBurnDiscrepancy().catch(console.error);