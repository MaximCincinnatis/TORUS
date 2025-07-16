#!/usr/bin/env node

/**
 * Fix all timestamps and maturity dates by fetching actual block timestamps
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function fixAllTimestamps() {
  console.log('🔧 FIXING ALL TIMESTAMPS WITH ACTUAL BLOCK DATA...\n');
  
  // Connect to provider
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  
  // Load cached data
  const cachedDataPath = path.join(__dirname, 'public/data/cached-data.json');
  const cachedData = JSON.parse(fs.readFileSync(cachedDataPath, 'utf8'));
  
  console.log('📊 Current data:');
  console.log(`  - Stakes: ${cachedData.stakingData.stakeEvents.length}`);
  console.log(`  - Creates: ${cachedData.stakingData.createEvents.length}`);
  
  // Create a map of block numbers to timestamps
  const blockTimestamps = new Map();
  
  // Collect all unique block numbers
  const allBlockNumbers = new Set();
  
  cachedData.stakingData.stakeEvents.forEach(event => {
    allBlockNumbers.add(event.blockNumber);
  });
  
  cachedData.stakingData.createEvents.forEach(event => {
    allBlockNumbers.add(event.blockNumber);
  });
  
  console.log(`\n📦 Need to fetch timestamps for ${allBlockNumbers.size} blocks...`);
  
  // Fetch block timestamps in batches
  const blockNumbersArray = Array.from(allBlockNumbers);
  const batchSize = 10;
  
  for (let i = 0; i < blockNumbersArray.length; i += batchSize) {
    const batch = blockNumbersArray.slice(i, i + batchSize);
    const promises = batch.map(blockNumber => 
      provider.getBlock(blockNumber)
        .then(block => {
          blockTimestamps.set(blockNumber, block.timestamp);
          return block;
        })
        .catch(err => {
          console.log(`  ❌ Error fetching block ${blockNumber}: ${err.message}`);
          return null;
        })
    );
    
    await Promise.all(promises);
    
    if (i % 50 === 0) {
      console.log(`  Progress: ${i}/${blockNumbersArray.length} blocks...`);
    }
  }
  
  console.log(`✅ Fetched ${blockTimestamps.size} block timestamps`);
  
  // Fix stake events
  console.log('\n🔄 Fixing stake events...');
  let fixedStakes = 0;
  
  cachedData.stakingData.stakeEvents = cachedData.stakingData.stakeEvents.map(stake => {
    const blockTimestamp = blockTimestamps.get(stake.blockNumber);
    
    if (!blockTimestamp) {
      console.log(`  ⚠️  No timestamp for stake block ${stake.blockNumber}`);
      return stake;
    }
    
    const stakingDays = parseInt(stake.stakingDays || stake.duration || 0);
    const maturityTimestamp = blockTimestamp + (stakingDays * 86400);
    const maturityDate = new Date(maturityTimestamp * 1000).toISOString();
    
    fixedStakes++;
    
    return {
      ...stake,
      timestamp: blockTimestamp.toString(),
      maturityDate: maturityDate,
      startDate: new Date(blockTimestamp * 1000).toISOString()
    };
  });
  
  // Fix create events
  console.log('🔄 Fixing create events...');
  let fixedCreates = 0;
  
  cachedData.stakingData.createEvents = cachedData.stakingData.createEvents.map(create => {
    const blockTimestamp = blockTimestamps.get(create.blockNumber);
    
    if (!blockTimestamp) {
      console.log(`  ⚠️  No timestamp for create block ${create.blockNumber}`);
      return create;
    }
    
    const duration = parseInt(create.duration || create.stakingDays || 0);
    const maturityTimestamp = blockTimestamp + (duration * 86400);
    const maturityDate = new Date(maturityTimestamp * 1000).toISOString();
    
    fixedCreates++;
    
    return {
      ...create,
      timestamp: blockTimestamp.toString(),
      maturityDate: maturityDate,
      startDate: new Date(blockTimestamp * 1000).toISOString()
    };
  });
  
  // Update metadata
  cachedData.lastUpdated = new Date().toISOString();
  cachedData.stakingData.lastUpdated = new Date().toISOString();
  
  // Save the fixed data
  console.log('\n💾 Saving fixed data...');
  fs.writeFileSync(cachedDataPath, JSON.stringify(cachedData, null, 2));
  
  // Verify the fix
  if (cachedData.stakingData.stakeEvents.length > 0) {
    const firstStake = cachedData.stakingData.stakeEvents[0];
    console.log(`\n✅ Sample stake:`);
    console.log(`   Block: ${firstStake.blockNumber}`);
    console.log(`   Timestamp: ${firstStake.timestamp}`);
    console.log(`   Start date: ${firstStake.startDate}`);
    console.log(`   Maturity: ${firstStake.maturityDate}`);
    console.log(`   Days: ${firstStake.stakingDays}`);
  }
  
  // Count active stakes
  const now = new Date();
  const activeStakes = cachedData.stakingData.stakeEvents.filter(stake => 
    new Date(stake.maturityDate) > now
  ).length;
  
  const activeCreates = cachedData.stakingData.createEvents.filter(create => 
    new Date(create.maturityDate) > now
  ).length;
  
  console.log('\n📊 Summary:');
  console.log(`  - Fixed ${fixedStakes} stake timestamps`);
  console.log(`  - Fixed ${fixedCreates} create timestamps`);
  console.log(`  - Active stakes: ${activeStakes}`);
  console.log(`  - Active creates: ${activeCreates}`);
  
  // Show stake end days distribution
  const stakeEndDays = {};
  cachedData.stakingData.stakeEvents.forEach(stake => {
    if (new Date(stake.maturityDate) > now) {
      const daysUntilEnd = Math.ceil((new Date(stake.maturityDate) - now) / (1000 * 60 * 60 * 24));
      if (daysUntilEnd >= 0 && daysUntilEnd <= 88) {
        stakeEndDays[daysUntilEnd] = (stakeEndDays[daysUntilEnd] || 0) + 1;
      }
    }
  });
  
  console.log('\n📊 Stake end days distribution (next 88 days):');
  Object.keys(stakeEndDays)
    .map(d => parseInt(d))
    .sort((a, b) => a - b)
    .forEach(day => {
      console.log(`  Day ${day}: ${stakeEndDays[day]} stakes`);
    });
  
  console.log('\n✅ All timestamps fixed successfully!');
}

fixAllTimestamps().catch(console.error);