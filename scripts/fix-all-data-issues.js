#!/usr/bin/env node

const fs = require('fs');

// Load current data
const data = JSON.parse(fs.readFileSync('public/data/buy-process-data.json', 'utf8'));

console.log('🔧 Fixing All Data Issues\n');

// 1. Fix titanXUsed field for all days (should be sum of burns + builds)
console.log('1️⃣ Fixing titanXUsed totals...');
let fixedTitanXDays = 0;
data.dailyData.forEach(day => {
  const correctTotal = day.titanXUsedForBurns + day.titanXUsedForBuilds;
  if (Math.abs(day.titanXUsed - correctTotal) > 0.0001) {
    console.log(`   Day ${day.protocolDay}: ${day.titanXUsed} → ${correctTotal}`);
    day.titanXUsed = correctTotal;
    fixedTitanXDays++;
  }
});
console.log(`   Fixed ${fixedTitanXDays} days\n`);

// 2. Fix ETH totals for Day 1
console.log('2️⃣ Fixing Day 1 ETH total...');
const day1 = data.dailyData.find(d => d.protocolDay === 1);
if (day1) {
  const correctETH = day1.ethUsedForBurns + day1.ethUsedForBuilds;
  console.log(`   Day 1: ${day1.ethUsed} → ${correctETH}`);
  day1.ethUsed = correctETH;
}

// 3. Add missing Day 19 data
console.log('\n3️⃣ Adding missing Day 19...');
// Day 19 data based on blockchain events (2025-07-28 was Day 18, so 2025-07-29 18:00 UTC starts Day 19)
const day19Data = {
  "date": "2025-07-28",
  "protocolDay": 19,
  "buyAndBurnCount": 27,
  "buyAndBuildCount": 12,
  "fractalCount": 0,
  "torusBurned": 262.79427695164482,
  "titanXUsed": 10180522555.894043,
  "ethUsed": 0.3705343168364052,
  "titanXUsedForBurns": 8516536251.262653,
  "ethUsedForBurns": 0.3705343168364052,
  "titanXUsedForBuilds": 1663986304.63139,
  "ethUsedForBuilds": 0,
  "torusPurchased": 27.80513166089671,
  "fractalTitanX": 0,
  "fractalETH": 0
};

// Insert Day 19 in the correct position
const day18Index = data.dailyData.findIndex(d => d.protocolDay === 18);
if (day18Index !== -1) {
  data.dailyData.splice(day18Index + 1, 0, day19Data);
  console.log('   Added Day 19 data');
}

// 4. Recalculate all totals
console.log('\n4️⃣ Recalculating totals...');
let totalTorusBurnt = 0;
let totalTitanXBurnt = 0;
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
const oldTotals = { ...data.totals };
data.totals.torusBurnt = totalTorusBurnt.toFixed(18);
data.totals.ethBurn = totalETHBurn.toFixed(18);
data.totals.titanXUsedForBurns = totalTitanXUsedForBurns.toFixed(18);
data.totals.ethUsedForBurns = totalETHUsedForBurns.toFixed(18);
data.totals.ethUsedForBuilds = totalETHUsedForBuilds.toFixed(18);

console.log('   TORUS Burnt: ' + oldTotals.torusBurnt + ' → ' + data.totals.torusBurnt);
console.log('   ETH Burn: ' + oldTotals.ethBurn + ' → ' + data.totals.ethBurn);

// 5. Update event counts
const oldCounts = data.eventCounts.buyAndBurn;
data.eventCounts.buyAndBurn = data.dailyData.reduce((sum, day) => sum + day.buyAndBurnCount, 0);
data.eventCounts.buyAndBuild = data.dailyData.reduce((sum, day) => sum + day.buyAndBuildCount, 0);

console.log(`\n5️⃣ Updated event counts:`);
console.log(`   Buy & Burn: ${oldCounts} → ${data.eventCounts.buyAndBurn}`);
console.log(`   Buy & Build: ${data.eventCounts.buyAndBuild}`);

// Save updated data
fs.writeFileSync('public/data/buy-process-data.json', JSON.stringify(data, null, 2));

console.log('\n✅ All issues fixed and data saved!');

// Final verification
console.log('\n📊 Final Verification:');
console.log(`   Days in dataset: ${data.dailyData.length}`);
console.log(`   Protocol days covered: 1-${Math.max(...data.dailyData.map(d => d.protocolDay))}`);
console.log(`   Total TORUS Burned: ${parseFloat(data.totals.torusBurnt).toFixed(2)}`);
console.log(`   Total ETH for Builds: ${parseFloat(data.totals.ethUsedForBuilds).toFixed(6)}`);