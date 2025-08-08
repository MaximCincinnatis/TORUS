const fs = require('fs');
const path = require('path');

// Load cached data
const cachedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data', 'cached-data.json'), 'utf8'));

console.log('\n================================================');
console.log('📊 ANALYZING DAILY TORUS RELEASE (NOT SHARES!)');
console.log('================================================\n');

const contractStartDate = new Date('2025-07-10T18:00:00Z');
const currentProtocolDay = cachedData.currentProtocolDay || 29;

// Track TORUS released each day
const dailyTorusRelease = new Map();

// Initialize days
for (let day = currentProtocolDay; day <= 117; day++) {
  dailyTorusRelease.set(day, {
    fromStakes: 0,
    fromCreates: 0,
    total: 0,
    positionsMaturing: 0
  });
}

// Process all positions
[...cachedData.stakingData.stakeEvents, ...cachedData.stakingData.createEvents].forEach(position => {
  const maturityDate = new Date(position.maturityDate);
  const maturityDay = Math.floor((maturityDate.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  
  // Skip if before current protocol day
  if (maturityDay < currentProtocolDay) return;
  
  // Skip if after day 117
  if (maturityDay > 117) return;
  
  const dayRelease = dailyTorusRelease.get(maturityDay);
  if (!dayRelease) return;
  
  dayRelease.positionsMaturing++;
  
  // Calculate accumulated rewards for this position
  const shares = parseFloat(position.shares) / 1e18;
  const positionStart = new Date(parseInt(position.timestamp) * 1000);
  const startDay = Math.floor((positionStart.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  
  let accumulatedRewards = 0;
  
  // Sum rewards from each day the position was active
  for (let d = startDay; d < maturityDay; d++) {
    const dayData = cachedData.stakingData.rewardPoolData.find(dd => dd.day === d);
    if (dayData) {
      const dayTotalShares = parseFloat(dayData.totalShares);
      const dayRewardPool = parseFloat(dayData.rewardPool);
      
      if (dayTotalShares > 0) {
        const dailyReward = (shares / dayTotalShares) * dayRewardPool;
        accumulatedRewards += dailyReward;
      }
    }
  }
  
  // Add to the day's release
  if (position.type === 'stake') {
    const principal = parseFloat(position.principal || '0') / 1e18;
    dayRelease.fromStakes += principal + accumulatedRewards;
  } else {
    const newTokens = parseFloat(position.torusAmount || '0') / 1e18;
    dayRelease.fromCreates += newTokens + accumulatedRewards;
  }
  
  dayRelease.total = dayRelease.fromStakes + dayRelease.fromCreates;
});

// Display results focusing on days 110-117
console.log('DAILY TORUS RELEASE BREAKDOWN:');
console.log('===============================\n');

let cumulativeTotal = 0;
for (let day = 110; day <= 117; day++) {
  const release = dailyTorusRelease.get(day);
  if (!release) continue;
  
  cumulativeTotal += release.total;
  
  console.log(`Day ${day}:`);
  console.log(`  Positions Maturing: ${release.positionsMaturing}`);
  console.log(`  From Stakes: ${release.fromStakes.toFixed(2)} TORUS`);
  console.log(`  From Creates: ${release.fromCreates.toFixed(2)} TORUS`);
  console.log(`  TOTAL RELEASED: ${release.total.toFixed(2)} TORUS`);
  
  if (release.total > 1000000) {
    console.log(`  🚨 OVER 1M TORUS RELEASED IN ONE DAY!`);
  }
  
  console.log(`  Cumulative: ${cumulativeTotal.toFixed(2)} TORUS\n`);
}

// Check the daily reward pools
console.log('\n📊 DAILY REWARD POOLS (FOR REFERENCE):');
console.log('======================================');
for (let day = 110; day <= 117; day++) {
  const dayData = cachedData.stakingData.rewardPoolData.find(d => d.day === day);
  if (dayData) {
    console.log(`Day ${day}: ${parseFloat(dayData.rewardPool).toFixed(2)} TORUS available in pool`);
  }
}

console.log('\n🔍 KEY INSIGHT:');
console.log('The daily reward pool is ~91K TORUS, but positions are accumulating');
console.log('rewards over their entire lifetime. When they mature, ALL accumulated');
console.log('rewards are released on that single day, creating large spikes.');
console.log('');
console.log('If many positions with high accumulated rewards mature on the same day,');
console.log('the TORUS released that day can be much higher than the daily pool.');