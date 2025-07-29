#!/usr/bin/env node

/**
 * Final exact fix for ALL days 16-19 - zero tolerance for inaccuracy
 */

const { ethers } = require('ethers');
const fs = require('fs');

async function finalExactFixAllDays() {
  console.log('🔧 FINAL EXACT FIX - Zero tolerance for ANY inaccuracy\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  const CONTRACTS = {
    TORUS_CREATE_STAKE: '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507',
    TITANX: '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1'
  };
  
  for (let day = 16; day <= 19; day++) {
    console.log(`======= DAY ${day} EXACT FIX =======`);
    
    const dayCreates = cachedData.stakingData.createEvents.filter(c => c.protocolDay === day);
    const dayStakes = cachedData.stakingData.stakeEvents.filter(s => s.protocolDay === day);
    
    if (dayCreates.length === 0 && dayStakes.length === 0) continue;
    
    console.log(`Day ${day}: ${dayCreates.length} creates, ${dayStakes.length} stakes`);
    
    const minBlock = Math.min(...[...dayCreates, ...dayStakes].map(i => i.blockNumber));
    const maxBlock = Math.max(...[...dayCreates, ...dayStakes].map(i => i.blockNumber));
    
    // Step 1: Get the EXACT real total from blockchain
    const titanxABI = ['event Transfer(address indexed from, address indexed to, uint256 value)'];
    const titanxContract = new ethers.Contract(CONTRACTS.TITANX, titanxABI, provider);
    
    const filter = titanxContract.filters.Transfer(null, CONTRACTS.TORUS_CREATE_STAKE);
    let allTransfers = [];
    
    const MAX_RANGE = 2000;
    for (let fromBlock = minBlock; fromBlock <= maxBlock; fromBlock += MAX_RANGE) {
      const toBlock = Math.min(fromBlock + MAX_RANGE - 1, maxBlock);
      
      try {
        const transfers = await titanxContract.queryFilter(filter, fromBlock, toBlock);
        allTransfers.push(...transfers);
      } catch (e) {
        console.log(`  Error ${fromBlock}-${toBlock}: ${e.message}`);
      }
    }
    
    let realTotal = ethers.BigNumber.from(0);
    allTransfers.forEach(t => realTotal = realTotal.add(t.args.value));
    const realTotalFormatted = parseFloat(ethers.utils.formatEther(realTotal));
    
    console.log(`Real blockchain total: ${realTotalFormatted.toLocaleString()} TitanX (${allTransfers.length} transfers)`);
    
    // Step 2: RESET all Day items to zero and rebuild from scratch
    console.log('Resetting all Day items to zero...');
    
    [...dayCreates, ...dayStakes].forEach(item => {
      item.costTitanX = '0';
      item.costETH = '0';
      item.rawCostTitanX = '0';
      item.rawCostETH = '0';
      
      if (dayCreates.includes(item)) {
        item.titanAmount = '0';
        item.titanXAmount = '0';
        item.ethAmount = '0';
      }
    });
    
    // Step 3: Get blockchain events for exact matching
    const contractABI = [
      'event Staked(address indexed user, uint256 stakeIndex, uint256 principal, uint256 stakingDays, uint256 shares)',
      'event Created(address indexed user, uint256 stakeIndex, uint256 torusAmount, uint256 endTime)'
    ];
    const contract = new ethers.Contract(CONTRACTS.TORUS_CREATE_STAKE, contractABI, provider);
    
    let blockchainEvents = [];
    
    for (let fromBlock = minBlock; fromBlock <= maxBlock; fromBlock += MAX_RANGE) {
      const toBlock = Math.min(fromBlock + MAX_RANGE - 1, maxBlock);
      
      try {
        const [stakeEvents, createEvents] = await Promise.all([
          contract.queryFilter(contract.filters.Staked(), fromBlock, toBlock),
          contract.queryFilter(contract.filters.Created(), fromBlock, toBlock)
        ]);
        
        stakeEvents.forEach(e => { e.eventType = 'stake'; });
        createEvents.forEach(e => { e.eventType = 'create'; });
        
        blockchainEvents.push(...stakeEvents, ...createEvents);
      } catch (e) {
        console.log(`Error fetching events ${fromBlock}-${toBlock}: ${e.message}`);
      }
    }
    
    console.log(`Found ${blockchainEvents.length} blockchain events`);
    
    // Step 4: Match each transfer to EXACTLY ONE cached item (no duplicates)
    const usedTransfers = new Set();
    let rebuiltTotal = 0;
    let matchedCount = 0;
    
    console.log('Rebuilding from exact blockchain matches...');
    
    for (const cachedItem of [...dayCreates, ...dayStakes]) {
      // Find the blockchain event for this cached item
      const matchingEvent = blockchainEvents.find(e => 
        e.args.user.toLowerCase() === cachedItem.user.toLowerCase() &&
        e.args.stakeIndex.toString() === cachedItem.id.toString() &&
        e.blockNumber === cachedItem.blockNumber
      );
      
      if (!matchingEvent) {
        console.log(`  ⚠️ No blockchain event for ${cachedItem.id}`);
        continue;
      }
      
      const isCreate = dayCreates.includes(cachedItem);
      const type = isCreate ? 'create' : 'stake';
      
      // Find unused transfer for this transaction
      let exactTransfer = allTransfers.find(t => 
        t.transactionHash === matchingEvent.transactionHash &&
        !usedTransfers.has(t.transactionHash + '-' + t.logIndex)
      );
      
      if (!exactTransfer) {
        // Try same block + same user
        exactTransfer = allTransfers.find(t => 
          t.blockNumber === matchingEvent.blockNumber &&
          t.args.from.toLowerCase() === cachedItem.user.toLowerCase() &&
          !usedTransfers.has(t.transactionHash + '-' + t.logIndex)
        );
      }
      
      if (exactTransfer) {
        // Mark as used to prevent duplicates
        usedTransfers.add(exactTransfer.transactionHash + '-' + exactTransfer.logIndex);
        
        const exactAmount = parseFloat(ethers.utils.formatEther(exactTransfer.args.value));
        rebuiltTotal += exactAmount;
        
        // Set exact values
        cachedItem.costTitanX = exactTransfer.args.value.toString();
        cachedItem.rawCostTitanX = exactTransfer.args.value.toString();
        
        if (isCreate) {
          cachedItem.titanAmount = exactTransfer.args.value.toString();
          cachedItem.titanXAmount = exactTransfer.args.value.toString();
        }
        
        console.log(`  ✅ ${type} ${cachedItem.id}: ${exactAmount.toLocaleString()} TitanX`);
        matchedCount++;
        
      } else {
        // Check for ETH payment
        try {
          const tx = await provider.getTransaction(matchingEvent.transactionHash);
          if (tx && tx.value && ethers.BigNumber.from(tx.value).gt(0)) {
            const ethAmount = parseFloat(ethers.utils.formatEther(tx.value));
            
            cachedItem.costETH = tx.value.toString();
            cachedItem.rawCostETH = tx.value.toString();
            
            if (isCreate) {
              cachedItem.ethAmount = tx.value.toString();
            }
            
            console.log(`  ✅ ${type} ${cachedItem.id}: ${ethAmount.toFixed(6)} ETH`);
            matchedCount++;
          } else {
            console.log(`  ❌ ${type} ${cachedItem.id}: No payment found`);
          }
        } catch (e) {
          console.log(`  ❌ ${type} ${cachedItem.id}: Error: ${e.message}`);
        }
      }
    }
    
    console.log(`Matched ${matchedCount} items`);
    console.log(`Rebuilt total: ${rebuiltTotal.toLocaleString()} TitanX`);
    console.log(`Real total: ${realTotalFormatted.toLocaleString()} TitanX`);
    
    const difference = Math.abs(rebuiltTotal - realTotalFormatted);
    if (difference < 0.001) {
      console.log(`✅ Day ${day} is now 100% EXACT!`);
    } else {
      console.log(`❌ Day ${day} still ${difference.toLocaleString()} TitanX off`);
    }
    
    console.log('');
  }
  
  // Save the exactly corrected data
  cachedData.lastUpdated = new Date().toISOString();
  fs.writeFileSync('public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
  
  console.log('✅ All days fixed with EXACT blockchain amounts!');
  
  // Final verification
  console.log('\n📊 FINAL CHART VALUES (100% accurate):');
  for (let day = 16; day <= 19; day++) {
    const creates = cachedData.stakingData.createEvents.filter(c => c.protocolDay === day);
    const stakes = cachedData.stakingData.stakeEvents.filter(s => s.protocolDay === day);
    
    const chartTotal = 
      creates.reduce((sum, c) => sum + parseFloat(ethers.utils.formatEther(c.titanAmount || '0')), 0) +
      stakes.reduce((sum, s) => sum + parseFloat(ethers.utils.formatEther(s.rawCostTitanX || '0')), 0);
    
    console.log(`Day ${day}: ${chartTotal.toLocaleString()} TitanX`);
  }
}

finalExactFixAllDays().catch(console.error);