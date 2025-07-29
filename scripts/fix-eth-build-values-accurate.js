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

// TorusBuyAndProcess contract
const BUY_PROCESS_ADDRESS = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
const BUY_PROCESS_ABI = [
  "event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)",
  "function buyAndBuildWithETH(address, address) payable",
  "function buyAndBuildWithTitanX(address, address, uint256)"
];

// Get next RPC provider with rotation
function getNextProvider() {
  const endpoint = RPC_ENDPOINTS[currentRPCIndex];
  currentRPCIndex = (currentRPCIndex + 1) % RPC_ENDPOINTS.length;
  return new ethers.providers.JsonRpcProvider(endpoint);
}

// Retry with different RPCs
async function retryWithRotation(fn, maxRetries = RPC_ENDPOINTS.length) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      rpcCallCount++;
      const provider = getNextProvider();
      return await fn(provider);
    } catch (error) {
      console.log(`RPC attempt ${i + 1} failed: ${error.message}, trying next...`);
      if (i === maxRetries - 1) throw error;
    }
  }
}

// Get exact ETH value from transaction
async function getExactETHValue(txHash) {
  return await retryWithRotation(async (provider) => {
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!tx || !receipt) {
      throw new Error(`Transaction not found: ${txHash}`);
    }
    
    // Check if it's an ETH build (has value)
    if (tx.value && !tx.value.isZero()) {
      return parseFloat(ethers.utils.formatEther(tx.value));
    }
    
    // Check for WETH deposits in the transaction
    const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    const WETH_DEPOSIT_TOPIC = '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c'; // Deposit(address,uint256)
    
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === WETH_ADDRESS.toLowerCase() && 
          log.topics[0] === WETH_DEPOSIT_TOPIC) {
        const depositAmount = ethers.BigNumber.from(log.data);
        return parseFloat(ethers.utils.formatEther(depositAmount));
      }
    }
    
    // No ETH found - this is a TitanX build
    return 0;
  });
}

