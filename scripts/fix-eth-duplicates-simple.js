#!/usr/bin/env node

/**
 * Simple fix for duplicate ETH values using the WORKING method
 * Uses the exact same logic as update-buy-process-data-fixed-attribution.js
 */

const { ethers } = require('ethers');
const fs = require('fs');

// RPC endpoints
const RPC_ENDPOINTS = [
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.payload.de'
];

async function getProvider() {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(endpoint);
      await provider.getBlockNumber();
      console.log(`Using RPC: ${endpoint}`);
      return provider;
    } catch (e) {
      continue;
    }
  }
  throw new Error('No working RPC providers available');
}

async function retryRPC(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

async function main() {
  console.log('🔧 Fixing Duplicate ETH Values using Working Method');
  
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
  const ethValues = {};
  const duplicateDays = [];
  
  data.dailyData.forEach(day => {
    if (day.buyAndBuildCount > 0 && day.ethUsedForBuilds > 0) {
      const eth = day.ethUsedForBuilds.toString();
      if (!ethValues[eth]) ethValues[eth] = [];
      ethValues[eth].push(day.protocolDay);
    }
  });
  
  // Find duplicates
  Object.entries(ethValues).forEach(([ethValue, days]) => {
    if (days.length > 1) {
      console.log(`📋 Duplicate ETH value ${ethValue} on days: ${days.join(', ')}`);
      duplicateDays.push(...days);
    }
  });
  
  if (duplicateDays.length === 0) {
    console.log('✅ No duplicate ETH values found');
    return;
  }
  
  // Fix each duplicate day by fetching real ETH values
  for (const protocolDay of [...new Set(duplicateDays)]) {
    console.log(`\n🔄 Fixing Day ${protocolDay}...`);
    
    const dayData = data.dailyData.find(d => d.protocolDay === protocolDay);
    if (!dayData || dayData.buyAndBuildCount === 0) {
      console.log(`   ⏭️  No builds on day ${protocolDay}`);
      continue;
    }
    
    // Get block range for this day (rough estimate)
    const startBlock = 22890272 + (protocolDay - 1) * 7200; // ~7200 blocks per day
    const endBlock = startBlock + 10000; // Wide range
    
    console.log(`   📡 Scanning blocks ${startBlock} to ${endBlock}...`);
    
    try {
      // Get BuyAndBuild events for this day
      const events = await retryRPC(() => 
        contract.queryFilter(contract.filters.BuyAndBuild(), startBlock, endBlock)
      );
      
      console.log(`   📥 Found ${events.length} BuyAndBuild events`);
      
      let totalETH = 0;
      let ethTransactions = 0;
      
      // Check each event using the WORKING method
      for (const event of events) {
        try {
          const tx = await retryRPC(() => provider.getTransaction(event.transactionHash));
          const functionSelector = tx.data.slice(0, 10);
          
          // Use exact same logic as working system
          if (functionSelector === '0x53ad9b96') {
            // ETH build - check transaction value
            if (tx.value && !tx.value.isZero()) {
              const ethAmount = parseFloat(ethers.utils.formatEther(tx.value));
              totalETH += ethAmount;
              ethTransactions++;
              console.log(`   ✅ ETH build: ${ethAmount} ETH (${event.transactionHash.substring(0, 10)}...)`);
            }
          }
        } catch (e) {
          console.log(`   ⚠️  Error checking tx ${event.transactionHash}: ${e.message}`);
        }
      }
      
      console.log(`   📊 Day ${protocolDay}: ${ethTransactions} ETH builds, Total: ${totalETH} ETH`);
      
      if (ethTransactions > 0) {
        const oldValue = dayData.ethUsedForBuilds;
        dayData.ethUsedForBuilds = totalETH;
        dayData.ethUsed = (dayData.ethUsedForBurns || 0) + totalETH;
        console.log(`   ✅ Updated: ${oldValue} → ${totalETH} ETH`);
      } else {
        console.log(`   ℹ️  No ETH builds found for day ${protocolDay}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error processing day ${protocolDay}: ${error.message}`);
    }
  }
  
  // Recalculate totals
  let totalETHBuilds = 0;
  data.dailyData.forEach(day => {
    totalETHBuilds += day.ethUsedForBuilds || 0;
  });
  
  data.totals.ethUsedForBuilds = totalETHBuilds.toFixed(18);
  
  // Save updated data
  fs.writeFileSync('public/data/buy-process-data.json', JSON.stringify(data, null, 2));
  
  console.log('\n✅ Duplicate ETH values fixed!');
  console.log(`💰 New total ETH used for builds: ${totalETHBuilds} ETH`);
  
  // Validate
  console.log('\n🔍 Checking for remaining duplicates...');
  const newEthValues = {};
  data.dailyData.forEach(day => {
    if (day.buyAndBuildCount > 0 && day.ethUsedForBuilds > 0) {
      const eth = day.ethUsedForBuilds.toString();
      if (!newEthValues[eth]) newEthValues[eth] = [];
      newEthValues[eth].push(day.protocolDay);
    }
  });
  
  let foundDuplicates = false;
  Object.entries(newEthValues).forEach(([ethValue, days]) => {
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