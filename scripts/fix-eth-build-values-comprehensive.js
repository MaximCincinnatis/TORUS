#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');

// RPC endpoints for rotation
const RPC_ENDPOINTS = [
  process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/WRLfj0ast6psCq5mCYB8gptqmpjl5gRV',
  'https://mainnet.infura.io/v3/816df2901a454b18b7df259e61f92cd2',
  'https://rpc.ankr.com/eth',
  'https://eth.drpc.org'
];

let currentRPCIndex = 0;
let rpcCallCount = 0;

// Contracts
const BUY_PROCESS_ADDRESS = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
const BUY_PROCESS_ABI = [
  "event BuyAndBuild(address indexed user, uint256 torusAmount, uint256 userRewardsAmount, uint256 protocolRewardsAmount, uint256 devRewardsAmount, uint256 lpRewardsAmount, uint256 torusPurchased, uint256 tokenAllocated)",
  "function buyAndBuildWithETH(address, address) payable",
  "function buyAndBuildWithTitanX(address, address, uint256)"
];

// Get next RPC provider
function getNextProvider() {
  const endpoint = RPC_ENDPOINTS[currentRPCIndex];
  currentRPCIndex = (currentRPCIndex + 1) % RPC_ENDPOINTS.length;
  return new ethers.providers.JsonRpcProvider(endpoint);
}

// Retry with rotation
async function retryWithRotation(fn, maxRetries = RPC_ENDPOINTS.length) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      rpcCallCount++;
      return await fn(getNextProvider());
    } catch (error) {
      lastError = error;
      console.log(`  RPC attempt ${i + 1} failed: ${error.message}`);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between retries
      }
    }
  }
  throw lastError;
}

// Get protocol day from timestamp
function getProtocolDay(timestamp) {
  const CONTRACT_START = new Date('2024-07-10T15:00:00Z'); // Actual start date
  const daysSinceStart = Math.floor((timestamp * 1000 - CONTRACT_START.getTime()) / (24 * 60 * 60 * 1000));
  return daysSinceStart + 1;
}

