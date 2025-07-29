#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load cached data
const dataPath = path.join(__dirname, 'public/data/cached-data.json');
const cachedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('🔍 DEBUGGING CHART DATA FOR DAYS 15-19\n');

// Extract create and stake events
const createEvents = cachedData.stakingData.createEvents || [];
const stakeEvents = cachedData.stakingData.stakeEvents || [];

console.log(`Total creates: ${createEvents.length}`);
console.log(`Total stakes: ${stakeEvents.length}\n`);

// Calculate daily usage like the chart does
const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');

function getContractDay(date) {
  const timeDiff = date.getTime() - CONTRACT_START_DATE.getTime();
  const dayDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  return dayDiff + 1;
}

// Focus on days 15-19
const targetDays = [15, 16, 17, 18, 19];
const dailyUsage = {};

// Initialize
targetDays.forEach(day => {
  dailyUsage[day] = { creates: 0, stakes: 0 };
});

console.log('=== PROCESSING CREATES ===');

// Process creates like the chart does
createEvents.forEach((create) => {
  const createDate = new Date(parseInt(create.timestamp) * 1000);
  const protocolDay = getContractDay(createDate);
  
  if (targetDays.includes(protocolDay)) {
    console.log(`\nDay ${protocolDay} create:`);
    console.log(`  User: ${create.user}`);
    console.log(`  Timestamp: ${create.timestamp} (${createDate.toISOString()})`);
    console.log(`  titanAmount: ${create.titanAmount}`);
    console.log(`  titanXAmount: ${create.titanXAmount}`);
    console.log(`  costTitanX: ${create.costTitanX}`);
    
    if (create.titanAmount && create.titanAmount !== '0') {
      const amount = parseFloat(create.titanAmount) / 1e18;
      dailyUsage[protocolDay].creates += amount;
      console.log(`  ✅ Added ${amount} TitanX from titanAmount`);
    } else {
      console.log(`  ❌ No titanAmount (${create.titanAmount})`);
    }
  }
});

console.log('\n=== PROCESSING STAKES ===');

// Process stakes like the chart does
stakeEvents.forEach((stake) => {
  const stakeDate = new Date(parseInt(stake.timestamp) * 1000);
  const protocolDay = getContractDay(stakeDate);
  
  if (targetDays.includes(protocolDay)) {
    console.log(`\nDay ${protocolDay} stake:`);
    console.log(`  User: ${stake.user}`);
    console.log(`  Timestamp: ${stake.timestamp} (${stakeDate.toISOString()})`);
    console.log(`  rawCostTitanX: ${stake.rawCostTitanX}`);
    console.log(`  costTitanX: ${stake.costTitanX}`);
    
    if (stake.rawCostTitanX && stake.rawCostTitanX !== '0') {
      const amount = parseFloat(stake.rawCostTitanX) / 1e18;
      dailyUsage[protocolDay].stakes += amount;
      console.log(`  ✅ Added ${amount} TitanX from rawCostTitanX`);
    } else {
      console.log(`  ❌ No rawCostTitanX (${stake.rawCostTitanX})`);
    }
  }
});

console.log('\n=== DAILY TOTALS (Like Chart Calculation) ===');
targetDays.forEach(day => {
  const usage = dailyUsage[day];
  const total = usage.creates + usage.stakes;
  console.log(`Day ${day}: Creates=${usage.creates.toFixed(2)}, Stakes=${usage.stakes.toFixed(2)}, Total=${total.toFixed(2)} TitanX`);
  
  if (total > 1e9) {
    console.log(`  🎯 Day ${day} has ${(total/1e9).toFixed(1)}B TitanX - this should show in chart!`);
  }
});

console.log('\n=== EXPECTED VS ACTUAL ===');
const expected = {
  15: 83.7e9,
  16: 82.9e9,
  17: 2.7e6,
  18: 51.9e9,
  19: 9.7e9
};

targetDays.forEach(day => {
  const actual = dailyUsage[day].creates + dailyUsage[day].stakes;
  const exp = expected[day];
  console.log(`Day ${day}: Expected ${(exp/1e9).toFixed(1)}B, Got ${(actual/1e9).toFixed(1)}B, Match: ${Math.abs(actual - exp) < 1e6 ? '✅' : '❌'}`);
});