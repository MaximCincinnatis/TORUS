const fs = require('fs');

// Load actual data
const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
const rewardPoolData = data.stakingData?.rewardPoolData || [];

console.log('=== REWARD CALCULATION ACCURACY CHECK ===\n');

console.log('Available reward pool days:', rewardPoolData.length);
console.log('First few days:', rewardPoolData.slice(0, 5).map(d => ({ 
  day: d.day, 
  rewardPool: parseFloat(d.rewardPool).toFixed(2),
  totalShares: d.totalShares 
})));

console.log('\n=== CRITICAL ISSUE IDENTIFIED ===');

// Check what the calculation above missed - REWARDS!
// The trace only showed principal/tokens, but not the accumulated rewards
// Let's see what rewards should be

console.log('The trace above only calculated principal/tokens, but missing:');
console.log('- Accumulated reward pool earnings for each position');
console.log('- Share percentage calculations');
console.log('- Daily reward accrual until maturity');

console.log('\n=== REWARD POOL DATA ANALYSIS ===');

const nonZeroRewards = rewardPoolData.filter(d => parseFloat(d.rewardPool) > 0);
console.log('Days with non-zero rewards:', nonZeroRewards.length);
console.log('Total reward pool available:', nonZeroRewards.reduce((sum, d) => sum + parseFloat(d.rewardPool), 0).toFixed(2));

// Check if positions have share data for reward calculations
const stakes = data.stakingData?.stakeEvents || [];
const sampleStake = stakes.find(s => s.shares);
console.log('\nSample stake data (for reward calculation):');
if (sampleStake) {
  console.log('- Has shares data:', !!sampleStake.shares);
  console.log('- Shares value:', sampleStake.shares);
  console.log('- Principal:', parseFloat(sampleStake.principal)/1e18);
} else {
  console.log('- NO SHARES DATA FOUND - This is a problem!');
}

console.log('\n=== MAJOR FINDING ===');
console.log('The simple calculation above (18,422 TORUS) is WRONG because:');
console.log('1. It only counts principal/tokens (no rewards)');
console.log('2. Real max supply should be MUCH higher with reward pool earnings');
console.log('3. Need to verify if the actual calculation includes rewards correctly');

// Try to estimate rewards impact
if (nonZeroRewards.length > 0) {
  const totalRewards = nonZeroRewards.reduce((sum, d) => sum + parseFloat(d.rewardPool), 0);
  console.log(`\nIf ALL reward pools were claimed by current positions:`);
  console.log(`Max supply could be: ${(data.totalSupply + 334.75 + totalRewards).toFixed(2)} TORUS`);
  console.log(`(Current ${data.totalSupply} + positions 334.75 + rewards ${totalRewards.toFixed(2)})`);
}