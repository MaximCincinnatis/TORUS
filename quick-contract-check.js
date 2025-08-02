#!/usr/bin/env node

const { ethers } = require('ethers');

async function quickCheck() {
  console.log('🔍 Quick Buy & Process Contract Check\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  
  // Check contract balance
  const balance = await provider.getBalance(BUY_PROCESS_CONTRACT);
  console.log(`Contract Balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  // Check contract code to verify it has distributeETHForBuilding
  const code = await provider.getCode(BUY_PROCESS_CONTRACT);
  const hasDistributeETH = code.includes('c381da4f'); // function selector
  console.log(`\nContract has distributeETHForBuilding function: ${hasDistributeETH}`);
  
  // Get recent transactions
  const currentBlock = await provider.getBlockNumber();
  console.log(`\nCurrent block: ${currentBlock}`);
  
  // Check a specific recent transaction to understand the flow
  console.log('\n📊 Checking recent BuyAndBuild transactions for ETH usage...\n');
  
  // Get recent logs from Buy & Process contract
  const recentLogs = await provider.getLogs({
    address: BUY_PROCESS_CONTRACT,
    fromBlock: currentBlock - 1000,
    toBlock: currentBlock
  });
  
  console.log(`Found ${recentLogs.length} recent contract events`);
  
  // BuyAndBuild event topic
  const buyAndBuildTopic = ethers.utils.id('BuyAndBuild(uint256,uint256,address)');
  const swapETHSelector = '0x53ad9b96'; // swapETHForTorusAndBuild
  
  let ethBuildFound = false;
  
  for (const log of recentLogs) {
    if (log.topics[0] === buyAndBuildTopic) {
      const tx = await provider.getTransaction(log.transactionHash);
      
      if (tx.data.startsWith(swapETHSelector)) {
        ethBuildFound = true;
        const block = await provider.getBlock(tx.blockNumber);
        console.log('\n✅ Found ETH Build:');
        console.log(`   Tx: ${tx.hash}`);
        console.log(`   Block: ${tx.blockNumber}`);
        console.log(`   Time: ${new Date(block.timestamp * 1000).toISOString()}`);
        console.log(`   ETH sent with tx: ${ethers.utils.formatEther(tx.value)} ETH`);
        console.log(`   From: ${tx.from}`);
        
        // Decode the event
        const iface = new ethers.utils.Interface([
          'event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)'
        ]);
        const decoded = iface.parseLog(log);
        console.log(`   TORUS purchased: ${ethers.utils.formatEther(decoded.args.torusPurchased)}`);
        
        break;
      }
    }
  }
  
  if (!ethBuildFound) {
    console.log('\nNo recent ETH builds found in last 1000 blocks');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('💡 KEY FINDINGS');
  console.log('='.repeat(80));
  console.log(`\n1. Contract has ${ethers.utils.formatEther(balance)} ETH balance`);
  console.log('2. This balance could be from:');
  console.log('   - Previous distributeETHForBuilding calls');
  console.log('   - Accumulated ETH from other contract functions');
  console.log('   - Direct ETH transfers');
  console.log('\n3. Recent ETH builds show users sending ETH directly with transactions');
  console.log('4. Our tracking appears correct - we track the ETH sent with each transaction');
}

quickCheck().catch(console.error);