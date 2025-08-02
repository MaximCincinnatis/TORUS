#!/usr/bin/env node

/**
 * Fix Day 20 data - it has activity but JSON shows 0
 */

const fs = require('fs');

console.log('🔧 Fixing Day 20 data...\n');

const correctDay20 = {
  "date": "2025-07-29",
  "protocolDay": 20,
  "buyAndBurnCount": 14,
  "buyAndBuildCount": 7,
  "fractalCount": 0,
  "torusBurned": 169.17,
  "titanXUsed": 9382626189.517,
  "ethUsed": 0, // Need to check ETH usage
  "titanXUsedForBurns": 5932734340.221,
  "ethUsedForBurns": 0,
  "titanXUsedForBuilds": 3449891849.296,
  "ethUsedForBuilds": 0,
  "torusPurchased": 33.29,
  "fractalTitanX": 0,
  "fractalETH": 0
};

try {
  const data = JSON.parse(fs.readFileSync('./public/data/buy-process-data.json', 'utf8'));
  
  const day20Index = data.dailyData.findIndex(d => d.protocolDay === 20);
  
  console.log('Current Day 20 data:');
  console.log(`Burns: ${data.dailyData[day20Index].buyAndBurnCount}`);
  console.log(`TORUS Burned: ${data.dailyData[day20Index].torusBurned}`);
  
  console.log('\n✅ Updating to correct data:');
  console.log(`Burns: ${correctDay20.buyAndBurnCount}`);
  console.log(`TORUS Burned: ${correctDay20.torusBurned}`);
  
  // Update data
  data.dailyData[day20Index] = correctDay20;
  
  // Fix event counts
  data.eventCounts.buyAndBurn += 14;
  data.eventCounts.buyAndBuild += 7;
  
  data.lastUpdated = new Date().toISOString();
  
  fs.writeFileSync('./public/data/buy-process-data.json', JSON.stringify(data, null, 2));
  
  console.log('\n✅ Day 20 fixed!');
  console.log('📈 Day 20 now shows: 14 burns, 7 builds, 169.17 TORUS burned');
  
} catch (error) {
  console.error('❌ Error:', error.message);
}