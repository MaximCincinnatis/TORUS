const fs = require('fs');
const path = require('path');

// Load cached data
const cachedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data', 'cached-data.json'), 'utf8'));

console.log('\n================================================');
console.log('📊 CALCULATING TOTAL SUPPLY CORRECTLY');
console.log('================================================\n');

const contractStartDate = new Date('2025-07-10T18:00:00Z');
const currentProtocolDay = 29;
const currentSupply = parseFloat(cachedData.currentSupply || cachedData.totalSupply || 18444);

console.log(`Starting Supply (Day ${currentProtocolDay}): ${currentSupply.toFixed(2)} TORUS\n`);

// Track rewards for positions maturing after current day
let totalNewTokens = 0;
let totalAccumulatedRewards = 0;
let positionCount = 0;

// Process all positions
[...cachedData.stakingData.stakeEvents, ...cachedData.stakingData.createEvents].forEach(position => {
  const maturityDate = new Date(position.maturityDate);
  const maturityDay = Math.floor((maturityDate.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  
  // Only count positions maturing on or after current protocol day
  if (maturityDay >= currentProtocolDay && maturityDay <= 117) {
    positionCount++;
    
    // Add new tokens (for creates only)
    if (position.type === 'create' && position.torusAmount) {
      const newTokens = parseFloat(position.torusAmount) / 1e18;
      totalNewTokens += newTokens;
    }
    
    // Calculate accumulated rewards
    const shares = parseFloat(position.shares) / 1e18;
    const startTime = new Date(parseInt(position.timestamp) * 1000);
    const startDay = Math.floor((startTime.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    
    let positionRewards = 0;
    
    // IMPORTANT: Only count rewards from currentProtocolDay forward
    // Rewards before currentProtocolDay are already in currentSupply
    for (let day = Math.max(startDay, currentProtocolDay); day < maturityDay; day++) {
      const dayData = cachedData.stakingData.rewardPoolData.find(d => d.day === day);
      if (dayData) {
        const totalShares = parseFloat(dayData.totalShares);
        const rewardPool = parseFloat(dayData.rewardPool);
        
        if (totalShares > 0) {
          const dailyReward = (shares / totalShares) * rewardPool;
          positionRewards += dailyReward;
        }
      }
    }
    
    totalAccumulatedRewards += positionRewards;
    
    // Debug large reward positions
    if (positionRewards > 50000) {
      console.log(`Large reward position: ${(positionRewards/1000).toFixed(1)}K TORUS`);
      console.log(`  Shares: ${(shares/1e6).toFixed(2)}M`);
      console.log(`  Active: Day ${startDay} to ${maturityDay}`);
      console.log(`  Counting from: Day ${Math.max(startDay, currentProtocolDay)}\n`);
    }
  }
});

console.log('SUMMARY:');
console.log('========');
console.log(`Positions maturing after day ${currentProtocolDay}: ${positionCount}`);
console.log(`New tokens from creates: ${(totalNewTokens/1000).toFixed(2)}K TORUS`);
console.log(`Accumulated rewards (from day ${currentProtocolDay} forward): ${(totalAccumulatedRewards/1e6).toFixed(3)}M TORUS\n`);

const projectedSupply = currentSupply + totalNewTokens + totalAccumulatedRewards;

console.log('PROJECTED MAX SUPPLY:');
console.log('====================');
console.log(`Current: ${(currentSupply/1000).toFixed(2)}K`);
console.log(`+ New Tokens: ${(totalNewTokens/1000).toFixed(2)}K`);
console.log(`+ Rewards: ${(totalAccumulatedRewards/1e6).toFixed(3)}M`);
console.log(`= TOTAL: ${(projectedSupply/1e6).toFixed(3)}M TORUS\n`);

// Now check what happens if we count ALL rewards (including before day 29)
let totalAllTimeRewards = 0;

[...cachedData.stakingData.stakeEvents, ...cachedData.stakingData.createEvents].forEach(position => {
  const maturityDate = new Date(position.maturityDate);
  const maturityDay = Math.floor((maturityDate.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  
  if (maturityDay >= currentProtocolDay && maturityDay <= 117) {
    const shares = parseFloat(position.shares) / 1e18;
    const startTime = new Date(parseInt(position.timestamp) * 1000);
    const startDay = Math.floor((startTime.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    
    let positionRewards = 0;
    
    // Count ALL rewards from position start (WRONG - causes double counting)
    for (let day = startDay; day < maturityDay; day++) {
      const dayData = cachedData.stakingData.rewardPoolData.find(d => d.day === day);
      if (dayData) {
        const totalShares = parseFloat(dayData.totalShares);
        const rewardPool = parseFloat(dayData.rewardPool);
        
        if (totalShares > 0) {
          positionRewards += (shares / totalShares) * rewardPool;
        }
      }
    }
    
    totalAllTimeRewards += positionRewards;
  }
});

const wrongProjection = currentSupply + totalNewTokens + totalAllTimeRewards;

console.log('IF WE COUNT ALL REWARDS (WRONG - DOUBLE COUNTING):');
console.log('==================================================');
console.log(`All-time rewards: ${(totalAllTimeRewards/1e6).toFixed(3)}M TORUS`);
console.log(`Wrong total: ${(wrongProjection/1e6).toFixed(3)}M TORUS`);
console.log(`\nThis would be double-counting rewards from days 1-${currentProtocolDay-1}!`);

console.log('\n🎯 CONCLUSION:');
console.log('=============');
if (Math.abs(wrongProjection - 11.46e6) < 500000) {
  console.log('The chart is likely counting ALL rewards from position start,');
  console.log('not just rewards from day 29 forward. This causes double-counting!');
} else if (Math.abs(projectedSupply - 2.68e6) < 500000) {
  console.log('The correct calculation gives ~2.68M TORUS');
} else {
  console.log(`Correct: ${(projectedSupply/1e6).toFixed(2)}M`);
  console.log(`Chart shows: 11.46M`);
  console.log('There may be another issue in the calculation.');
}