#!/usr/bin/env node

const fs = require('fs');

console.log('🔍 FINDING EXCESS TITANX IN DAILY BURNS');
console.log('======================================\n');

const buyProcessData = JSON.parse(fs.readFileSync('./public/data/buy-process-data.json', 'utf8'));

// Contract total
const contractTotal = 72024447605.033001510102734195;
console.log(`Contract TitanX for burns: ${contractTotal.toFixed(2)}`);

// Calculate running total and find where it exceeds
let runningTotal = 0;
let excessFound = false;

console.log('\n📅 DAILY BREAKDOWN:');
console.log('Day | Date       | TitanX for Burns   | Running Total      | Status');
console.log('----|------------|-------------------|-------------------|-------');

buyProcessData.dailyData.forEach(day => {
  const dayBurns = day.titanXUsedForBurns || 0;
  const previousTotal = runningTotal;
  runningTotal += dayBurns;
  
  const status = runningTotal > contractTotal && !excessFound ? '❌ EXCEEDS' : 
                 dayBurns > 0 ? '✅' : '-';
  
  if (runningTotal > contractTotal && !excessFound) {
    excessFound = true;
    console.log(`${String(day.protocolDay).padEnd(3)} | ${day.date} | ${dayBurns.toFixed(2).padEnd(17)} | ${runningTotal.toFixed(2).padEnd(17)} | ${status}`);
    console.log('\n🚨 EXCESS FOUND!');
    console.log(`  Running total: ${runningTotal.toFixed(2)}`);
    console.log(`  Contract total: ${contractTotal.toFixed(2)}`);
    console.log(`  Excess: ${(runningTotal - contractTotal).toFixed(2)}`);
    console.log(`  This day's burns: ${dayBurns.toFixed(2)}`);
    console.log(`  Previous total: ${previousTotal.toFixed(2)}`);
    console.log(`  After removing this day: ${previousTotal.toFixed(2)}`);
  } else if (dayBurns > 0) {
    console.log(`${String(day.protocolDay).padEnd(3)} | ${day.date} | ${dayBurns.toFixed(2).padEnd(17)} | ${runningTotal.toFixed(2).padEnd(17)} | ${status}`);
  }
});

console.log('\n📊 FINAL TOTALS:');
console.log(`  Daily sum: ${runningTotal.toFixed(2)}`);
console.log(`  Contract: ${contractTotal.toFixed(2)}`);
console.log(`  Excess: ${(runningTotal - contractTotal).toFixed(2)}`);

// Check for specific patterns
console.log('\n🔍 CHECKING FOR PATTERNS:');

// Check days with large burns
const largeBurnDays = buyProcessData.dailyData
  .filter(d => (d.titanXUsedForBurns || 0) > 5000000000) // > 5B TitanX
  .sort((a, b) => b.titanXUsedForBurns - a.titanXUsedForBurns);

console.log('\nDays with burns > 5B TitanX:');
largeBurnDays.forEach(day => {
  console.log(`  Day ${day.protocolDay} (${day.date}): ${(day.titanXUsedForBurns/1e9).toFixed(2)}B TitanX`);
});

// Check if any days might be duplicated
const burnsByAmount = {};
buyProcessData.dailyData.forEach(day => {
  if (day.titanXUsedForBurns > 0) {
    const key = day.titanXUsedForBurns.toFixed(2);
    if (!burnsByAmount[key]) burnsByAmount[key] = [];
    burnsByAmount[key].push(day);
  }
});

const duplicateAmounts = Object.entries(burnsByAmount)
  .filter(([_, days]) => days.length > 1);

if (duplicateAmounts.length > 0) {
  console.log('\n⚠️  Days with identical burn amounts:');
  duplicateAmounts.forEach(([amount, days]) => {
    console.log(`  Amount: ${amount}`);
    days.forEach(d => console.log(`    - Day ${d.protocolDay} (${d.date})`));
  });
}