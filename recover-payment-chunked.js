#!/usr/bin/env node

/**
 * Recover payment data using chunked queries (exactly like smart-update-fixed.js)
 */

const { ethers } = require('ethers');
const fs = require('fs');

async function recoverPaymentChunked() {
  console.log('🔍 Recovering payment data using chunked queries...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const STAKING_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  // Use the EXACT same setup as smart-update-fixed.js
  const contractABI = [
    'event Created(address indexed user, uint256 indexed stakeIndex, uint256 torusAmount, uint256 endTime, uint256 startTime)'
  ];
  
  const contract = new ethers.Contract(STAKING_CONTRACT, contractABI, provider);
  
  // Load cached data
  const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  // Get creates from days 17-19 that need payment data
  const needsFixing = cachedData.stakingData.createEvents
    .filter(c => c.protocolDay >= 17 && c.protocolDay <= 19 && c.costTitanX === '0');
  
  console.log(`Found ${needsFixing.length} creates needing payment data fix`);
  
  if (needsFixing.length === 0) {
    console.log('✅ All creates already have payment data!');
    return;
  }
  
  // Get the block range
  const minBlock = Math.min(...needsFixing.map(c => c.blockNumber));
  const maxBlock = Math.max(...needsFixing.map(c => c.blockNumber));
  
  console.log(`Block range: ${minBlock} to ${maxBlock} (${maxBlock - minBlock + 1} blocks)`);
  
  // Use the same chunking as smart-update-fixed.js
  const MAX_BLOCK_RANGE = 9999;
  let allCreateEvents = [];
  
  console.log('\\nFetching Created events in chunks...');
  
  for (let fromBlock = minBlock; fromBlock <= maxBlock; fromBlock += MAX_BLOCK_RANGE) {
    const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, maxBlock);
    
    try {
      console.log(`  Fetching events from block ${fromBlock} to ${toBlock}...`);
      
      const createEvents = await contract.queryFilter(contract.filters.Created(), fromBlock, toBlock);
      allCreateEvents.push(...createEvents);
      
      console.log(`  ✓ Found ${createEvents.length} events in this chunk`);
      
    } catch (e) {
      console.log(`  ❌ Error fetching chunk ${fromBlock}-${toBlock}: ${e.message}`);
    }
  }
  
  console.log(`\n✅ Total Created events found: ${allCreateEvents.length}`);
  
  if (allCreateEvents.length === 0) {
    console.log('❌ No blockchain events found in this range!');
    return;
  }
  
  // Transaction decoder
  const txABI = [
    'function createTokens(uint256 amount, uint256 stakingDays) payable',
    'function createTokensWithTitanX(uint256 amount, uint256 stakingDays, uint256 titanXAmount)'
  ];
  const txInterface = new ethers.utils.Interface(txABI);
  
  let fixedCount = 0;
  
  console.log('\\nMatching events and recovering payment data...');
  
  // Match blockchain events with cached data
  for (const blockchainEvent of allCreateEvents) {
    const user = blockchainEvent.args.user.toLowerCase();
    const stakeIndex = blockchainEvent.args.stakeIndex.toString();
    const blockNumber = blockchainEvent.blockNumber;
    
    // Find matching create in cached data
    const cachedCreate = needsFixing.find(c => 
      c.user.toLowerCase() === user && 
      c.id.toString() === stakeIndex &&
      c.blockNumber === blockNumber
    );
    
    if (cachedCreate) {
      try {
        console.log(`  🔍 Processing create ${cachedCreate.id} (Day ${cachedCreate.protocolDay})...`);
        
        // Get the transaction and decode payment data
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
            fixedCount++;
            console.log(`    ✅ Fixed with ${ethers.utils.formatEther(titanXAmount)} TitanX`);
            
          } else if (decoded.name === 'createTokens') {
            const ethAmount = tx.value.toString();
            cachedCreate.ethAmount = ethAmount;
            cachedCreate.costETH = ethAmount;
            cachedCreate.titanAmount = '0';
            cachedCreate.titanXAmount = '0';
            cachedCreate.costTitanX = '0';
            fixedCount++;
            console.log(`    ✅ Fixed with ${ethers.utils.formatEther(ethAmount)} ETH`);
          }
        }
      } catch (e) {
        console.log(`    ❌ Error processing: ${e.message}`);
      }
    }
  }
  
  // Save the fixed data
  if (fixedCount > 0) {
    cachedData.lastUpdated = new Date().toISOString();
    fs.writeFileSync('public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
    console.log(`\n🎉 Successfully recovered payment data for ${fixedCount} creates!`);
    
    // Show summary by day
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
    
    console.log('\\n📊 TitanX usage by day (RECOVERED):');
    for (let day = 17; day <= 19; day++) {
      const s = summary[day];
      console.log(`Day ${day}: ${s.count} creates, ${s.titanx.toFixed(2)} TitanX, ${s.eth.toFixed(4)} ETH`);
    }
    
    console.log('\\n✅ The "TitanX Used Each Day" chart will now show correct data for days 17-19!');
    
  } else {
    console.log('\\n⚠️  No payment data was recovered');
  }
}

recoverPaymentChunked().catch(console.error);