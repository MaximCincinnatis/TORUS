#!/usr/bin/env node

/**
 * Fix Day 16 to be 100% accurate - NO tolerance for inaccuracy
 */

const { ethers } = require('ethers');
const fs = require('fs');

async function fixDay16Exact() {
  console.log('🔧 Fixing Day 16 to be 100% accurate...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  const CONTRACTS = {
    TORUS_CREATE_STAKE: '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507',
    TITANX: '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1'
  };
  
  console.log('=== DAY 16 EXACT FIX ===');
  
  const day16Creates = cachedData.stakingData.createEvents.filter(c => c.protocolDay === 16);
  const day16Stakes = cachedData.stakingData.stakeEvents.filter(s => s.protocolDay === 16);
  
  console.log(`Day 16: ${day16Creates.length} creates, ${day16Stakes.length} stakes`);
  
  const minBlock = Math.min(...[...day16Creates, ...day16Stakes].map(i => i.blockNumber));
  const maxBlock = Math.max(...[...day16Creates, ...day16Stakes].map(i => i.blockNumber));
  
  console.log(`Block range: ${minBlock} - ${maxBlock}`);
  
  // Get ALL TitanX transfers in Day 16 blocks
  const titanxABI = ['event Transfer(address indexed from, address indexed to, uint256 value)'];
  const titanxContract = new ethers.Contract(CONTRACTS.TITANX, titanxABI, provider);
  
  console.log('Getting ALL TitanX transfers in Day 16 blocks...');
  
  const filter = titanxContract.filters.Transfer(null, CONTRACTS.TORUS_CREATE_STAKE);
  let allTransfers = [];
  
  const MAX_RANGE = 2000;
  for (let fromBlock = minBlock; fromBlock <= maxBlock; fromBlock += MAX_RANGE) {
    const toBlock = Math.min(fromBlock + MAX_RANGE - 1, maxBlock);
    
    try {
      const transfers = await titanxContract.queryFilter(filter, fromBlock, toBlock);
      allTransfers.push(...transfers);
      console.log(`  Blocks ${fromBlock}-${toBlock}: ${transfers.length} transfers`);
    } catch (e) {
      console.log(`  ✗ Error ${fromBlock}-${toBlock}: ${e.message}`);
    }
  }
  
  // Calculate the EXACT real total
  let realTotal = ethers.BigNumber.from(0);
  allTransfers.forEach(t => {
    realTotal = realTotal.add(t.args.value);
  });
  
  const realTotalFormatted = parseFloat(ethers.utils.formatEther(realTotal));
  console.log(`\nReal blockchain Day 16 total: ${realTotalFormatted.toLocaleString()} TitanX`);
  
  // Show our current total
  const currentCreatesTotal = day16Creates.reduce((sum, c) => {
    return sum + parseFloat(ethers.utils.formatEther(c.titanAmount || '0'));
  }, 0);
  const currentStakesTotal = day16Stakes.reduce((sum, s) => {
    return sum + parseFloat(ethers.utils.formatEther(s.rawCostTitanX || '0'));
  }, 0);
  const currentTotal = currentCreatesTotal + currentStakesTotal;
  
  console.log(`Our current total: ${currentTotal.toLocaleString()} TitanX`);
  console.log(`Difference: ${(currentTotal - realTotalFormatted).toLocaleString()} TitanX`);
  
  if (Math.abs(currentTotal - realTotalFormatted) < 1) {
    console.log('✅ Day 16 is already 100% accurate!');
    return;
  }
  
  console.log('❌ Day 16 is NOT accurate. Fixing...\n');
  
  // The issue might be that some Day 16 cached items are getting TitanX that belongs to other days
  // Let's match each cached item to its EXACT blockchain transfer
  
  const contractABI = [
    'event Staked(address indexed user, uint256 stakeIndex, uint256 principal, uint256 stakingDays, uint256 shares)',
    'event Created(address indexed user, uint256 stakeIndex, uint256 torusAmount, uint256 endTime)'
  ];
  const contract = new ethers.Contract(CONTRACTS.TORUS_CREATE_STAKE, contractABI, provider);
  
  // Get blockchain events for Day 16
  let day16BlockchainEvents = [];
  
  for (let fromBlock = minBlock; fromBlock <= maxBlock; fromBlock += MAX_RANGE) {
    const toBlock = Math.min(fromBlock + MAX_RANGE - 1, maxBlock);
    
    try {
      const [stakeEvents, createEvents] = await Promise.all([
        contract.queryFilter(contract.filters.Staked(), fromBlock, toBlock),
        contract.queryFilter(contract.filters.Created(), fromBlock, toBlock)
      ]);
      
      stakeEvents.forEach(e => { e.eventType = 'stake'; });
      createEvents.forEach(e => { e.eventType = 'create'; });
      
      day16BlockchainEvents.push(...stakeEvents, ...createEvents);
    } catch (e) {
      console.log(`Error fetching events ${fromBlock}-${toBlock}: ${e.message}`);
    }
  }
  
  console.log(`Found ${day16BlockchainEvents.length} blockchain events for Day 16`);
  
  // Now match each Day 16 cached item to ONLY the transfers that belong to it
  let exactTotal = 0;
  let fixedCount = 0;
  
  const day16Items = [...day16Creates, ...day16Stakes];
  
  console.log('Matching each Day 16 item to its exact TitanX transfer...');
  
  for (const cachedItem of day16Items) {
    // Find the blockchain event for this cached item
    const matchingEvent = day16BlockchainEvents.find(e => 
      e.args.user.toLowerCase() === cachedItem.user.toLowerCase() &&
      e.args.stakeIndex.toString() === cachedItem.id.toString() &&
      e.blockNumber === cachedItem.blockNumber
    );
    
    if (!matchingEvent) {
      console.log(`⚠️ No blockchain event found for ${cachedItem.id}`);
      continue;
    }
    
    // Find the EXACT TitanX transfer for this transaction
    let exactTransfer = null;
    
    // Strategy 1: Exact transaction hash
    exactTransfer = allTransfers.find(t => t.transactionHash === matchingEvent.transactionHash);
    
    // Strategy 2: Same block + same user
    if (!exactTransfer) {
      exactTransfer = allTransfers.find(t => 
        t.blockNumber === matchingEvent.blockNumber &&
        t.args.from.toLowerCase() === cachedItem.user.toLowerCase()
      );
    }
    
    const isCreate = day16Creates.includes(cachedItem);
    const type = isCreate ? 'create' : 'stake';
    
    if (exactTransfer) {
      const exactAmount = parseFloat(ethers.utils.formatEther(exactTransfer.args.value));
      exactTotal += exactAmount;
      
      // Get current amount
      const currentAmount = isCreate ? 
        parseFloat(ethers.utils.formatEther(cachedItem.titanAmount || '0')) :
        parseFloat(ethers.utils.formatEther(cachedItem.rawCostTitanX || '0'));
      
      if (Math.abs(exactAmount - currentAmount) > 1) {
        console.log(`  🔄 ${type} ${cachedItem.id}: ${currentAmount.toLocaleString()} → ${exactAmount.toLocaleString()} TitanX`);
        
        // Update with EXACT amount
        cachedItem.costTitanX = exactTransfer.args.value.toString();
        cachedItem.rawCostTitanX = exactTransfer.args.value.toString();
        cachedItem.costETH = '0';
        cachedItem.rawCostETH = '0';
        
        if (isCreate) {
          cachedItem.titanAmount = exactTransfer.args.value.toString();
          cachedItem.titanXAmount = exactTransfer.args.value.toString();
          cachedItem.ethAmount = '0';
        }
        
        fixedCount++;
      } else {
        console.log(`  ✅ ${type} ${cachedItem.id}: ${exactAmount.toLocaleString()} TitanX (already correct)`);
      }
    } else {
      // Check if it's an ETH payment
      try {
        const tx = await provider.getTransaction(matchingEvent.transactionHash);
        if (tx && tx.value && ethers.BigNumber.from(tx.value).gt(0)) {
          const ethAmount = parseFloat(ethers.utils.formatEther(tx.value));
          console.log(`  ✅ ${type} ${cachedItem.id}: ${ethAmount.toFixed(6)} ETH payment`);
          
          // Ensure ETH fields are correct
          cachedItem.costETH = tx.value.toString();
          cachedItem.rawCostETH = tx.value.toString();
          cachedItem.costTitanX = '0';
          cachedItem.rawCostTitanX = '0';
          
          if (isCreate) {
            cachedItem.ethAmount = tx.value.toString();
            cachedItem.titanAmount = '0';
            cachedItem.titanXAmount = '0';
          }
        } else {
          console.log(`  ❌ ${type} ${cachedItem.id}: No payment found!`);
        }
      } catch (e) {
        console.log(`  ❌ ${type} ${cachedItem.id}: Error checking payment: ${e.message}`);
      }
    }
  }
  
  console.log(`\nFixed ${fixedCount} items`);
  console.log(`Exact matched total: ${exactTotal.toLocaleString()} TitanX`);
  console.log(`Should match real total: ${realTotalFormatted.toLocaleString()} TitanX`);
  
  if (Math.abs(exactTotal - realTotalFormatted) < 1) {
    console.log('✅ Now 100% accurate!');
  } else {
    console.log(`❌ Still ${Math.abs(exactTotal - realTotalFormatted).toLocaleString()} TitanX off`);
  }
  
  // Save the corrected data
  cachedData.lastUpdated = new Date().toISOString();
  fs.writeFileSync('public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
  
  console.log('✅ Data saved with exact Day 16 amounts');
}

fixDay16Exact().catch(console.error);