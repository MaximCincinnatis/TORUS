#!/usr/bin/env node

const fs = require('fs');

// Load current data
const data = JSON.parse(fs.readFileSync('public/data/buy-process-data.json', 'utf8'));

console.log('🔧 Restoring Missing Day 18\n');

// Day 18 data - July 28, 2025
const day18Data = {
  "date": "2025-07-28",
  "protocolDay": 18,
  "buyAndBurnCount": 24,
  "buyAndBuildCount": 10,
  "fractalCount": 0,
  "torusBurned": 218.49,
  "titanXUsed": 12066041717.10666,
  "ethUsed": 0.47972893638485536,
  "titanXUsedForBurns": 7580825370.62,
  "ethUsedForBurns": 0.13438618878485536,
  "titanXUsedForBuilds": 4485216346.486661,
  "ethUsedForBuilds": 0.3453427476,
  "torusPurchased": 47.24722500630594,
  "fractalTitanX": 0,
  "fractalETH": 0
};

// Find where to insert Day 18 (after Day 17)
const day17Index = data.dailyData.findIndex(d => d.protocolDay === 17);
if (day17Index !== -1) {
  // Insert Day 18 after Day 17
  data.dailyData.splice(day17Index + 1, 0, day18Data);
  console.log('✅ Day 18 restored');
  
  // Update Day 19 date to 2025-07-29 (it's currently showing wrong date)
  const day19 = data.dailyData.find(d => d.protocolDay === 19);
  if (day19) {
    day19.date = '2025-07-29';
    console.log('✅ Day 19 date corrected');
  }
} else {
  console.log('❌ Could not find Day 17 to insert after');
}

// Recalculate totals
console.log('\n📊 Recalculating totals...');
let totalTorusBurnt = 0;
let totalETHBurn = 0;
let totalTitanXUsedForBurns = 0;
let totalETHUsedForBurns = 0;
let totalETHUsedForBuilds = 0;

data.dailyData.forEach(day => {
  totalTorusBurnt += day.torusBurned || 0;
  totalETHBurn += day.ethUsed || 0;
  totalTitanXUsedForBurns += day.titanXUsedForBurns || 0;
  totalETHUsedForBurns += day.ethUsedForBurns || 0;
  totalETHUsedForBuilds += day.ethUsedForBuilds || 0;
});

// Update totals
data.totals.torusBurnt = totalTorusBurnt.toFixed(18);
data.totals.ethBurn = totalETHBurn.toFixed(18);
data.totals.titanXUsedForBurns = totalTitanXUsedForBurns.toFixed(18);
data.totals.ethUsedForBurns = totalETHUsedForBurns.toFixed(18);
data.totals.ethUsedForBuilds = totalETHUsedForBuilds.toFixed(18);

// Update event counts
data.eventCounts.buyAndBurn = data.dailyData.reduce((sum, day) => sum + day.buyAndBurnCount, 0);
data.eventCounts.buyAndBuild = data.dailyData.reduce((sum, day) => sum + day.buyAndBuildCount, 0);

console.log('✅ Totals recalculated');
console.log(`   Total TORUS Burned: ${totalTorusBurnt.toFixed(2)}`);
console.log(`   Total ETH for Builds: ${totalETHUsedForBuilds.toFixed(6)}`);

// Save updated data
fs.writeFileSync('public/data/buy-process-data.json', JSON.stringify(data, null, 2));

console.log('\n✅ Day 18 restored and data saved!');