#!/usr/bin/env node

/**
 * Find the missing 947 TORUS discrepancy
 */

const { ethers } = require('ethers');

const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function findMissingTorus() {
  console.log('🔍 Finding the missing 947 TORUS...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    const TORUS_CONTRACT = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
    
    // Contract ABIs
    const torusABI = [
      'event Transfer(address indexed from, address indexed to, uint256 value)',
      'function balanceOf(address account) view returns (uint256)'
    ];
    
    const buyProcessABI = [
      'function totalTorusBurnt() view returns (uint256)',
      'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
      'event TorusBurned(uint256 indexed amount)'
    ];
    
    const torusContract = new ethers.Contract(TORUS_CONTRACT, torusABI, provider);
    const buyProcessContract = new ethers.Contract(BUY_PROCESS_CONTRACT, buyProcessABI, provider);
    
    const deployBlock = 22890272;
    const currentBlock = await provider.getBlockNumber();
    
    console.log('1. Getting all TORUS transfers TO the Buy & Process contract...');
    const allIncomingTransfers = [];
    const chunkSize = 5000;
    
    for (let start = deployBlock; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      
      const filter = torusContract.filters.Transfer(
        null, // from anyone
        BUY_PROCESS_CONTRACT // to buy process contract
      );
      
      const transfers = await torusContract.queryFilter(filter, start, end);
      allIncomingTransfers.push(...transfers);
    }
    
    let totalReceived = ethers.BigNumber.from(0);
    for (const transfer of allIncomingTransfers) {
      totalReceived = totalReceived.add(transfer.args.value);
    }
    
    console.log(`Total TORUS received: ${ethers.utils.formatEther(totalReceived)} TORUS`);
    console.log(`Number of incoming transfers: ${allIncomingTransfers.length}\n`);
    
    console.log('2. Getting all TORUS burns (transfers to 0x0)...');
    const allBurns = [];
    
    for (let start = deployBlock; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      
      const filter = torusContract.filters.Transfer(
        BUY_PROCESS_CONTRACT,
        '0x0000000000000000000000000000000000000000'
      );
      
      const burns = await torusContract.queryFilter(filter, start, end);
      allBurns.push(...burns);
    }
    
    let totalBurned = ethers.BigNumber.from(0);
    for (const burn of allBurns) {
      totalBurned = totalBurned.add(burn.args.value);
    }
    
    console.log(`Total TORUS burned: ${ethers.utils.formatEther(totalBurned)} TORUS`);
    console.log(`Number of burn transfers: ${allBurns.length}\n`);
    
    console.log('3. Getting totalTorusBurnt from contract state...');
    const totalTorusBurnt = await buyProcessContract.totalTorusBurnt();
    console.log(`Contract totalTorusBurnt: ${ethers.utils.formatEther(totalTorusBurnt)} TORUS\n`);
    
    console.log('4. Getting all TorusBurned events...');
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
    
    let totalFromEvents = ethers.BigNumber.from(0);
    for (const event of allTorusBurnedEvents) {
      totalFromEvents = totalFromEvents.add(event.args.amount);
    }
    
    console.log(`Total from TorusBurned events: ${ethers.utils.formatEther(totalFromEvents)} TORUS`);
    console.log(`Number of TorusBurned events: ${allTorusBurnedEvents.length}\n`);
    
    console.log('5. Analysis:');
    console.log(`   TORUS received by contract: ${ethers.utils.formatEther(totalReceived)}`);
    console.log(`   TORUS actually burned: ${ethers.utils.formatEther(totalBurned)}`);
    console.log(`   Difference (unburned): ${ethers.utils.formatEther(totalReceived.sub(totalBurned))} TORUS`);
    console.log('');
    console.log(`   Contract totalTorusBurnt: ${ethers.utils.formatEther(totalTorusBurnt)}`);
    console.log(`   Sum of TorusBurned events: ${ethers.utils.formatEther(totalFromEvents)}`);
    console.log(`   Difference: ${ethers.utils.formatEther(totalTorusBurnt.sub(totalFromEvents))} TORUS`);
    console.log('');
    console.log(`   Discrepancy between totalTorusBurnt and actual burns: ${ethers.utils.formatEther(totalTorusBurnt.sub(totalBurned))} TORUS`);
    
    // Check if contract currently holds any TORUS
    console.log('\n6. Checking current TORUS balance of Buy & Process contract...');
    const currentBalance = await torusContract.balanceOf(BUY_PROCESS_CONTRACT);
    console.log(`Current TORUS balance: ${ethers.utils.formatEther(currentBalance)} TORUS`);
    
    if (currentBalance.gt(0)) {
      console.log('\n⚠️  The contract is currently holding TORUS that hasn\'t been burned yet!');
      console.log('This TORUS is counted in totalTorusBurnt but not yet burned to 0x0');
    }
    
    // Show some example incoming transfers
    console.log('\n7. First few incoming TORUS transfers:');
    for (let i = 0; i < Math.min(5, allIncomingTransfers.length); i++) {
      const transfer = allIncomingTransfers[i];
      console.log(`   Transfer #${i + 1}:`);
      console.log(`     From: ${transfer.args.from}`);
      console.log(`     Amount: ${ethers.utils.formatEther(transfer.args.value)} TORUS`);
      console.log(`     Block: ${transfer.blockNumber}`);
      console.log(`     Tx: ${transfer.transactionHash}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findMissingTorus().catch(console.error);