#!/usr/bin/env node

const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));

// Find a large position maturing on day 115
const CONTRACT_START = new Date('2025-07-10T18:00:00.000Z');
const positions = [...(data.stakingData.stakeEvents || []), ...(data.stakingData.createEvents || [])];

// Get the largest position maturing on day 115
const day115Positions = positions.filter(p => {
  const maturityDate = new Date(p.maturityDate);
  const maturityDay = Math.floor((maturityDate - CONTRACT_START) / (24*60*60*1000)) + 1;
  return maturityDay === 115;
}).sort((a, b) => parseFloat(b.shares) - parseFloat(a.shares));

const largestPosition = day115Positions[0];
if (!largestPosition) {
  console.log('No positions found');
  process.exit(0);
}

const positionShares = parseFloat(largestPosition.shares) / 1e18;
console.log('Largest position maturing on day 115:');
console.log('  Shares:', (positionShares/1e6).toFixed(2), 'M');

// Calculate rewards day by day
let cumulativeReward = 0;
const startDay = largestPosition.protocolDay || 1;

console.log('\nReward accumulation by day:');
for (let day = startDay; day < 115; day++) {
  const dayData = data.stakingData.rewardPoolData.find(d => d.day === day);
  if (!dayData) continue;
  
  const rewardPool = parseFloat(dayData.rewardPool);
  const totalShares = parseFloat(dayData.totalShares);
  
  if (totalShares > 0) {
    const sharePercent = positionShares / totalShares;
    const dailyReward = rewardPool * sharePercent;
    cumulativeReward += dailyReward;
    
    // Log key days
    if (day <= 5 || day >= 110 || day % 20 === 0) {
      console.log(`  Day ${day}: Pool=${(rewardPool/1000).toFixed(1)}K, Shares=${(totalShares/1e6).toFixed(0)}M, Daily=${dailyReward.toFixed(2)}, Cumulative=${cumulativeReward.toFixed(0)}`);
    }
  }
}

console.log('\nFinal cumulative:', cumulativeReward.toFixed(2), 'TORUS');

if (cumulativeReward > 100000) {
  console.log('🚨 Single position accumulated over 100K TORUS - THIS IS THE BUG!');
}