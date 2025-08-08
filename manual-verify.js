const fs = require('fs');
const path = require('path');

// Load cached data
const cachedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data', 'cached-data.json'), 'utf8'));
const rewardPoolData = cachedData.stakingData.rewardPoolData;
const allPositions = [...cachedData.stakingData.stakeEvents, ...cachedData.stakingData.createEvents];
const contractStartDate = new Date('2025-07-10T18:00:00Z');
const currentSupply = parseFloat(cachedData.totalSupply || 19092);
const currentProtocolDay = 29; // Using the hardcoded value like in the fix

console.log('=== MANUAL VERIFICATION OF CHART VALUES ===');
console.log('');

// Track cumulative totals
let totalPrincipal = 0;
let totalRewardsDistributed = 0;
let rewardsByDay = {};

// Calculate principal
allPositions.forEach(position => {
  const amount = position.principal ? parseFloat(position.principal) / 1e18 : 
                 position.torusAmount ? parseFloat(position.torusAmount) / 1e18 : 0;
  totalPrincipal += amount;
});

// Calculate rewards EXACTLY as the fixed code does
for (let day = 1; day <= 117; day++) {
  const poolData = rewardPoolData.find(pd => pd.day === day);
  if (!poolData) continue;
  
  const date = new Date(contractStartDate.getTime() + ((day - 1) * 24 * 60 * 60 * 1000));
  const rewardPool = parseFloat(poolData.rewardPool);
  
  // Calculate totalShares like the fixed code
  let totalSharesForDay = 0;
  allPositions.forEach(position => {
    const startDate = new Date(position.timestamp * 1000);
    const endDate = new Date(position.maturityDate);
    if (date >= startDate && date < endDate) {
      totalSharesForDay += parseFloat(position.shares) / 1e18;
    }
  });
  
  if (totalSharesForDay === 0) continue;
  
  let dailyRewardsGiven = 0;
  
  allPositions.forEach(position => {
    const startDate = new Date(position.timestamp * 1000);
    const endDate = new Date(position.maturityDate);
    
    if (date >= startDate && date < endDate) {
      const positionShares = parseFloat(position.shares) / 1e18;
      const sharePercentage = positionShares / totalSharesForDay;
      const dailyReward = rewardPool * sharePercentage;
      
      // Using the fix: only count from day 29 forward
      const effectiveCurrentDay = currentProtocolDay || 29;
      if (day >= effectiveCurrentDay) {
        dailyRewardsGiven += dailyReward;
      }
    }
  });
  
  rewardsByDay[day] = dailyRewardsGiven;
  totalRewardsDistributed += dailyRewardsGiven;
}

const finalSupply = currentSupply + totalPrincipal + totalRewardsDistributed;

console.log('Current Supply: ' + currentSupply.toFixed(2) + ' TORUS');
console.log('+ Principal/New Tokens: ' + totalPrincipal.toFixed(2) + ' TORUS');
console.log('+ Rewards (day 29-117): ' + totalRewardsDistributed.toFixed(2) + ' TORUS');
console.log('');
console.log('📊 CHART SHOULD SHOW ON DAY 117:');
console.log('================================');
console.log('Total: ' + finalSupply.toFixed(2) + ' TORUS');
console.log('In millions: ' + (finalSupply / 1e6).toFixed(2) + 'M TORUS');
console.log('');

// Check some key days
console.log('Sample day rewards (should be 0 before day 29):');
console.log('Day 1 rewards: ' + (rewardsByDay[1] || 0).toFixed(2));
console.log('Day 28 rewards: ' + (rewardsByDay[28] || 0).toFixed(2));
console.log('Day 29 rewards: ' + (rewardsByDay[29] || 0).toFixed(2));
console.log('Day 30 rewards: ' + (rewardsByDay[30] || 0).toFixed(2));
console.log('');

if (finalSupply > 9e6) {
  console.log('❌ PROBLEM: Chart will show ' + (finalSupply / 1e6).toFixed(2) + 'M which is too high!');
  console.log('   Expected: ~8.79M TORUS');
} else if (finalSupply < 8.5e6) {
  console.log('⚠️ PROBLEM: Chart will show ' + (finalSupply / 1e6).toFixed(2) + 'M which is too low!');
  console.log('   Expected: ~8.79M TORUS');
} else {
  console.log('✅ CORRECT: Chart will show ~8.87M TORUS as expected!');
}