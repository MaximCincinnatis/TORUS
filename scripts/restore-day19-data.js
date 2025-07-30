#!/usr/bin/env node

/**
 * Restores Day 19 burn data from backup
 * The data was lost due to the update script overwriting with zeros
 */

const fs = require('fs');

console.log('🔧 Restoring Day 19 burn data from backup...\n');

// Day 19 correct data from backup
const day19Data = {
  "date": "2025-07-28",
  "protocolDay": 19,
  "buyAndBurnCount": 13,
  "buyAndBuildCount": 7,
  "fractalCount": 0,
  "torusBurned": 47.29,
  "titanXUsed": 1132036515.34,
  "ethUsed": 0.082497,
  "titanXUsedForBurns": 1132036515.34,
  "ethUsedForBurns": 0.082497,
  "titanXUsedForBuilds": 619793164.88,
  "ethUsedForBuilds": 0,
  "torusPurchased": 11.92446327073432,
  "fractalTitanX": 0,
  "fractalETH": 0
};

try {
  // Load current data
  const currentData = JSON.parse(fs.readFileSync('./public/data/buy-process-data.json', 'utf8'));
  
  // Find Day 19 in daily data
  const day19Index = currentData.dailyData.findIndex(d => d.protocolDay === 19);
  
  if (day19Index === -1) {
    console.error('❌ Day 19 not found in daily data!');
    process.exit(1);
  }
  
  // Show before/after
  console.log('📊 Current Day 19 data:');
  console.log(JSON.stringify(currentData.dailyData[day19Index], null, 2));
  
  console.log('\n✅ Restoring to:');
  console.log(JSON.stringify(day19Data, null, 2));
  
  // Replace Day 19 data
  currentData.dailyData[day19Index] = day19Data;
  
  // Update timestamp
  currentData.lastUpdated = new Date().toISOString();
  
  // Save the file
  fs.writeFileSync('./public/data/buy-process-data.json', JSON.stringify(currentData, null, 2));
  
  console.log('\n✅ Day 19 data restored successfully!');
  console.log('📈 Day 19 now shows:');
  console.log(`  - ${day19Data.buyAndBurnCount} burns`);
  console.log(`  - ${day19Data.buyAndBuildCount} builds`);
  console.log(`  - ${day19Data.torusBurned} TORUS burned`);
  console.log(`  - ${day19Data.titanXUsed.toLocaleString()} TitanX used`);
  
} catch (error) {
  console.error('❌ Error restoring data:', error.message);
  process.exit(1);
}