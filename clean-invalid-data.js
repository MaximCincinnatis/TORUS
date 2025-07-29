#!/usr/bin/env node

/**
 * Remove invalid creates and re-fetch real events from blockchain
 */

const { ethers } = require('ethers');
const fs = require('fs');

async function cleanInvalidData() {
  console.log('🧹 Cleaning invalid creates and re-fetching real events...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const STAKING_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  // Load cached data
  const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  console.log(`Original creates: ${cachedData.stakingData.createEvents.length}`);
  
  // Remove all creates from days 17-19 (they're invalid)
  const validCreates = cachedData.stakingData.createEvents
    .filter(c => c.protocolDay < 17);
  
  console.log(`After removing days 17-19: ${validCreates.length}`);
  console.log(`Removed ${cachedData.stakingData.createEvents.length - validCreates.length} invalid creates`);
  
  // Find the last valid create to know where to start fetching real events
  const lastValidBlock = Math.max(...validCreates.map(c => c.blockNumber));
  console.log(`Last valid create was at block: ${lastValidBlock}`);
  
  // Now fetch REAL events from after the last valid create
  console.log('\\n🔍 Fetching real Created events from blockchain...');
  
  const contractABI = [
    'event Created(address indexed user, uint256 indexed stakeIndex, uint256 torusAmount, uint256 endTime, uint256 startTime)'
  ];
  const contract = new ethers.Contract(STAKING_CONTRACT, contractABI, provider);
  
  const currentBlock = await provider.getBlockNumber();
  const searchStart = lastValidBlock + 1;
  
  console.log(`Searching blocks ${searchStart} to ${currentBlock}...`);
  
  const MAX_BLOCK_RANGE = 5000;
  let allRealEvents = [];
  
  for (let fromBlock = searchStart; fromBlock <= currentBlock; fromBlock += MAX_BLOCK_RANGE) {
    const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, currentBlock);
    
    try {
      console.log(`  Searching ${fromBlock} to ${toBlock}...`);
      const events = await contract.queryFilter(contract.filters.Created(), fromBlock, toBlock);
      allRealEvents.push(...events);
      console.log(`    Found ${events.length} real events`);
    } catch (e) {
      console.log(`    Error: ${e.message}`);
    }
  }
  
  console.log(`\\n✅ Found ${allRealEvents.length} REAL Created events`);
  
  if (allRealEvents.length > 0) {
    console.log('\\n📋 Processing real events and adding payment data...');
    
    // Transaction decoder
    const txABI = [
      'function createTokens(uint256 amount, uint256 stakingDays) payable',
      'function createTokensWithTitanX(uint256 amount, uint256 stakingDays, uint256 titanXAmount)'
    ];
    const txInterface = new ethers.utils.Interface(txABI);
    
    // Contract start date for protocol day calculation
    const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
    
    // Process each real event
    for (const event of allRealEvents) {
      try {
        // Get block timestamp
        const block = await provider.getBlock(event.blockNumber);
        const eventDate = new Date(block.timestamp * 1000);
        const msPerDay = 24 * 60 * 60 * 1000;
        const protocolDay = Math.max(1, Math.floor((eventDate.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1);
        
        // Get transaction for payment data
        const tx = await provider.getTransaction(event.transactionHash);
        
        let titanAmount = '0', ethAmount = '0', costTitanX = '0', costETH = '0';
        
        if (tx && tx.data && tx.data !== '0x') {
          try {
            const decoded = txInterface.parseTransaction({ data: tx.data, value: tx.value });
            
            if (decoded.name === 'createTokensWithTitanX') {
              titanAmount = decoded.args.titanXAmount.toString();
              costTitanX = titanAmount;
            } else if (decoded.name === 'createTokens') {
              ethAmount = tx.value.toString();
              costETH = ethAmount;
            }
          } catch (e) {
            console.log(`    ⚠️ Could not decode tx for create ${event.args.stakeIndex}: ${e.message}`);
          }
        }
        
        // Create the properly formatted create object
        const create = {
          user: event.args.user.toLowerCase(),
          owner: event.args.user.toLowerCase(),
          createId: event.args.stakeIndex.toString(),
          torusAmount: event.args.torusAmount.toString(),
          principal: event.args.torusAmount.toString(),
          timestamp: block.timestamp,
          endTime: event.args.endTime,
          blockNumber: event.blockNumber,
          id: event.args.stakeIndex.toString(),
          createDays: Math.floor((Number(event.args.endTime) - block.timestamp) / 86400),
          stakingDays: Math.floor((Number(event.args.endTime) - block.timestamp) / 86400),
          maturityDate: new Date(Number(event.args.endTime) * 1000).toISOString(),
          startDate: new Date(block.timestamp * 1000).toISOString(),
          protocolDay: protocolDay,
          titanAmount: titanAmount,
          titanXAmount: titanAmount,
          ethAmount: ethAmount,
          shares: '0',
          power: '0',
          claimedCreate: false,
          claimedStake: false,
          costETH: costETH,
          costTitanX: costTitanX,
          rawCostETH: costETH,
          rawCostTitanX: costTitanX
        };
        
        validCreates.push(create);
        
        if (protocolDay >= 17) {
          const paymentInfo = costTitanX !== '0' ? 
            `${ethers.utils.formatEther(costTitanX)} TitanX` : 
            `${ethers.utils.formatEther(costETH)} ETH`;
          console.log(`  ✅ Added Day ${protocolDay} create: ${paymentInfo}`);
        }
        
      } catch (e) {
        console.log(`    ❌ Error processing event: ${e.message}`);
      }
    }
    
    // Update the cached data with real, valid creates
    cachedData.stakingData.createEvents = validCreates.sort((a, b) => a.blockNumber - b.blockNumber);
    
    // Update metadata
    cachedData.stakingData.lastBlock = currentBlock;
    cachedData.stakingData.metadata = cachedData.stakingData.metadata || {};
    cachedData.stakingData.metadata.currentBlock = currentBlock;
    cachedData.lastUpdated = new Date().toISOString();
    
    // Save the cleaned data
    fs.writeFileSync('public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
    
    console.log(`\n🎉 Data cleaned and updated with ${allRealEvents.length} real events!`);
    
    // Show final summary
    const summary = { 17: { titanx: 0, eth: 0, count: 0 }, 18: { titanx: 0, eth: 0, count: 0 }, 19: { titanx: 0, eth: 0, count: 0 } };
    
    cachedData.stakingData.createEvents
      .filter(c => c.protocolDay >= 17 && c.protocolDay <= 19)
      .forEach(c => {
        const day = c.protocolDay;
        summary[day].count++;
        
        const titanx = parseFloat(c.titanAmount || '0');
        const eth = parseFloat(c.ethAmount || '0');
        
        if (titanx > 0) {
          summary[day].titanx += parseFloat(ethers.utils.formatEther(c.titanAmount));
        }
        if (eth > 0) {
          summary[day].eth += parseFloat(ethers.utils.formatEther(c.ethAmount));
        }
      });
    
    console.log('\n📊 REAL TitanX usage by day:');
    for (let day = 17; day <= 19; day++) {
      const s = summary[day];
      console.log(`Day ${day}: ${s.count} creates, ${s.titanx.toFixed(2)} TitanX, ${s.eth.toFixed(4)} ETH`);
    }
    
    console.log('\n✅ The dashboard will now show ACCURATE data for days 17-19!');
    
  } else {
    console.log('\n📝 No new events found - removing invalid data only');
    
    // Just save the cleaned data without invalid creates
    cachedData.stakingData.createEvents = validCreates;
    cachedData.lastUpdated = new Date().toISOString();
    fs.writeFileSync('public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
  }
}

cleanInvalidData().catch(console.error);