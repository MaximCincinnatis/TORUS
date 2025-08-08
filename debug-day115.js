#!/usr/bin/env node

const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));

const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');

// Find a position maturing on day 115
const positions = [...(data.stakingData.stakeEvents || []), ...(data.stakingData.createEvents || [])];
const day115Position = positions.find(p => {
  const maturityDate = new Date(p.maturityDate);
  const maturityDay = Math.floor((maturityDate - CONTRACT_START_DATE) / (24*60*60*1000)) + 1;
  return maturityDay === 115;
});

if (!day115Position) {
  console.log('No position found maturing on day 115');
  process.exit(0);
}

console.log('Found position maturing on day 115:');
console.log('  User:', day115Position.user);
console.log('  Shares:', (parseFloat(day115Position.shares) / 1e18).toFixed(2));
console.log('  Type:', day115Position.type || 'unknown');

// Calculate what this position would accumulate
const positionShares = parseFloat(day115Position.shares) / 1e18;
const startDay = day115Position.protocolDay || 1;
const maturityDay = 115;

console.log(`\nPosition active from day ${startDay} to day ${maturityDay - 1} (${maturityDay - startDay} days)`);

let cumulativeReward = 0;

// Simulate reward accumulation
for (let day = startDay; day < maturityDay; day++) { // Note: < not <=, doesn't earn on maturity day
  const dayData = data.stakingData.rewardPoolData.find(d => d.day === day);
  if (!dayData) continue;
  
  const rewardPool = parseFloat(dayData.rewardPool);
  const totalShares = parseFloat(dayData.totalShares);
  
  if (totalShares > 0) {
    const sharePercentage = positionShares / totalShares;
    const dailyReward = rewardPool * sharePercentage;
    cumulativeReward += dailyReward;
    
    if (day >= 110 && day <= 114) {
      console.log(`  Day ${day}: Pool=${rewardPool.toFixed(0)}, TotalShares=${(totalShares/1e6).toFixed(1)}M, DailyReward=${dailyReward.toFixed(2)}`);
    }
  }
}

console.log(`\nTotal accumulated rewards: ${cumulativeReward.toFixed(2)} TORUS`);

if (cumulativeReward > 100000) {
  console.log('🚨 ERROR: Single position accumulated over 100K TORUS!');
  console.log('This is impossible with ~91K daily pools!');
}