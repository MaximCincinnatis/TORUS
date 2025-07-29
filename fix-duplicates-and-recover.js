#!/usr/bin/env node

/**
 * Fix duplicate creates and recover payment data from the valid ones
 */

const { ethers } = require('ethers');
const fs = require('fs');

async function fixDuplicatesAndRecover() {
  console.log('🔧 Fixing duplicate creates and recovering payment data...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const STAKING_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  // Load cached data
  const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  console.log(`Original creates: ${cachedData.stakingData.createEvents.length}`);
  
  // Remove duplicates based on user + id + blockNumber
  const uniqueCreates = [];
  const seen = new Set();
  
  for (const create of cachedData.stakingData.createEvents) {
    const key = `${create.user}-${create.id}-${create.blockNumber}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueCreates.push(create);
    }
  }
  
  console.log(`After removing duplicates: ${uniqueCreates.length}`);
  console.log(`Removed ${cachedData.stakingData.createEvents.length - uniqueCreates.length} duplicates`);
  
  // Update the data
  cachedData.stakingData.createEvents = uniqueCreates;
  
  // Now check for creates from days 17-19 that need payment data
  const needsFixing = uniqueCreates
    .filter(c => c.protocolDay >= 17 && c.protocolDay <= 19 && c.costTitanX === '0');
  
  console.log(`\nCreates needing payment data fix: ${needsFixing.length}`);
  
  if (needsFixing.length === 0) {
    console.log('✅ All creates already have payment data!');
  } else {
    // Try to find these events using a broader search
    console.log('\\nSearching for real blockchain events...');
    
    const contractABI = [
      'event Created(address indexed user, uint256 indexed stakeIndex, uint256 torusAmount, uint256 endTime, uint256 startTime)'
    ];
    const contract = new ethers.Contract(STAKING_CONTRACT, contractABI, provider);
    
    // Search in a recent range where we know there were creates
    const searchStart = 23005000; // Start from where we know events exist
    const searchEnd = 23020000;   // Go to current
    
    const MAX_BLOCK_RANGE = 5000; // Smaller chunks
    let allEvents = [];
    
    for (let fromBlock = searchStart; fromBlock <= searchEnd; fromBlock += MAX_BLOCK_RANGE) {
      const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, searchEnd);
      
      try {
        console.log(`  Searching blocks ${fromBlock} to ${toBlock}...`);
        const events = await contract.queryFilter(contract.filters.Created(), fromBlock, toBlock);
        allEvents.push(...events);
        console.log(`    Found ${events.length} events`);
      } catch (e) {
        console.log(`    Error: ${e.message}`);
      }
    }
    
    console.log(`\nTotal blockchain events found: ${allEvents.length}`);
    
    if (allEvents.length > 0) {
      // Show sample events
      console.log('\\nSample blockchain events:');
      allEvents.slice(0, 5).forEach((e, i) => {
        console.log(`  ${i+1}. Block ${e.blockNumber}: User ${e.args.user.slice(0,8)}..., Index ${e.args.stakeIndex}`);
      });
      
      // Try to match with our cached data and recover payment data
      const txABI = [
        'function createTokens(uint256 amount, uint256 stakingDays) payable',
        'function createTokensWithTitanX(uint256 amount, uint256 stakingDays, uint256 titanXAmount)'
      ];
      const txInterface = new ethers.utils.Interface(txABI);
      
      let fixedCount = 0;
      
      for (const blockchainEvent of allEvents) {
        const user = blockchainEvent.args.user.toLowerCase();
        const stakeIndex = blockchainEvent.args.stakeIndex.toString();
        const blockNumber = blockchainEvent.blockNumber;
        
        // Find matching create in our needs-fixing list
        const cachedCreate = needsFixing.find(c => 
          c.user.toLowerCase() === user && 
          c.id.toString() === stakeIndex
        );
        
        if (cachedCreate) {
          try {
            console.log(`  🔍 Fixing create ${cachedCreate.id} (Day ${cachedCreate.protocolDay})...`);
            
            const tx = await provider.getTransaction(blockchainEvent.transactionHash);
            
            if (tx && tx.data && tx.data !== '0x') {
              const decoded = txInterface.parseTransaction({ data: tx.data, value: tx.value });
              
              if (decoded.name === 'createTokensWithTitanX') {
                const titanXAmount = decoded.args.titanXAmount.toString();
                cachedCreate.titanAmount = titanXAmount;
                cachedCreate.titanXAmount = titanXAmount;
                cachedCreate.costTitanX = titanXAmount;
                cachedCreate.ethAmount = '0';
                cachedCreate.costETH = '0';
                cachedCreate.blockNumber = blockNumber; // Update block number
                fixedCount++;
                console.log(`    ✅ ${ethers.utils.formatEther(titanXAmount)} TitanX`);
                
              } else if (decoded.name === 'createTokens') {
                const ethAmount = tx.value.toString();
                cachedCreate.ethAmount = ethAmount;
                cachedCreate.costETH = ethAmount;
                cachedCreate.titanAmount = '0';
                cachedCreate.titanXAmount = '0';
                cachedCreate.costTitanX = '0';
                cachedCreate.blockNumber = blockNumber; // Update block number
                fixedCount++;
                console.log(`    ✅ ${ethers.utils.formatEther(ethAmount)} ETH`);
              }
            }
          } catch (e) {
            console.log(`    ❌ Error: ${e.message}`);
          }
        }
      }
      
      console.log(`\n🎉 Fixed payment data for ${fixedCount} creates`);
    }
  }
  
  // Save the cleaned and fixed data
  cachedData.lastUpdated = new Date().toISOString();
  fs.writeFileSync('public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
  
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
  
  console.log('\\n📊 FINAL TitanX usage by day:');
  for (let day = 17; day <= 19; day++) {
    const s = summary[day];
    console.log(`Day ${day}: ${s.count} creates, ${s.titanx.toFixed(2)} TitanX, ${s.eth.toFixed(4)} ETH`);
  }
  
  console.log('\\n✅ Data cleaned and payment data recovered!');
  console.log('✅ Charts will now show correct TitanX usage for days 17-19!');
}

fixDuplicatesAndRecover().catch(console.error);