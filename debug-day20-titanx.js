#!/usr/bin/env node

const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));

// Simulate the frontend calculation
const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');

function getContractDay(date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffTime = date.getTime() - CONTRACT_START_DATE.getTime();
  const diffDays = Math.floor(diffTime / msPerDay);
  return Math.max(1, diffDays + 1);
}

// Initialize daily usage structure
const dailyUsage = {};

// Get current day info
const buyProcessData = JSON.parse(fs.readFileSync('./public/data/buy-process-data.json', 'utf8'));
const currentDay = buyProcessData.currentDay || 20;
const maxDay = currentDay + 88;

console.log(`Current day: ${currentDay}, Max day: ${maxDay}`);

// Initialize all days
for (let day = 1; day <= maxDay; day++) {
  dailyUsage[day] = { creates: 0, stakes: 0 };
}

console.log('\n=== PROCESSING CREATES ===');
let processedCreates = 0;
let day20Creates = 0;

data.stakingData.createEvents.forEach((create) => {
  if (create.titanAmount && create.titanAmount !== '0') {
    const createDate = new Date(parseInt(create.timestamp) * 1000);
    const protocolDay = getContractDay(createDate);
    
    if (dailyUsage[protocolDay]) {
      const amount = parseFloat(create.titanAmount) / 1e18;
      dailyUsage[protocolDay].creates += amount;
      processedCreates++;
      
      if (protocolDay === 20) {
        day20Creates++;
        console.log(`Day 20 Create ${create.id}: ${amount.toFixed(6)} TitanX, Date: ${createDate.toISOString()}`);
      }
    }
  }
});

console.log(`\nProcessed creates: ${processedCreates}`);
console.log(`Day 20 creates found: ${day20Creates}`);
console.log(`Day 20 total TitanX: ${dailyUsage[20]?.creates.toFixed(6)} (${(dailyUsage[20]?.creates / 1e9).toFixed(3)}B)`);

// Check a few other days
[17, 18, 19, 21].forEach(day => {
  console.log(`Day ${day} total TitanX: ${dailyUsage[day]?.creates.toFixed(6)} (${(dailyUsage[day]?.creates / 1e9).toFixed(3)}B)`);
});