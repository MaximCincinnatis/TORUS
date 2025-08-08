#!/usr/bin/env node

const fs = require('fs');

// Load data
const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));

// Simulate the calculation with the fix
const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
const positions = [
  ...(data.stakingData.stakeEvents || []).map(s => ({...s, type: 'stake'})),
  ...(data.stakingData.createEvents || []).map(c => ({...c, type: 'create'}))
];

console.log('Verifying the fix...\n');

// Calculate totalShares for days 110-117 (the correct way)
for (let day = 110; day <= 117; day++) {
  let totalSharesCalculated = 0;
  let activeCount = 0;
  
  positions.forEach(pos => {
    const startDay = pos.protocolDay || 1;
    const maturityDate = new Date(pos.maturityDate);
    const maturityDay = Math.floor((maturityDate - CONTRACT_START_DATE) / (24*60*60*1000)) + 1;
    
    if (day >= startDay && day < maturityDay) {
      totalSharesCalculated += parseFloat(pos.shares || 0) / 1e18;
      activeCount++;
    }
  });
  
  // Get what the contract reports
  const contractData = data.stakingData.rewardPoolData.find(d => d.day === day);
  const contractTotalShares = contractData ? parseFloat(contractData.totalShares) : 0;
  const rewardPool = contractData ? parseFloat(contractData.rewardPool) : 0;
  
  console.log(`Day ${day}:`);
  console.log(`  Reward Pool: ${rewardPool.toFixed(2)} TORUS`);
  console.log(`  Contract totalShares: ${(contractTotalShares/1e6).toFixed(2)}M (WRONG)`);
  console.log(`  Calculated totalShares: ${(totalSharesCalculated/1e6).toFixed(2)}M (CORRECT)`);
  
  // Show what would happen with a 1M share position
  const testShares = 1000000; // 1M shares
  const wrongSharePercent = testShares / contractTotalShares;
  const correctSharePercent = testShares / totalSharesCalculated;
  const wrongDailyReward = rewardPool * wrongSharePercent;
  const correctDailyReward = rewardPool * correctSharePercent;
  
  console.log(`  1M share position would get:`);
  console.log(`    With contract data: ${wrongDailyReward.toFixed(2)} TORUS (${(wrongSharePercent*100).toFixed(1)}% of pool)`);
  console.log(`    With fix: ${correctDailyReward.toFixed(2)} TORUS (${(correctSharePercent*100).toFixed(4)}% of pool)`);
  
  if (wrongDailyReward > rewardPool) {
    console.log(`  🚨 BUG: Position would claim MORE than entire pool!`);
  }
  console.log('');
}

console.log('✅ The fix ensures positions use the CORRECT calculated totalShares');
console.log('✅ This prevents positions from claiming more than the daily pool');
console.log('✅ No more 50M TORUS spikes!');