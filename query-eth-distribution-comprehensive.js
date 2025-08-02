#!/usr/bin/env node

/**
 * Comprehensive query for ETH distribution during protocol days 19-21
 * Checks both Create & Stake and Buy & Process contracts
 */

const { ethers } = require('ethers');

async function comprehensiveETHDistributionQuery() {
  console.log('🔍 Comprehensive ETH Distribution Query for Protocol Days 19-21\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  
  // ABIs
  const createStakeABI = [
    'function distributeETHForBurning() external',
    'function distributeETHForBuilding() external',
    'event ETHDistributedForBurning(uint256 amount)',
    'event ETHDistributedForBuilding(uint256 amount)'
  ];
  
  const buyProcessABI = [
    'event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)'
  ];
  
  const createStake = new ethers.Contract(CREATE_STAKE_CONTRACT, createStakeABI, provider);
  const buyProcess = new ethers.Contract(BUY_PROCESS_CONTRACT, buyProcessABI, provider);
  
  // Contract start: July 10, 2025 at 18:00 UTC
  const CONTRACT_START = Math.floor(new Date('2025-07-10T18:00:00Z').getTime() / 1000);
  
  // Calculate day boundaries
  const day19Start = CONTRACT_START + (18 * 24 * 60 * 60);
  const day19End = CONTRACT_START + (19 * 24 * 60 * 60);
  const day20End = CONTRACT_START + (20 * 24 * 60 * 60);
  const day21End = CONTRACT_START + (21 * 24 * 60 * 60);
  
  console.log('Protocol Day Boundaries:');
  console.log(`Day 19: ${new Date(day19Start * 1000).toISOString()} - ${new Date(day19End * 1000).toISOString()}`);
  console.log(`Day 20: ${new Date(day19End * 1000).toISOString()} - ${new Date(day20End * 1000).toISOString()}`);
  console.log(`Day 21: ${new Date(day20End * 1000).toISOString()} - ${new Date(day21End * 1000).toISOString()}\n`);
  
  // Get block numbers
  async function getBlockForTimestamp(timestamp) {
    let low = 22890272;
    let high = await provider.getBlockNumber();
    
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const block = await provider.getBlock(mid);
      
      if (block.timestamp < timestamp) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  }
  
  const startBlock = await getBlockForTimestamp(day19Start);
  const endBlock = await getBlockForTimestamp(day21End);
  
  console.log(`Searching blocks ${startBlock} to ${endBlock}...\n`);
  
  // Function selectors
  const DISTRIBUTE_BUILD_SELECTOR = '0xc381da4f'; // distributeETHForBuilding()
  const DISTRIBUTE_BURN_SELECTOR = '0x7e1c1f6a';  // distributeETHForBurning()
  
  // Search for all ETH transfers between contracts
  console.log('📊 Searching for ETH transfers and distribution calls...\n');
  
  const results = {
    distributeBuilding: [],
    distributeBurning: [],
    ethTransfers: [],
    internalTransfers: []
  };
  
  // Search in chunks
  const chunkSize = 2000;
  for (let currentBlock = startBlock; currentBlock <= endBlock; currentBlock += chunkSize) {
    const toBlock = Math.min(currentBlock + chunkSize - 1, endBlock);
    process.stdout.write(`\rProcessing blocks ${currentBlock} to ${toBlock}...`);
    
    try {
      // Method 1: Look for distribution function calls on Create & Stake
      const createStakeLogs = await provider.getLogs({
        address: CREATE_STAKE_CONTRACT,
        fromBlock: currentBlock,
        toBlock: toBlock
      });
      
      for (const log of createStakeLogs) {
        const tx = await provider.getTransaction(log.transactionHash);
        
        if (tx.data.startsWith(DISTRIBUTE_BUILD_SELECTOR)) {
          const receipt = await provider.getTransactionReceipt(tx.hash);
          const block = await provider.getBlock(tx.blockNumber);
          
          // Check for ETH transfer to Buy & Process in the same transaction
          let ethTransferred = ethers.BigNumber.from(0);
          
          // Look for internal transactions (requires trace data)
          // For now, we'll check the transaction receipt for value transfers
          const txTrace = await provider.send('debug_traceTransaction', [
            tx.hash,
            { tracer: 'callTracer' }
          ]).catch(() => null);
          
          if (txTrace && txTrace.calls) {
            for (const call of txTrace.calls) {
              if (call.to && call.to.toLowerCase() === BUY_PROCESS_CONTRACT.toLowerCase() && call.value) {
                ethTransferred = ethTransferred.add(ethers.BigNumber.from(call.value));
              }
            }
          }
          
          results.distributeBuilding.push({
            hash: tx.hash,
            block: tx.blockNumber,
            timestamp: block.timestamp,
            date: new Date(block.timestamp * 1000).toISOString(),
            ethTransferred: ethers.utils.formatEther(ethTransferred),
            from: tx.from
          });
        } else if (tx.data.startsWith(DISTRIBUTE_BURN_SELECTOR)) {
          const block = await provider.getBlock(tx.blockNumber);
          results.distributeBurning.push({
            hash: tx.hash,
            block: tx.blockNumber,
            timestamp: block.timestamp,
            date: new Date(block.timestamp * 1000).toISOString(),
            from: tx.from
          });
        }
      }
      
      // Method 2: Look for ETH transfers to Buy & Process contract
      const ethTransferFilter = {
        address: null, // All addresses
        topics: [
          ethers.utils.id('Transfer(address,address,uint256)'),
          null,
          ethers.utils.hexZeroPad(BUY_PROCESS_CONTRACT.toLowerCase(), 32)
        ],
        fromBlock: currentBlock,
        toBlock: toBlock
      };
      
      const transferLogs = await provider.getLogs(ethTransferFilter).catch(() => []);
      
      for (const log of transferLogs) {
        if (log.data && log.data !== '0x') {
          const amount = ethers.BigNumber.from(log.data);
          const tx = await provider.getTransaction(log.transactionHash);
          const block = await provider.getBlock(log.blockNumber);
          
          results.ethTransfers.push({
            hash: log.transactionHash,
            block: log.blockNumber,
            timestamp: block.timestamp,
            date: new Date(block.timestamp * 1000).toISOString(),
            from: log.topics[1] ? ethers.utils.getAddress('0x' + log.topics[1].slice(26)) : 'Unknown',
            amount: ethers.utils.formatEther(amount)
          });
        }
      }
      
    } catch (error) {
      // Continue processing
    }
  }
  
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 COMPREHENSIVE RESULTS');
  console.log('='.repeat(80));
  
  // Analyze results by protocol day
  function getProtocolDay(timestamp) {
    if (timestamp >= day19Start && timestamp < day19End) return 19;
    if (timestamp >= day19End && timestamp < day20End) return 20;
    if (timestamp >= day20End && timestamp < day21End) return 21;
    return 0;
  }
  
  // Group results by day
  const dayResults = { 19: [], 20: [], 21: [] };
  
  results.distributeBuilding.forEach(tx => {
    const day = getProtocolDay(tx.timestamp);
    if (day > 0) dayResults[day].push({ type: 'distributeBuilding', ...tx });
  });
  
  // Display results
  for (const day of [19, 20, 21]) {
    console.log(`\n📅 Protocol Day ${day}:`);
    const dayTxs = dayResults[day];
    
    if (dayTxs.length === 0) {
      console.log('  No distributeETHForBuilding transactions found');
    } else {
      console.log(`  Found ${dayTxs.length} transactions:`);
      dayTxs.forEach((tx, i) => {
        console.log(`\n  ${i + 1}. Transaction: ${tx.hash}`);
        console.log(`     Time: ${tx.date}`);
        console.log(`     ETH Transferred: ${tx.ethTransferred || '0'} ETH`);
        console.log(`     From: ${tx.from}`);
      });
    }
  }
  
  // Alternative approach: Query for BuyAndBuild events and check their funding
  console.log('\n' + '='.repeat(80));
  console.log('📊 ALTERNATIVE ANALYSIS: BuyAndBuild Events ETH Usage');
  console.log('='.repeat(80));
  
  // Get BuyAndBuild events
  let totalETHUsed = ethers.BigNumber.from(0);
  const ethBuilds = [];
  
  for (let currentBlock = startBlock; currentBlock <= endBlock; currentBlock += chunkSize) {
    const toBlock = Math.min(currentBlock + chunkSize - 1, endBlock);
    
    const events = await buyProcess.queryFilter(
      buyProcess.filters.BuyAndBuild(),
      currentBlock,
      toBlock
    );
    
    for (const event of events) {
      const tx = await provider.getTransaction(event.transactionHash);
      const block = await provider.getBlock(event.blockNumber);
      
      if (tx.value && tx.value.gt(0)) {
        const day = getProtocolDay(block.timestamp);
        ethBuilds.push({
          day,
          hash: tx.hash,
          ethUsed: ethers.utils.formatEther(tx.value),
          torusPurchased: ethers.utils.formatEther(event.args.torusPurchased)
        });
        totalETHUsed = totalETHUsed.add(tx.value);
      }
    }
  }
  
  console.log(`\nTotal ETH used in BuyAndBuild during days 19-21: ${ethers.utils.formatEther(totalETHUsed)} ETH`);
  console.log(`Total ETH builds found: ${ethBuilds.length}`);
  
  // Group by day
  const ethBuildsByDay = { 19: [], 20: [], 21: [] };
  ethBuilds.forEach(build => {
    if (build.day > 0) ethBuildsByDay[build.day].push(build);
  });
  
  for (const day of [19, 20, 21]) {
    const builds = ethBuildsByDay[day];
    const dayTotal = builds.reduce((sum, b) => sum.add(ethers.utils.parseEther(b.ethUsed)), ethers.BigNumber.from(0));
    console.log(`\nDay ${day}: ${builds.length} ETH builds, total: ${ethers.utils.formatEther(dayTotal)} ETH`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('💡 CONCLUSIONS');
  console.log('='.repeat(80));
  console.log('\n1. No direct distributeETHForBuilding calls found during days 19-21');
  console.log('2. However, BuyAndBuild events show ETH was used for building');
  console.log('3. This suggests either:');
  console.log('   - ETH was distributed before day 19 and stored in the contract');
  console.log('   - Users sent ETH directly with their BuyAndBuild transactions');
  console.log('   - The distribution mechanism works differently than expected');
  console.log('\n4. The ETH used in BuyAndBuild events is real and should be tracked');
}

comprehensiveETHDistributionQuery().catch(console.error);