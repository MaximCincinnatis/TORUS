#!/usr/bin/env node

/**
 * Trace ETH distribution from Create & Stake to Buy & Process
 */

const { ethers } = require('ethers');

async function traceETHDistribution() {
  console.log('🔍 Tracing ETH distribution mechanism...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  
  // ABI for Create & Stake contract
  const createStakeABI = [
    'function distributeETHForBurning() external',
    'function distributeETHForBuilding() external',
    'function pendingETHForBurning() view returns (uint256)',
    'function pendingETHForBuilding() view returns (uint256)',
    'event ETHDistributedForBurning(uint256 amount)',
    'event ETHDistributedForBuilding(uint256 amount)'
  ];
  
  const createStakeContract = new ethers.Contract(CREATE_STAKE_CONTRACT, createStakeABI, provider);
  
  try {
    // Check pending ETH amounts
    console.log('📊 Create & Stake Contract ETH Distribution Info:');
    console.log('================================================\n');
    
    const [pendingBurning, pendingBuilding] = await Promise.all([
      createStakeContract.pendingETHForBurning().catch(() => null),
      createStakeContract.pendingETHForBuilding().catch(() => null)
    ]);
    
    if (pendingBurning !== null) {
      console.log(`Pending ETH for burning: ${ethers.utils.formatEther(pendingBurning)} ETH`);
    }
    if (pendingBuilding !== null) {
      console.log(`Pending ETH for building: ${ethers.utils.formatEther(pendingBuilding)} ETH`);
    }
    
    // Get recent distribution events
    console.log('\n📈 Recent ETH Distribution Events:');
    console.log('==================================\n');
    
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 50000; // About 1 week back
    
    // Try to get distribution events
    try {
      const burnDistEvents = await createStakeContract.queryFilter(
        createStakeContract.filters.ETHDistributedForBurning(),
        fromBlock,
        currentBlock
      );
      
      const buildDistEvents = await createStakeContract.queryFilter(
        createStakeContract.filters.ETHDistributedForBuilding(),
        fromBlock,
        currentBlock
      );
      
      console.log(`Found ${burnDistEvents.length} ETHDistributedForBurning events`);
      console.log(`Found ${buildDistEvents.length} ETHDistributedForBuilding events`);
      
      // Show recent burn distributions
      if (burnDistEvents.length > 0) {
        console.log('\nRecent Burn Distributions:');
        burnDistEvents.slice(-5).forEach(async (event, i) => {
          const block = await provider.getBlock(event.blockNumber);
          const date = new Date(block.timestamp * 1000).toISOString();
          console.log(`  ${i + 1}. ${ethers.utils.formatEther(event.args.amount)} ETH at ${date}`);
          console.log(`     Tx: ${event.transactionHash}`);
        });
      }
    } catch (e) {
      console.log('Could not fetch distribution events (contract might not emit these)');
    }
    
    // Analyze a sample transaction to understand the flow
    console.log('\n🔬 Analyzing ETH Distribution Flow:');
    console.log('===================================\n');
    
    // Look for recent transactions between contracts
    const filter = {
      address: BUY_PROCESS_CONTRACT,
      fromBlock: currentBlock - 10000,
      toBlock: currentBlock
    };
    
    const logs = await provider.getLogs(filter);
    console.log(`Found ${logs.length} recent events at Buy & Process contract`);
    
    // Check internal transactions
    console.log('\n📋 ETH Distribution Mechanism:');
    console.log('==============================\n');
    console.log('1. Users interact with Create & Stake contract (create tokens, stake, etc.)');
    console.log('2. ETH fees accumulate in the Create & Stake contract');
    console.log('3. Someone calls distributeETHForBurning() on Create & Stake');
    console.log('4. This sends ETH to the Buy & Process contract');
    console.log('5. Buy & Process contract then uses this ETH to buy and burn TORUS');
    console.log('\nThis is why burn transactions show 0 ETH - the ETH was sent earlier!');
    
    // Get balances to verify
    const [createStakeBalance, buyProcessBalance] = await Promise.all([
      provider.getBalance(CREATE_STAKE_CONTRACT),
      provider.getBalance(BUY_PROCESS_CONTRACT)
    ]);
    
    console.log('\n💰 Current Contract Balances:');
    console.log('=============================');
    console.log(`Create & Stake: ${ethers.utils.formatEther(createStakeBalance)} ETH`);
    console.log(`Buy & Process: ${ethers.utils.formatEther(buyProcessBalance)} ETH`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

traceETHDistribution().catch(console.error);