async function fixETHBuildValues() {
  console.log('🔧 Fixing ETH Build Values with Accurate Blockchain Data\n');
  
  // Load current data
  const data = JSON.parse(fs.readFileSync('public/data/buy-process-data.json', 'utf8'));
  
  // Check ALL days from 1 to current protocol day
  const currentProtocolDay = data.currentDay || 20;
  const daysToCheck = [];
  for (let i = 1; i <= currentProtocolDay; i++) {
    daysToCheck.push(i);
  }
  
  console.log(`📋 Checking ALL days from 1 to ${currentProtocolDay}\n`);
  
  // Get BuyAndBuild events for these days
  const contract = new ethers.Contract(BUY_PROCESS_ADDRESS, BUY_PROCESS_ABI, getNextProvider());
  
  // Store all updates to apply at once
  const updates = {};
  
  for (const dayNum of daysToCheck) {
    const dayData = data.dailyData.find(d => d.protocolDay === dayNum);
    if (!dayData) {
      console.log(`❌ Day ${dayNum} not found in data`);
      continue;
    }
    
    console.log(`\n📅 Processing Day ${dayNum} (${dayData.date})`);
    console.log(`  Current ETH value: ${dayData.ethUsedForBuilds}`);
    console.log(`  Build count: ${dayData.buyAndBuildCount}`);
    
    // Skip if no builds on this day
    if (!dayData.buyAndBuildCount || dayData.buyAndBuildCount === 0) {
      console.log(`  ⏭️  Skipping - no builds on this day`);
      continue;
    }
    
    // Calculate block range for this day
    // Dates are correct as 2025
    const dateStr = dayData.date;
    const startTime = new Date(dateStr + 'T15:00:00Z').getTime() / 1000;
    const endTime = startTime + (24 * 60 * 60);
    
    // Get events for this day - use known block ranges for efficiency
    const events = await retryWithRotation(async (provider) => {
      const contract = new ethers.Contract(BUY_PROCESS_ADDRESS, BUY_PROCESS_ABI, provider);
      
      // Estimate block range based on protocol day
      // Contract started at block ~22890000 on July 10, 2025
      const START_BLOCK = 22890000;
      const BLOCKS_PER_DAY = 7200;
      const fromBlock = START_BLOCK + ((dayNum - 1) * BLOCKS_PER_DAY) - 100; // Small buffer
      const toBlock = START_BLOCK + (dayNum * BLOCKS_PER_DAY) + 100; // Small buffer
      
      console.log(`  Searching blocks ${fromBlock} to ${toBlock}`);
      
      const filter = contract.filters.BuyAndBuild();
      const allEvents = await contract.queryFilter(filter, fromBlock, toBlock);
      
      // Filter events by timestamp to be precise
      const dayEvents = [];
      for (const event of allEvents) {
        const block = await provider.getBlock(event.blockNumber);
        if (block.timestamp >= startTime && block.timestamp < endTime) {
          dayEvents.push(event);
        }
      }
      
      return dayEvents;
    });
    
    console.log(`  Found ${events.length} BuyAndBuild events`);
    
    // Get exact ETH values for each transaction
    let totalETH = 0;
    const ethTransactions = [];
    
    for (const event of events) {
      const ethValue = await getExactETHValue(event.transactionHash);
      if (ethValue > 0) {
        ethTransactions.push({
          tx: event.transactionHash,
          eth: ethValue
        });
        totalETH += ethValue;
      }
    }
    
    console.log(`  ETH transactions: ${ethTransactions.length}`);
    console.log(`  Total ETH: ${totalETH.toFixed(6)}`);
    
    // Store the update
    updates[dayNum] = {
      ethUsedForBuilds: parseFloat(totalETH.toFixed(6)),
      transactions: ethTransactions
    };
    
    // Show change if different
    if (Math.abs(dayData.ethUsedForBuilds - totalETH) > 0.000001) {
      console.log(`  ⚠️  CHANGE DETECTED: ${dayData.ethUsedForBuilds} → ${totalETH.toFixed(6)}`);
    }
    
    // Show individual transactions
    if (ethTransactions.length > 0) {
      console.log('  Transactions:');
      ethTransactions.forEach(tx => {
        console.log(`    ${tx.tx.slice(0, 10)}... : ${tx.eth} ETH`);
      });
    }
  }
  
  // Apply all updates
  console.log('\n📝 Applying updates...');
  Object.keys(updates).forEach(dayNum => {
    const day = parseInt(dayNum);
    const update = updates[day];
    const dayData = data.dailyData.find(d => d.protocolDay === day);
    
    if (dayData) {
      dayData.ethUsedForBuilds = update.ethUsedForBuilds;
      
      // Also update total ethUsed
      const ethFromBurns = dayData.ethUsedForBurns || 0;
      dayData.ethUsed = parseFloat((ethFromBurns + update.ethUsedForBuilds).toFixed(6));
    }
  });
  
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
  
  console.log('\n✅ ETH Build values updated with accurate blockchain data');
  console.log(`📊 Total RPC calls made: ${rpcCallCount}`);
  console.log(`💰 New total ETH used for builds: ${totalETHForBuilds.toFixed(6)} ETH`);
  console.log(`💰 New total ETH used overall: ${totalETHUsed.toFixed(6)} ETH`);
  
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
  
  console.log('\n🔍 Validation - Checking for duplicates:');
  let hasDuplicates = false;
  ethValues.forEach((days, value) => {
    if (days.length > 1) {
      console.log(`  ⚠️  ${value} ETH appears on days: ${days.join(', ')}`);
      hasDuplicates = true;
    }
  });
  
  if (!hasDuplicates) {
    console.log('  ✅ No duplicate values found!');
  }
}

// Run the fix
fixETHBuildValues().catch(console.error);