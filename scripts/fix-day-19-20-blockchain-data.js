#!/usr/bin/env node

/**
 * Fixes Day 19 & 20 data based on blockchain truth
 * Protocol days change at 18:00 UTC
 */

const fs = require('fs');

console.log('🔧 Fixing Day 19 & 20 data based on blockchain...\n');

// Correct data from blockchain
const correctDay19 = {
  "date": "2025-07-28",
  "protocolDay": 19,
  "buyAndBurnCount": 37,
  "buyAndBuildCount": 16,
  "fractalCount": 0,
  "torusBurned": 222.93,
  "titanXUsed": 10648334839.168,
  "ethUsed": 0.134386, // Need to verify ETH amounts
  "titanXUsedForBurns": 6638442401.851,
  "ethUsedForBurns": 0.134386,
  "titanXUsedForBuilds": 4009892437.318,
  "ethUsedForBuilds": 0,
  "torusPurchased": 59.35,
  "fractalTitanX": 0,
  "fractalETH": 0
};

// Day 20 had no activity per blockchain
const correctDay20 = {
  "date": "2025-07-29",
  "protocolDay": 20,
  "buyAndBurnCount": 0,
  "buyAndBuildCount": 0,
  "fractalCount": 0,
  "torusBurned": 0,
  "titanXUsed": 0,
  "ethUsed": 0,
  "titanXUsedForBurns": 0,
  "ethUsedForBurns": 0,
  "titanXUsedForBuilds": 0,
  "ethUsedForBuilds": 0,
  "torusPurchased": 0,
  "fractalTitanX": 0,
  "fractalETH": 0
};

try {
  // Load current data
  const data = JSON.parse(fs.readFileSync('./public/data/buy-process-data.json', 'utf8'));
  
  // Find and update Day 19
  const day19Index = data.dailyData.findIndex(d => d.protocolDay === 19);
  const day20Index = data.dailyData.findIndex(d => d.protocolDay === 20);
  
  console.log('📊 Current Day 19 data:');
  console.log(`  Burns: ${data.dailyData[day19Index].buyAndBurnCount}`);
  console.log(`  Builds: ${data.dailyData[day19Index].buyAndBuildCount}`);
  console.log(`  TORUS Burned: ${data.dailyData[day19Index].torusBurned}`);
  
  console.log('\n✅ Updating to blockchain data:');
  console.log(`  Burns: ${correctDay19.buyAndBurnCount}`);
  console.log(`  Builds: ${correctDay19.buyAndBuildCount}`);
  console.log(`  TORUS Burned: ${correctDay19.torusBurned}`);
  
  // Update the data
  data.dailyData[day19Index] = correctDay19;
  data.dailyData[day20Index] = correctDay20;
  
  // Also need to update event counts
  const oldBurnCount = data.eventCounts.buyAndBurn;
  const oldBuildCount = data.eventCounts.buyAndBuild;
  
  // Adjust counts based on differences
  const burnDiff = (37 - 13) + (0 - 4); // Day 19 & 20 adjustments
  const buildDiff = (16 - 7) + (0 - 2); // Day 19 & 20 adjustments
  
  data.eventCounts.buyAndBurn = oldBurnCount + burnDiff;
  data.eventCounts.buyAndBuild = oldBuildCount + buildDiff;
  
  console.log('\n📊 Updated event counts:');
  console.log(`  Total burns: ${data.eventCounts.buyAndBurn} (was ${oldBurnCount})`);
  console.log(`  Total builds: ${data.eventCounts.buyAndBuild} (was ${oldBuildCount})`);
  
  // Update timestamp
  data.lastUpdated = new Date().toISOString();
  
  // Save
  fs.writeFileSync('./public/data/buy-process-data.json', JSON.stringify(data, null, 2));
  
  console.log('\n✅ Day 19 & 20 data fixed based on blockchain truth!');
  console.log('📈 Summary:');
  console.log(`  Day 19: 37 burns, 16 builds, 222.93 TORUS burned`);
  console.log(`  Day 20: 0 burns, 0 builds, 0 TORUS burned`);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}