#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, 'public/data/cached-data.json');

// Load data
const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));

console.log('Fixing totalShares for projected days...\n');

// Fix rewardPoolData for days that are projections
data.stakingData.rewardPoolData.forEach(day => {
  if (day.calculated === true && day.day >= 112) {
    console.log(`Day ${day.day}: Setting totalShares from ${day.totalShares} to 0`);
    day.totalShares = 0; // Let frontend calculate from actual positions
  }
});

// Save the fixed data
fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));

console.log('\n✅ Fixed! Now the frontend will calculate totalShares from actual positions.');
console.log('This prevents the 50M TORUS spike by using real position data instead of wrong carried-forward values.');