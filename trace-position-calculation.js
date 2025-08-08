const fs = require('fs');
const path = require('path');

// Load cached data
const cachedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data', 'cached-data.json'), 'utf8'));

console.log('\n================================================');
console.log('🔍 TRACING POSITION CALCULATION STEP BY STEP');
console.log('================================================\n');

const contractStartDate = new Date('2025-07-10T18:00:00Z');

// Pick a specific position to trace
const testPosition = cachedData.stakingData.createEvents.find(c => {
  const maturityDate = new Date(c.maturityDate);
  const maturityDay = Math.floor((maturityDate.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  return maturityDay === 115 && parseFloat(c.shares) > 5e24; // Position maturing on day 115 with 5M+ shares
});

if (testPosition) {
  const shares = parseFloat(testPosition.shares) / 1e18;
  const startTime = new Date(parseInt(testPosition.timestamp) * 1000);
  const startDay = Math.floor((startTime.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const maturityDate = new Date(testPosition.maturityDate);
  const maturityDay = Math.floor((maturityDate.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  
  console.log('TEST POSITION:');
  console.log('=============');
  console.log(`Shares: ${(shares/1e6).toFixed(2)}M`);
  console.log(`Start Day: ${startDay}`);
  console.log(`Maturity Day: ${maturityDay}`);
  console.log(`Active Days: ${maturityDay - startDay}\n`);
  
  console.log('CHECKING TOTALSHARES IN REWARDPOOLDATA:');
  console.log('========================================\n');
  
  // Check first few days and last few days
  const checkDays = [
    ...Array.from({length: 5}, (_, i) => startDay + i),  // First 5 days
    ...Array.from({length: 5}, (_, i) => maturityDay - 5 + i) // Last 5 days
  ];
  
  for (const day of checkDays) {
    if (day >= startDay && day < maturityDay) {
      const dayData = cachedData.stakingData.rewardPoolData.find(d => d.day === day);
      if (dayData) {
        const totalShares = parseFloat(dayData.totalShares);
        const rewardPool = parseFloat(dayData.rewardPool);
        const sharePercent = (shares / totalShares) * 100;
        const dailyReward = (shares / totalShares) * rewardPool;
        
        console.log(`Day ${day}:`);
        console.log(`  TotalShares in data: ${(totalShares/1e6).toFixed(1)}M`);
        console.log(`  Reward Pool: ${rewardPool.toFixed(2)} TORUS`);
        console.log(`  Position owns: ${sharePercent.toFixed(4)}% of shares`);
        console.log(`  Daily Reward: ${dailyReward.toFixed(2)} TORUS`);
        
        if (dayData.calculatedFromPositions) {
          console.log(`  ✅ TotalShares calculated from positions`);
        } else {
          console.log(`  ⚠️ TotalShares from original data`);
        }
        console.log('');
      }
    }
  }
  
  console.log('CALCULATING TOTAL ACCUMULATED REWARDS:');
  console.log('======================================\n');
  
  let totalRewards = 0;
  let problemDays = [];
  
  for (let day = startDay; day < maturityDay; day++) {
    const dayData = cachedData.stakingData.rewardPoolData.find(d => d.day === day);
    if (dayData) {
      const totalShares = parseFloat(dayData.totalShares);
      const rewardPool = parseFloat(dayData.rewardPool);
      
      if (totalShares > 0) {
        const dailyReward = (shares / totalShares) * rewardPool;
        totalRewards += dailyReward;
        
        // Flag days where position gets more than 1000 TORUS
        if (dailyReward > 1000) {
          problemDays.push({
            day,
            totalShares: totalShares / 1e6,
            dailyReward
          });
        }
      }
    }
  }
  
  console.log(`Total Accumulated Rewards: ${totalRewards.toFixed(2)} TORUS\n`);
  
  if (problemDays.length > 0) {
    console.log('🚨 PROBLEM DAYS (>1000 TORUS daily):');
    console.log('====================================');
    problemDays.forEach(p => {
      console.log(`Day ${p.day}: ${p.dailyReward.toFixed(2)} TORUS (totalShares: ${p.totalShares.toFixed(1)}M)`);
    });
  }
}

// Now check ALL totalShares values
console.log('\n\n================================================');
console.log('CHECKING ALL TOTALSHARES VALUES');
console.log('================================================\n');

let suspiciousDays = [];

for (let day = 1; day <= 117; day++) {
  const dayData = cachedData.stakingData.rewardPoolData.find(d => d.day === day);
  if (dayData) {
    const totalShares = parseFloat(dayData.totalShares);
    
    // Check for suspicious patterns
    if (day <= 29 && totalShares < 100e6) {
      suspiciousDays.push({ day, totalShares: totalShares/1e6, issue: 'Too low for early days' });
    }
    if (day >= 90 && day <= 110 && totalShares > 3000e6) {
      suspiciousDays.push({ day, totalShares: totalShares/1e6, issue: 'Too high for late days' });
    }
    
    // Sample some days
    if (day % 10 === 0 || day === 1 || day === 29 || day === 88 || day === 117) {
      console.log(`Day ${day}: ${(totalShares/1e6).toFixed(1)}M shares ${dayData.calculatedFromPositions ? '✅' : '❓'}`);
    }
  }
}

if (suspiciousDays.length > 0) {
  console.log('\n🚨 SUSPICIOUS TOTALSHARES VALUES:');
  console.log('================================');
  suspiciousDays.forEach(s => {
    console.log(`Day ${s.day}: ${s.totalShares.toFixed(1)}M - ${s.issue}`);
  });
}

console.log('\n🎯 KEY QUESTION:');
console.log('================');
console.log('Are the totalShares values correct for ALL 117 days?');
console.log('The fix script should have recalculated all of them.');
console.log('If any are wrong, positions will get incorrect rewards.');