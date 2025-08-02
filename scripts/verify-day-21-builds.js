#!/usr/bin/env node

/**
 * Verify Day 21 builds details
 */

const { ethers } = require('ethers');

async function verifyBuilds() {
  console.log('🔍 Verifying Day 21 builds...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const BUY_PROCESS = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  
  const abi = ['event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)'];
  const contract = new ethers.Contract(BUY_PROCESS, abi, provider);
  
  // Get the build event from Day 21
  const events = await contract.queryFilter(contract.filters.BuyAndBuild(), 23033590, 23034903);
  
  console.log(`Found ${events.length} build event(s)\n`);
  
  for (const event of events) {
    const tx = await provider.getTransaction(event.transactionHash);
    const block = await provider.getBlock(event.blockNumber);
    
    console.log(`Build Event:`);
    console.log(`  TX: ${event.transactionHash}`);
    console.log(`  Block: ${event.blockNumber}`);
    console.log(`  Time: ${new Date(block.timestamp * 1000).toISOString()}`);
    console.log(`  Token Allocated: ${ethers.utils.formatEther(event.args.tokenAllocated)} TitanX`);
    console.log(`  TORUS Purchased: ${ethers.utils.formatEther(event.args.torusPurchased)}`);
    console.log(`  Caller: ${event.args.caller}`);
    
    // Check if ETH or TitanX build
    if (tx.data.startsWith('0x53ad9b96')) {
      console.log(`  Type: ETH Build`);
      console.log(`  ETH Value: ${ethers.utils.formatEther(tx.value)}`);
    } else {
      console.log(`  Type: TitanX Build`);
    }
  }
}

verifyBuilds().catch(console.error);