async function fixETHBuildValues() {
  console.log('🔧 Comprehensive ETH Build Values Fix\n');
  
  // Load current data
  const data = JSON.parse(fs.readFileSync('public/data/buy-process-data.json', 'utf8'));
  
  console.log('📋 Fetching ALL BuyAndBuild events from blockchain...\n');
  
  // Get all BuyAndBuild events
  const allEvents = await retryWithRotation(async (provider) => {
    const contract = new ethers.Contract(BUY_PROCESS_ADDRESS, BUY_PROCESS_ABI, provider);
    
    // Get deployment block (approximate)
    const DEPLOYMENT_BLOCK = 20330000; // July 2024
    const currentBlock = await provider.getBlockNumber();
    
    console.log(`  Searching from block ${DEPLOYMENT_BLOCK} to ${currentBlock}`);
    
    // Query in chunks to avoid timeouts
    const events = [];
    const CHUNK_SIZE = 10000;
    
    for (let fromBlock = DEPLOYMENT_BLOCK; fromBlock < currentBlock; fromBlock += CHUNK_SIZE) {
      const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, currentBlock);
      console.log(`  Querying blocks ${fromBlock} to ${toBlock}...`);
      
      try {
        const chunkEvents = await contract.queryFilter(
          contract.filters.BuyAndBuild(),
          fromBlock,
          toBlock
        );
        events.push(...chunkEvents);
      } catch (error) {
        console.log(`  Warning: Failed to query blocks ${fromBlock}-${toBlock}, skipping`);
      }
    }
    
    return events;
  });
  
  console.log(`\n✅ Found ${allEvents.length} BuyAndBuild events total\n`);
  
  // Group events by protocol day
  const eventsByDay = new Map();
  
  for (const event of allEvents) {
    // Get block timestamp
    const block = await retryWithRotation(async (provider) => 
      provider.getBlock(event.blockNumber)
    );
    
    const protocolDay = getProtocolDay(block.timestamp);
    
    if (!eventsByDay.has(protocolDay)) {
      eventsByDay.set(protocolDay, []);
    }
    eventsByDay.get(protocolDay).push({
      event,
      timestamp: block.timestamp,
      txHash: event.transactionHash
    });
  }
  
  console.log(`📊 Events grouped into ${eventsByDay.size} protocol days\n`);
  
  // Process each day
  for (const [protocolDay, dayEvents] of eventsByDay) {
    const dayData = data.dailyData.find(d => d.protocolDay === protocolDay);
    
    if (!dayData) {
      console.log(`⚠️  Day ${protocolDay} not in JSON data, skipping`);
      continue;
    }
    
    console.log(`\n📅 Protocol Day ${protocolDay} (${dayData.date})`);
    console.log(`  Events: ${dayEvents.length}`);
    console.log(`  Current ETH: ${dayData.ethUsedForBuilds}`);
    
    // Get ETH values for each transaction
    let totalETH = 0;
    const ethTransactions = [];
    
    for (const { txHash } of dayEvents) {
      const tx = await retryWithRotation(async (provider) => 
        provider.getTransaction(txHash)
      );
      
      if (tx && tx.value && !tx.value.isZero()) {
        const ethAmount = parseFloat(ethers.utils.formatEther(tx.value));
        totalETH += ethAmount;
        ethTransactions.push({
          tx: txHash,
          eth: ethAmount
        });
      }
    }
    
    console.log(`  ETH transactions: ${ethTransactions.length}/${dayEvents.length}`);
    console.log(`  Total ETH: ${totalETH.toFixed(6)}`);
    
    // Update if different
    if (Math.abs(dayData.ethUsedForBuilds - totalETH) > 0.000001) {
      console.log(`  ✅ UPDATE: ${dayData.ethUsedForBuilds} → ${totalETH.toFixed(6)}`);
      dayData.ethUsedForBuilds = parseFloat(totalETH.toFixed(6));
      
      // Update total ethUsed
      const ethFromBurns = dayData.ethUsedForBurns || 0;
      dayData.ethUsed = parseFloat((ethFromBurns + totalETH).toFixed(6));
    }
    
    // Show transactions if any
    if (ethTransactions.length > 0) {
      console.log('  ETH Transactions:');
      ethTransactions.forEach(({ tx, eth }) => {
        console.log(`    ${tx}: ${eth} ETH`);
      });
    }
  }
  
  // Recalculate totals
  let totalETHForBuilds = 0;
  let totalETHUsed = 0;
  
  data.dailyData.forEach(day => {
    totalETHForBuilds += day.ethUsedForBuilds || 0;
    totalETHUsed += day.ethUsed || 0;
  });
  
  data.totals.ethUsedForBuilds = totalETHForBuilds.toFixed(18);
  data.totals.ethBurn = totalETHUsed.toFixed(18);
  
  // Save updated data
  fs.writeFileSync('public/data/buy-process-data.json', JSON.stringify(data, null, 2));
  
  console.log('\n✅ Data updated successfully!');
  console.log(`📊 Total RPC calls: ${rpcCallCount}`);
  console.log(`💰 Total ETH for builds: ${totalETHForBuilds.toFixed(6)} ETH`);
  console.log(`💰 Total ETH used: ${totalETHUsed.toFixed(6)} ETH`);
  
  // Validate no duplicates
  const ethValues = new Map();
  data.dailyData.forEach(day => {
    if (day.ethUsedForBuilds > 0) {
      const key = day.ethUsedForBuilds.toFixed(6);
      if (!ethValues.has(key)) {
        ethValues.set(key, []);
      }
      ethValues.get(key).push(day.protocolDay);
    }
  });
  
  console.log('\n🔍 Validation - Checking for duplicate values:');
  let hasDuplicates = false;
  ethValues.forEach((days, value) => {
    if (days.length > 1) {
      console.log(`  ⚠️  ${value} ETH appears on days: ${days.join(', ')}`);
      hasDuplicates = true;
    }
  });
  
  if (!hasDuplicates) {
    console.log('  ✅ No duplicate ETH values found!');
  }
}

// Run
fixETHBuildValues().catch(console.error);