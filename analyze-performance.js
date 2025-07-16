#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Analyzing TORUS Dashboard Performance...\n');

// Load cached data
const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));

// Analyze data sizes
console.log('📊 Data Sizes:');
console.log(`  - File size: ${(fs.statSync('./public/data/cached-data.json').size / 1024).toFixed(1)} KB`);
console.log(`  - Stake events: ${cachedData.stakingData.stakeEvents.length}`);
console.log(`  - Create events: ${cachedData.stakingData.createEvents.length}`);
console.log(`  - LP positions: ${cachedData.lpPositions.length}`);
console.log(`  - Historical data points: ${cachedData.historicalData.sevenDay.length + cachedData.historicalData.thirtyDay.length}`);
console.log(`  - Reward pool data: ${cachedData.rewardPoolData.length} days`);

// Calculate total data points being processed
const totalDataPoints = 
  cachedData.stakingData.stakeEvents.length +
  cachedData.stakingData.createEvents.length +
  cachedData.lpPositions.length +
  cachedData.historicalData.sevenDay.length +
  cachedData.historicalData.thirtyDay.length +
  cachedData.rewardPoolData.length;

console.log(`\n📈 Total data points: ${totalDataPoints}`);

// Performance bottlenecks
console.log('\n⚠️  Potential Performance Issues:');

if (cachedData.stakingData.stakeEvents.length + cachedData.stakingData.createEvents.length > 500) {
  console.log('  - Large number of stake/create events (800+)');
  console.log('    → Each requires date parsing and calculations');
}

if (cachedData.rewardPoolData.length > 30) {
  console.log('  - Extensive reward pool data (88 days)');
  console.log('    → Complex daily reward calculations for each position');
}

console.log('\n💡 Optimization Suggestions:');
console.log('  1. Implement virtual scrolling for large data tables');
console.log('  2. Use React.memo for chart components');
console.log('  3. Debounce expensive calculations');
console.log('  4. Consider server-side calculation of complex metrics');
console.log('  5. Implement progressive data loading');

// Estimate processing time
const estimatedProcessingTime = (totalDataPoints * 2) / 1000; // rough estimate
console.log(`\n⏱️  Estimated processing time: ${estimatedProcessingTime.toFixed(1)}s`);
console.log('  (Actual may vary based on device performance)');