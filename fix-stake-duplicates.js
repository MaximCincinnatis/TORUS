#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 FIXING STAKE DUPLICATES');
console.log('=========================\n');

// Load cached data
const dataPath = './public/data/cached-data.json';
const cachedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Backup original data
const backupPath = `./public/data/cached-data-backup-${Date.now()}.json`;
fs.writeFileSync(backupPath, JSON.stringify(cachedData, null, 2));
console.log(`✅ Created backup at: ${backupPath}`);

// Get original counts
const originalStakeCount = cachedData.stakingData.stakeEvents.length;
const originalCreateCount = cachedData.stakingData.createEvents.length;

console.log(`\n📊 Original counts:`);
console.log(`  - Stake events: ${originalStakeCount}`);
console.log(`  - Create events: ${originalCreateCount}`);

// Function to deduplicate events
function deduplicateEvents(events, eventType) {
  const seen = new Set();
  const duplicates = [];
  const unique = [];
  
  events.forEach((event, index) => {
    // Create unique key based on user, id, and blockNumber
    const key = `${event.user}-${event.id}-${event.blockNumber}`;
    
    if (seen.has(key)) {
      duplicates.push({ index, event, key });
    } else {
      seen.add(key);
      unique.push(event);
    }
  });
  
  console.log(`\n🔍 ${eventType} deduplication:`);
  console.log(`  - Duplicates found: ${duplicates.length}`);
  
  if (duplicates.length > 0) {
    console.log(`  - Duplicate details:`);
    duplicates.forEach(({ index, event, key }) => {
      console.log(`    • Index ${index}: ${key} (principal: ${event.principal}, cost ETH: ${event.rawCostETH || 0}, cost TitanX: ${event.rawCostTitanX || 0})`);
    });
  }
  
  return unique;
}

// Remove duplicates from stake events
cachedData.stakingData.stakeEvents = deduplicateEvents(cachedData.stakingData.stakeEvents, 'Stake');

// Remove duplicates from create events
cachedData.stakingData.createEvents = deduplicateEvents(cachedData.stakingData.createEvents, 'Create');

// Get new counts
const newStakeCount = cachedData.stakingData.stakeEvents.length;
const newCreateCount = cachedData.stakingData.createEvents.length;

console.log(`\n📊 New counts:`);
console.log(`  - Stake events: ${newStakeCount} (removed ${originalStakeCount - newStakeCount})`);
console.log(`  - Create events: ${newCreateCount} (removed ${originalCreateCount - newCreateCount})`);

// Recalculate totals based on cleaned data
let totalStakeETH = 0, totalCreateETH = 0;
let totalStakeTitanX = 0, totalCreateTitanX = 0;

cachedData.stakingData.stakeEvents.forEach(event => {
  if (event.rawCostETH && event.rawCostETH !== "0") {
    totalStakeETH += parseFloat(event.rawCostETH) / 1e18;
  }
  if (event.rawCostTitanX && event.rawCostTitanX !== "0") {
    totalStakeTitanX += parseFloat(event.rawCostTitanX) / 1e18;
  }
});

cachedData.stakingData.createEvents.forEach(event => {
  if (event.rawCostETH && event.rawCostETH !== "0") {
    totalCreateETH += parseFloat(event.rawCostETH) / 1e18;
  }
  if (event.rawCostTitanX && event.rawCostTitanX !== "0") {
    totalCreateTitanX += parseFloat(event.rawCostTitanX) / 1e18;
  }
});

// Update totals
const oldTotals = { ...cachedData.totals };
cachedData.totals = {
  totalETH: (totalStakeETH + totalCreateETH).toFixed(6),
  totalTitanX: (totalStakeTitanX + totalCreateTitanX).toFixed(2),
  totalStakedETH: totalStakeETH.toFixed(6),
  totalCreatedETH: totalCreateETH.toFixed(6),
  totalStakedTitanX: totalStakeTitanX.toFixed(2),
  totalCreatedTitanX: totalCreateTitanX.toFixed(2)
};

console.log(`\n💰 TOTALS COMPARISON:`);
console.log(`  Total ETH:`);
console.log(`    - Before: ${oldTotals.totalETH}`);
console.log(`    - After:  ${cachedData.totals.totalETH}`);
console.log(`  Total TitanX:`);
console.log(`    - Before: ${oldTotals.totalTitanX}`);
console.log(`    - After:  ${cachedData.totals.totalTitanX}`);

// Calculate active stakes total
const now = new Date();
const activeStakes = cachedData.stakingData.stakeEvents.filter(stake => {
  const maturityDate = new Date(stake.maturityDate);
  return maturityDate > now;
});

const totalActiveStaked = activeStakes.reduce((sum, stake) => 
  sum + parseFloat(stake.principal) / 1e18, 0
);

console.log(`\n📈 ACTIVE STAKES:`);
console.log(`  - Active stake count: ${activeStakes.length}`);
console.log(`  - Total TORUS staked (active): ${totalActiveStaked.toFixed(6)} TORUS`);

// Save the cleaned data
fs.writeFileSync(dataPath, JSON.stringify(cachedData, null, 2));
console.log(`\n✅ Fixed data saved to: ${dataPath}`);

// Update metadata
const metadataPath = './public/data/metadata.json';
if (fs.existsSync(metadataPath)) {
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  metadata.lastUpdated = new Date().toISOString();
  metadata.duplicatesRemoved = {
    stakes: originalStakeCount - newStakeCount,
    creates: originalCreateCount - newCreateCount,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`✅ Updated metadata`);
}

console.log('\n🎉 Fix complete!');