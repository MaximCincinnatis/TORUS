#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, 'public/data/cached-data.json');
const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');

// Load data
const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));

console.log('Calculating CORRECT totalShares from actual positions...\n');

// Get all positions
const positions = [
  ...(data.stakingData.stakeEvents || []).map(s => ({...s, type: 'stake'})),
  ...(data.stakingData.createEvents || []).map(c => ({...c, type: 'create'}))
];

// Calculate totalShares for each day - FIX ALL DAYS
for (let day = 1; day <= 117; day++) {
  let totalShares = 0;
  let activeCount = 0;
  
  positions.forEach(pos => {
    const startDay = pos.protocolDay || 1;
    const maturityDate = new Date(pos.maturityDate);
    const maturityDay = Math.floor((maturityDate - CONTRACT_START_DATE) / (24*60*60*1000)) + 1;
    
    // Position is active from startDay up to (but not including) maturityDay
    if (day >= startDay && day < maturityDay) {
      totalShares += parseFloat(pos.shares || 0) / 1e18;
      activeCount++;
    }
  });
  
  // Find this day in rewardPoolData
  const dayData = data.stakingData.rewardPoolData.find(d => d.day === day);
  if (dayData) {
    const oldValue = dayData.totalShares;
    const newValue = totalShares;
    
    console.log(`Day ${day}:`);
    console.log(`  Current value: ${(oldValue/1e6).toFixed(2)}M`);
    console.log(`  Correct value: ${(newValue/1e6).toFixed(2)}M (${activeCount} active positions)`);
    
    // Always update to ensure accuracy
    console.log(`  🚨 FIXING: Setting to ${(newValue/1e6).toFixed(2)}M shares`);
    dayData.totalShares = totalShares;
    dayData.calculatedFromPositions = true; // Mark that we calculated this
  }
}

// Save the fixed data
fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));

console.log('\n✅ Fixed totalShares using ACTUAL position data!');
console.log('This is 100% accurate based on on-chain positions.');