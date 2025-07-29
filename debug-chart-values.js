#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load cached data
const dataPath = path.join(__dirname, 'public/data/cached-data.json');
const cachedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('🎯 CHART VALUES DEBUG - What should appear on the chart\n');

// Extract create and stake events
const createEvents = cachedData.stakingData.createEvents || [];
const stakeEvents = cachedData.stakingData.stakeEvents || [];

const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');

function getContractDay(date) {
  const timeDiff = date.getTime() - CONTRACT_START_DATE.getTime();
  const dayDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  return dayDiff + 1;
}

// Replicate EXACT chart calculation
const dailyUsage = {};
const targetDays = [15, 16, 17, 18, 19];

// Initialize
for (let day = 1; day <= 25; day++) {
  dailyUsage[day] = { creates: 0, stakes: 0 };
}

// Process creates like chart does (line 978-988)
createEvents.forEach((create) => {
  if (create.titanAmount && create.titanAmount !== '0') {
    const createDate = new Date(parseInt(create.timestamp) * 1000);
    const protocolDay = getContractDay(createDate);
    
    if (dailyUsage[protocolDay]) {
      const amount = parseFloat(create.titanAmount) / 1e18;
      dailyUsage[protocolDay].creates += amount;
    }
  }
});

// Process stakes like chart does (line 993-1003)
stakeEvents.forEach((stake) => {
  if (stake.rawCostTitanX && stake.rawCostTitanX !== '0') {
    const stakeDate = new Date(parseInt(stake.timestamp) * 1000);
    const protocolDay = getContractDay(stakeDate);
    
    if (dailyUsage[protocolDay]) {
      const amount = parseFloat(stake.rawCostTitanX) / 1e18;
      dailyUsage[protocolDay].stakes += amount;
    }
  }
});

// Show what the chart should display
console.log('📊 EXACT CHART VALUES (What should be on the chart):');
console.log('Day | Creates (TitanX) | Stakes (TitanX) | Total (TitanX) | Formatted Total');
console.log('----+------------------+-----------------+----------------+----------------');

targetDays.forEach(day => {
  const creates = Math.round(dailyUsage[day].creates * 100) / 100; // Matches chart line 2606
  const stakes = Math.round(dailyUsage[day].stakes * 100) / 100;   // Matches chart line 2611
  const total = creates + stakes;
  const formatted = total.toLocaleString('en-US', { maximumFractionDigits: 2 });
  
  console.log(`${day.toString().padStart(3)} | ${creates.toLocaleString('en-US', { maximumFractionDigits: 2 }).padStart(16)} | ${stakes.toLocaleString('en-US', { maximumFractionDigits: 2 }).padStart(15)} | ${total.toLocaleString('en-US', { maximumFractionDigits: 2 }).padStart(14)} | ${formatted}`);
});

console.log('\n🔥 EXPECTED MASSIVE VALUES:');
const expectedValues = {
  15: 83.7e9,
  16: 82.9e9, 
  17: 2.7e6,
  18: 51.9e9,
  19: 9.7e9
};

targetDays.forEach(day => {
  const actual = dailyUsage[day].creates + dailyUsage[day].stakes;
  const expected = expectedValues[day];
  const billions = actual / 1e9;
  
  console.log(`Day ${day}: Chart shows ${billions.toFixed(1)}B TitanX, Should show ${(expected/1e9).toFixed(1)}B TitanX - ${Math.abs(actual - expected) < 1e6 ? '✅ MATCH' : '❌ MISMATCH'}`);
});

console.log('\n🎯 If the chart is not showing these values, the issue is:');
console.log('1. Chart component not re-rendering');
console.log('2. Browser cache (try hard refresh)');
console.log('3. Different data being loaded in browser vs this script');
console.log('4. Chart filtering or transformation issue');

console.log('\n📝 DEBUGGING STEPS:');
console.log('1. Open browser dev tools and check console logs');
console.log('2. Look for "🎯 Days 15-19 TitanX Usage (Chart Debug)" in console');
console.log('3. Compare console output with values above');
console.log('4. If values match but chart doesn\'t show them, it\'s a rendering issue');
console.log('5. If values don\'t match, it\'s a data loading issue');