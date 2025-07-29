#!/usr/bin/env node

/**
 * Fix ETH duplicates using the CORRECT method
 * Use event.args.tokenAllocated instead of tx.value (which is always 0)
 */

const { ethers } = require('ethers');
const fs = require('fs');

async function getProvider() {
  const provider = new ethers.providers.JsonRpcProvider('https://ethereum.publicnode.com');
  await provider.getBlockNumber();
  return provider;
}

async function main() {
  console.log('🔧 Fixing ETH Values using CORRECT Method (event.args.tokenAllocated)');
  
  const provider = await getProvider();
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  
  // Load data
  const data = JSON.parse(fs.readFileSync('public/data/buy-process-data.json', 'utf8'));
  
  // Contract ABI  
  const buyProcessABI = [
    'event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)'
  ];
  
  const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, buyProcessABI, provider);
  
  // Find days with duplicate ETH values
  const duplicates = [2, 3, 4, 5, 7, 9, 10, 17, 18]; // Known duplicate days
  
  console.log(`📋 Fixing duplicate ETH values on days: ${duplicates.join(', ')}`);
  
  // Get ALL BuyAndBuild events in chunks
  console.log('\n📡 Fetching ALL BuyAndBuild events...');
  const startBlock = 22890272;
  const currentBlock = await provider.getBlockNumber();
  const chunkSize = 5000;
  const allEvents = [];
  
  for (let fromBlock = startBlock; fromBlock <= currentBlock; fromBlock += chunkSize) {
    const toBlock = Math.min(fromBlock + chunkSize - 1, currentBlock);
    console.log(`   Scanning blocks ${fromBlock} to ${toBlock}...`);
    const events = await contract.queryFilter(contract.filters.BuyAndBuild(), fromBlock, toBlock);
    allEvents.push(...events);
  }
  
  console.log(`📥 Found ${allEvents.length} total BuyAndBuild events`);
  
  // Group events by protocol day
  const eventsByDay = new Map();
  
  for (const event of allEvents) {
    // Get block timestamp to determine protocol day
    const block = await provider.getBlock(event.blockNumber);
    const timestamp = block.timestamp;
    
    // Calculate protocol day (same logic as existing system)
    const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
    const msPerDay = 24 * 60 * 60 * 1000;
    const dateObj = new Date(timestamp * 1000);
    const protocolDay = Math.floor((dateObj.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1;
    
    if (!eventsByDay.has(protocolDay)) {
      eventsByDay.set(protocolDay, []);
    }
    eventsByDay.get(protocolDay).push(event);
  }
  
  console.log(`📊 Events span days ${Math.min(...eventsByDay.keys())} to ${Math.max(...eventsByDay.keys())}`);
  
  // Fix each duplicate day with correct ETH values
  for (const protocolDay of duplicates) {
    console.log(`\n🔄 Fixing Day ${protocolDay}...`);
    
    const dayData = data.dailyData.find(d => d.protocolDay === protocolDay);
    if (!dayData) {
      console.log(`   ❌ Day ${protocolDay} not found in data`);
      continue;
    }
    
    const events = eventsByDay.get(protocolDay) || [];
    console.log(`   📥 Found ${events.length} BuyAndBuild events for day ${protocolDay}`);
    
    if (events.length === 0) {
      console.log(`   ℹ️  No events found, setting ETH to 0`);
      const oldValue = dayData.ethUsedForBuilds;
      dayData.ethUsedForBuilds = 0;
      dayData.ethUsed = (dayData.ethUsedForBurns || 0) + 0;
      console.log(`   ✅ Updated: ${oldValue} → 0 ETH`);
      continue;
    }
    
    // Calculate total ETH using CORRECT method
    let totalETH = 0;
    for (const event of events) {
      // Use event.args.tokenAllocated (the actual ETH amount used)
      const ethAmount = parseFloat(ethers.utils.formatEther(event.args.tokenAllocated));
      totalETH += ethAmount;
      console.log(`   💰 Event ${event.transactionHash.substring(0, 10)}...: ${ethAmount} ETH`);
    }
    
    console.log(`   📊 Day ${protocolDay}: ${events.length} builds, Total: ${totalETH} ETH`);
    
    // Update the data
    const oldValue = dayData.ethUsedForBuilds;
    dayData.ethUsedForBuilds = totalETH;
    dayData.ethUsed = (dayData.ethUsedForBurns || 0) + totalETH;
    console.log(`   ✅ Updated: ${oldValue} → ${totalETH} ETH`);
  }
  
  // Recalculate totals
  let totalETHBuilds = 0;
  data.dailyData.forEach(day => {
    totalETHBuilds += day.ethUsedForBuilds || 0;
  });
  
  data.totals.ethUsedForBuilds = totalETHBuilds.toFixed(18);
  
  // Update metadata
  data.lastUpdated = new Date().toISOString();
  
  // Save updated data
  fs.writeFileSync('public/data/buy-process-data.json', JSON.stringify(data, null, 2));
  
  console.log('\n✅ ETH values fixed using correct method!');
  console.log(`💰 New total ETH used for builds: ${totalETHBuilds} ETH`);
  
  // Final validation
  console.log('\n🔍 Final validation - checking for duplicates...');
  const ethValues = {};
  data.dailyData.forEach(day => {
    if (day.buyAndBuildCount > 0 && day.ethUsedForBuilds > 0) {
      const eth = day.ethUsedForBuilds.toString();
      if (!ethValues[eth]) ethValues[eth] = [];
      ethValues[eth].push(day.protocolDay);
    }
  });
  
  let foundDuplicates = false;
  Object.entries(ethValues).forEach(([ethValue, days]) => {
    if (days.length > 1) {
      console.log(`❌ Still duplicate: ${ethValue} on days ${days.join(', ')}`);
      foundDuplicates = true;
    }
  });
  
  if (!foundDuplicates) {
    console.log('✅ No duplicate values remaining!');
  }
}

main().catch(console.error);