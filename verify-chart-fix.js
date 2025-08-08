const fs = require('fs');
const path = require('path');

console.log('\n================================================');
console.log('🔍 VERIFYING CHART FIX FOR DAY 117');
console.log('================================================\n');

// Load cached data
const cachedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data', 'cached-data.json'), 'utf8'));
const rewardPoolData = cachedData.stakingData.rewardPoolData;
const allPositions = [...cachedData.stakingData.stakeEvents, ...cachedData.stakingData.createEvents];
const contractStartDate = new Date('2025-07-10T18:00:00Z');
const currentSupply = parseFloat(cachedData.totalSupply || 19092);

console.log('Starting supply:', currentSupply.toFixed(2), 'TORUS');
console.log('Total positions:', allPositions.length);
console.log('');

// Track cumulative totals
let totalPrincipal = 0;
let totalRewardsDistributed = 0;
let debugInfo = [];

// Calculate principal
allPositions.forEach(position => {
  const amount = position.principal ? parseFloat(position.principal) / 1e18 : 
                 position.torusAmount ? parseFloat(position.torusAmount) / 1e18 : 0;
  totalPrincipal += amount;
});

// Calculate rewards using THE FIXED FORMULA
for (let day = 1; day <= 117; day++) {
  const poolData = rewardPoolData.find(pd => pd.day === day);
  if (\!poolData) continue;
  
  const date = new Date(contractStartDate.getTime() + ((day - 1) * 24 * 60 * 60 * 1000));
  const rewardPool = parseFloat(poolData.rewardPool);
  
  // THIS IS THE FIX: Use pool data totalShares with 1e10 multiplier
  const actualTotalShares = parseFloat(poolData.totalShares) * 1e10;
  
  if (actualTotalShares === 0) continue;
  
  let dailyRewardsGiven = 0;
  
  allPositions.forEach(position => {
    const startDate = new Date(position.timestamp * 1000);
    const endDate = new Date(position.maturityDate);
    
    if (date >= startDate && date < endDate) {
      const positionShares = parseFloat(position.shares) / 1e18;
      const sharePercentage = positionShares / actualTotalShares;
      const dailyReward = rewardPool * sharePercentage;
      
      dailyRewardsGiven += dailyReward;
    }
  });
  
  totalRewardsDistributed += dailyRewardsGiven;
  
  // Log critical days
  if (day === 1 || day === 29 || day === 100 || day >= 115) {
    debugInfo.push({
      day,
      pool: rewardPool.toFixed(2),
      totalShares: (actualTotalShares / 1e10 / 1e6).toFixed(1) + 'M',
      distributed: dailyRewardsGiven.toFixed(2)
    });
  }
}

console.log('DEBUG INFO FOR KEY DAYS:');
console.log('========================');
debugInfo.forEach(info => {
  console.log(`Day ${info.day}: Pool=${info.pool}, TotalShares=${info.totalShares}, Distributed=${info.distributed}`);
});

console.log('\n================================================');
console.log('FINAL CALCULATION RESULTS:');
console.log('================================================');
console.log('Current Supply:', currentSupply.toFixed(2), 'TORUS');
console.log('+ Principal/New Tokens:', totalPrincipal.toFixed(2), 'TORUS');
console.log('+ Total Rewards (days 1-117):', totalRewardsDistributed.toFixed(2), 'TORUS');
console.log('================================================');

const finalSupply = currentSupply + totalPrincipal + totalRewardsDistributed;
console.log('TOTAL ON DAY 117:', finalSupply.toFixed(2), 'TORUS');
console.log('In millions:', (finalSupply / 1e6).toFixed(2) + 'M TORUS');

console.log('\n================================================');
console.log('VERIFICATION:');
console.log('================================================');

if (finalSupply > 15e6) {
  console.log('❌ STILL BROKEN\! Shows', (finalSupply / 1e6).toFixed(1) + 'M instead of ~11.6M');
  console.log('   The fix did NOT work\!');
} else if (finalSupply < 10e6) {
  console.log('⚠️ Too low\! Shows', (finalSupply / 1e6).toFixed(1) + 'M instead of ~11.6M');
} else {
  console.log('✅ FIXED\! Shows', (finalSupply / 1e6).toFixed(1) + 'M TORUS');
  console.log('   This is the correct range\!');
}

// Additional sanity check
const maxPossibleRewards = rewardPoolData
  .filter(d => d.day >= 1 && d.day <= 117)
  .reduce((sum, d) => sum + parseFloat(d.rewardPool), 0);

console.log('\nSanity check:');
console.log('Max possible rewards (sum of all pools):', (maxPossibleRewards / 1e6).toFixed(2) + 'M');
console.log('Actually distributed:', (totalRewardsDistributed / 1e6).toFixed(2) + 'M');

if (totalRewardsDistributed > maxPossibleRewards) {
  console.log('❌ ERROR: Distributing MORE than exists in pools\!');
}
EOF < /dev/null
