const fs = require('fs');
const path = require('path');

// Load the TypeScript module after building
const tsConfig = require('./tsconfig.json');

// Read the transpiled JS from build
const buildFile = './build/static/js/main.*.js';

// Just do a simple calculation to find the bug
const data = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));

console.log('Checking for the 50M spike...\n');

// The chart shows data from current protocol day (29) forward
// Check what the chart would show for days 114-117

const currentSupply = data.stakingData.totals.totalSupply;
console.log('Current supply:', (currentSupply/1e6).toFixed(2), 'M TORUS');

// Look at the reward pool data
const rewardPoolData = data.stakingData.rewardPoolData;
console.log('Reward pool data available for days:', rewardPoolData[0].day, 'to', rewardPoolData[rewardPoolData.length-1].day);

// Check specific days
[114, 115, 116, 117].forEach(day => {
  const dayData = rewardPoolData.find(d => d.day === day);
  if (dayData) {
    console.log(`\nDay ${day}:`);
    console.log('  Reward pool:', parseFloat(dayData.rewardPool).toFixed(2));
    console.log('  Total shares (from contract):', dayData.totalShares);
    
    // This is the problem - if totalShares is very low, positions get huge rewards
    if (parseFloat(dayData.totalShares) < 1000000) {
      console.log('  ⚠️ WARNING: Total shares is very low! This will cause massive rewards!');
    }
  }
});

// The issue is clear - the contract data shows totalShares dropping to 443K on day 112+
// This means positions think they own huge percentages of the pool
console.log('\n🔍 THE BUG:');
console.log('The rewardPoolData from the contract shows totalShares dropping from 129M (day 111) to 443K (day 112+).');
console.log('This causes positions to think they own 100%+ of the daily reward pool!');
console.log('A position with 1M shares would think it owns 225% of the pool on day 112!');