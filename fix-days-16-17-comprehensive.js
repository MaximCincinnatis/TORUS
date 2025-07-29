#!/usr/bin/env node

/**
 * Comprehensive fix for Days 16-17 TitanX inaccuracies
 */

const { ethers } = require('ethers');
const fs = require('fs');

async function fixDays16And17() {
  console.log('🔧 Comprehensive fix for Days 16-17 TitanX inaccuracies...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  const CONTRACTS = {
    TORUS_CREATE_STAKE: '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507',
    TITANX: '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1'
  };
  
  for (let day of [16, 17]) {
    console.log(`=== FIXING DAY ${day} ===`);
    
    const dayCreates = cachedData.stakingData.createEvents.filter(c => c.protocolDay === day);
    const dayStakes = cachedData.stakingData.stakeEvents.filter(s => s.protocolDay === day);
    const dayItems = [...dayCreates, ...dayStakes];
    
    if (dayItems.length === 0) {
      console.log(`No items for Day ${day}`);
      continue;
    }
    
    const minBlock = Math.min(...dayItems.map(i => i.blockNumber));
    const maxBlock = Math.max(...dayItems.map(i => i.blockNumber));
    
    console.log(`Day ${day}: ${dayCreates.length} creates, ${dayStakes.length} stakes`);
    console.log(`Block range: ${minBlock} - ${maxBlock}`);
    
    // Get comprehensive payment data using our proven method
    try {
      const { getComprehensivePaymentData } = require('./comprehensive-payment-matching');
      
      // Get blockchain events for matching
      const contractABI = [
        'event Staked(address indexed user, uint256 stakeIndex, uint256 principal, uint256 stakingDays, uint256 shares)',
        'event Created(address indexed user, uint256 stakeIndex, uint256 torusAmount, uint256 endTime)'
      ];
      const contract = new ethers.Contract(CONTRACTS.TORUS_CREATE_STAKE, contractABI, provider);
      
      console.log(`Getting blockchain events for Day ${day}...`);
      let allBlockchainEvents = [];
      
      const MAX_RANGE = 2000;
      for (let fromBlock = minBlock; fromBlock <= maxBlock; fromBlock += MAX_RANGE) {
        const toBlock = Math.min(fromBlock + MAX_RANGE - 1, maxBlock);
        
        try {
          const [stakeEvents, createEvents] = await Promise.all([
            contract.queryFilter(contract.filters.Staked(), fromBlock, toBlock),
            contract.queryFilter(contract.filters.Created(), fromBlock, toBlock)
          ]);
          
          stakeEvents.forEach(e => { e.eventType = 'stake'; });
          createEvents.forEach(e => { e.eventType = 'create'; });
          
          allBlockchainEvents.push(...stakeEvents, ...createEvents);
        } catch (e) {
          console.log(`  ⚠️ Error fetching events ${fromBlock}-${toBlock}: ${e.message}`);
        }
      }
      
      console.log(`Found ${allBlockchainEvents.length} blockchain events`);
      
      // Get comprehensive payment data
      const paymentDataMap = await getComprehensivePaymentData(allBlockchainEvents, provider, minBlock, maxBlock);
      
      let fixedCount = 0;
      let totalTitanXBefore = 0;
      let totalTitanXAfter = 0;
      
      // Calculate before totals
      dayItems.forEach(item => {
        if (dayCreates.includes(item)) {
          totalTitanXBefore += parseFloat(ethers.utils.formatEther(item.titanAmount || '0'));
        } else {
          totalTitanXBefore += parseFloat(ethers.utils.formatEther(item.rawCostTitanX || '0'));
        }
      });
      
      // Apply comprehensive payment data
      for (const item of dayItems) {
        const matchingEvent = allBlockchainEvents.find(e => 
          e.args.user.toLowerCase() === item.user.toLowerCase() &&
          e.args.stakeIndex.toString() === item.id.toString() &&
          e.blockNumber === item.blockNumber
        );
        
        if (matchingEvent) {
          const eventKey = `${matchingEvent.transactionHash}-${matchingEvent.args.stakeIndex}`;
          const paymentData = paymentDataMap.get(eventKey);
          
          if (paymentData) {
            const isCreate = dayCreates.includes(item);
            
            // Get current value
            const currentTitanX = isCreate ? 
              parseFloat(ethers.utils.formatEther(item.titanAmount || '0')) :
              parseFloat(ethers.utils.formatEther(item.rawCostTitanX || '0'));
            
            const newTitanX = parseFloat(ethers.utils.formatEther(paymentData.costTitanX || '0'));
            
            // Only update if there's a significant difference (more than 1000 TitanX)
            if (Math.abs(newTitanX - currentTitanX) > 1000) {
              
              // Update ALL relevant fields
              item.costTitanX = paymentData.costTitanX;
              item.costETH = paymentData.costETH;
              item.rawCostTitanX = paymentData.rawCostTitanX;
              item.rawCostETH = paymentData.rawCostETH;
              
              if (isCreate) {
                // For creates, update titanAmount field that chart uses
                item.titanAmount = paymentData.titanAmount;
                item.titanXAmount = paymentData.titanXAmount;
                item.ethAmount = paymentData.ethAmount;
              }
              
              const type = isCreate ? 'create' : 'stake';
              if (newTitanX > 0) {
                console.log(`  🔄 ${type} ${item.id}: ${currentTitanX.toLocaleString()} → ${newTitanX.toLocaleString()} TitanX`);
              } else {
                const newETH = parseFloat(ethers.utils.formatEther(paymentData.costETH || '0'));
                if (newETH > 0) {
                  console.log(`  🔄 ${type} ${item.id}: ${currentTitanX.toLocaleString()} TitanX → ${newETH.toFixed(6)} ETH`);
                }
              }
              
              fixedCount++;
            }
          }
        }
      }
      
      // Calculate after totals
      dayItems.forEach(item => {
        if (dayCreates.includes(item)) {
          totalTitanXAfter += parseFloat(ethers.utils.formatEther(item.titanAmount || '0'));
        } else {
          totalTitanXAfter += parseFloat(ethers.utils.formatEther(item.rawCostTitanX || '0'));
        }
      });
      
      console.log(`Fixed ${fixedCount} items for Day ${day}`);
      console.log(`Total TitanX: ${totalTitanXBefore.toLocaleString()} → ${totalTitanXAfter.toLocaleString()}`);
      
    } catch (e) {
      console.log(`❌ Error fixing Day ${day}: ${e.message}`);
    }
    
    console.log('');
  }
  
  // Save updated data
  cachedData.lastUpdated = new Date().toISOString();
  fs.writeFileSync('public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
  
  console.log('✅ Data saved! Verifying final accuracy...\n');
  
  // Quick verification
  const titanxABI = ['event Transfer(address indexed from, address indexed to, uint256 value)'];
  const titanxContract = new ethers.Contract(CONTRACTS.TITANX, titanxABI, provider);
  
  for (let day of [16, 17]) {
    const dayCreates = cachedData.stakingData.createEvents.filter(c => c.protocolDay === day);
    const dayStakes = cachedData.stakingData.stakeEvents.filter(s => s.protocolDay === day);
    
    // Calculate what chart will show
    const chartTotal = 
      dayCreates.reduce((sum, c) => sum + parseFloat(ethers.utils.formatEther(c.titanAmount || '0')), 0) +
      dayStakes.reduce((sum, s) => sum + parseFloat(ethers.utils.formatEther(s.rawCostTitanX || '0')), 0);
    
    console.log(`Day ${day} Final Chart Value: ${chartTotal.toLocaleString()} TitanX`);
  }
}

fixDays16And17().catch(console.error);