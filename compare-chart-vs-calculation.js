const fs = require('fs');
const path = require('path');

console.log('\n================================================');
console.log('📊 COMPARING CHART DISPLAY VS CALCULATIONS');
console.log('================================================\n');

// Load cached data
const cachedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data', 'cached-data.json'), 'utf8'));

const currentSupply = parseFloat(cachedData.currentSupply || cachedData.totalSupply || 18444);

console.log('Starting supply:', currentSupply.toFixed(2), 'TORUS\n');

// Our calculation shows these daily releases
const ourCalculation = {
  110: 335871.79,
  111: 563435.93,
  112: 509023.02,
  113: 262376.48,
  114: 117367.37,
  115: 506712.16,
  116: 180869.26,
  117: 190217.27
};

let runningTotal = currentSupply;

console.log('EXPECTED CHART PROGRESSION:');
console.log('===========================\n');

for (let day = 110; day <= 117; day++) {
  const dailyRelease = ourCalculation[day];
  runningTotal += dailyRelease;
  
  console.log(`Day ${day}:`);
  console.log(`  Daily Release: ${(dailyRelease / 1000).toFixed(2)}K TORUS`);
  console.log(`  Total Supply: ${(runningTotal / 1e6).toFixed(3)}M TORUS`);
  
  if (dailyRelease > 500000) {
    console.log(`  📈 Large release day (${(dailyRelease / 1000).toFixed(0)}K) but this is CORRECT`);
    console.log(`     This is accumulated rewards from positions maturing`);
  }
  console.log('');
}

console.log('FINAL SUPPLY:', (runningTotal / 1e6).toFixed(3), 'M TORUS\n');

console.log('❓ THE QUESTION IS:');
console.log('=================');
console.log('If the chart is showing much higher values (like 11M+ TORUS),');
console.log('then there might be an issue with how the frontend is calculating.');
console.log('');
console.log('Our calculation shows ~2.68M TORUS final supply.');
console.log('This accounts for ALL positions maturing with their accumulated rewards.');
console.log('');
console.log('If the chart shows different values, the issue might be:');
console.log('1. Double-counting rewards somewhere');
console.log('2. Including positions that already matured before day 29');
console.log('3. A bug in the frontend calculation logic');
console.log('');
console.log('The CORRECT behavior should show:');
console.log('- Total supply reaching ~2.68M TORUS by day 117');
console.log('- Daily releases of 100-500K TORUS (not millions)');
console.log('- Smooth progression without 10M+ jumps');