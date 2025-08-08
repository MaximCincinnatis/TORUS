const fs = require('fs');
const path = require('path');

// Load cached data
const cachedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data', 'cached-data.json'), 'utf8'));

console.log('\n================================================');
console.log('📊 ANALYZING SHARE PERCENTAGE CALCULATION');
console.log('================================================\n');

const contractStartDate = new Date('2025-07-10T18:00:00Z');
const currentProtocolDay = 29;

// Find a position that's causing issues
const problematicPosition = cachedData.stakingData.createEvents.find(c => {
  const shares = parseFloat(c.shares) / 1e18;
  return shares > 5000000; // 5M+ shares
});

if (problematicPosition) {
  const shares = parseFloat(problematicPosition.shares) / 1e18;
  const maturityDate = new Date(problematicPosition.maturityDate);
  const maturityDay = Math.floor((maturityDate.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const startTime = new Date(parseInt(problematicPosition.timestamp) * 1000);
  const startDay = Math.floor((startTime.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  
  console.log('EXAMPLE POSITION:');
  console.log('================');
  console.log(`Shares: ${(shares/1e6).toFixed(2)}M`);
  console.log(`Start Day: ${startDay}`);
  console.log(`Maturity Day: ${maturityDay}`);
  console.log(`Active Days: ${maturityDay - startDay}\n`);
  
  console.log('CALCULATING REWARDS TWO WAYS:\n');
  
  // Method 1: Historical accumulation (what actually happened)
  console.log('METHOD 1: Historical Accumulation (Reality)');
  console.log('-------------------------------------------');
  let historicalRewards = 0;
  
  for (let day = startDay; day < maturityDay && day <= 117; day++) {
    const dayData = cachedData.stakingData.rewardPoolData.find(d => d.day === day);
    if (dayData) {
      const totalShares = parseFloat(dayData.totalShares);
      const rewardPool = parseFloat(dayData.rewardPool);
      const dailyReward = totalShares > 0 ? (shares / totalShares) * rewardPool : 0;
      historicalRewards += dailyReward;
      
      if (day === startDay || day === maturityDay - 1 || (day >= 110 && day <= 117)) {
        console.log(`  Day ${day}: ${(shares/totalShares*100).toFixed(2)}% of ${(totalShares/1e6).toFixed(0)}M shares = ${dailyReward.toFixed(2)} TORUS`);
      }
    }
  }
  console.log(`  Total Historical Rewards: ${historicalRewards.toFixed(2)} TORUS\n`);
  
  // Method 2: Current share percentage projected forward
  console.log('METHOD 2: Current Share % Projected Forward (Chart Logic?)');
  console.log('----------------------------------------------------------');
  
  // Get current share percentage (day 29)
  const currentDayData = cachedData.stakingData.rewardPoolData.find(d => d.day === currentProtocolDay);
  const currentTotalShares = parseFloat(currentDayData.totalShares);
  const currentSharePercentage = shares / currentTotalShares;
  
  console.log(`  Current (Day ${currentProtocolDay}) share %: ${(currentSharePercentage * 100).toFixed(4)}%`);
  console.log(`  (${(shares/1e6).toFixed(2)}M / ${(currentTotalShares/1e6).toFixed(0)}M shares)\n`);
  
  // Project forward with this fixed percentage
  let projectedRewards = 0;
  for (let day = currentProtocolDay; day < maturityDay && day <= 117; day++) {
    const dayData = cachedData.stakingData.rewardPoolData.find(d => d.day === day);
    if (dayData) {
      const rewardPool = parseFloat(dayData.rewardPool);
      const dailyReward = currentSharePercentage * rewardPool;
      projectedRewards += dailyReward;
      
      if (day === currentProtocolDay || day === maturityDay - 1 || (day >= 110 && day <= 117)) {
        console.log(`  Day ${day}: ${(currentSharePercentage * 100).toFixed(4)}% of ${rewardPool.toFixed(0)} pool = ${dailyReward.toFixed(2)} TORUS`);
      }
    }
  }
  console.log(`  Total Projected Rewards: ${projectedRewards.toFixed(2)} TORUS\n`);
  
  console.log('COMPARISON:');
  console.log('===========');
  console.log(`Historical (correct): ${historicalRewards.toFixed(2)} TORUS`);
  console.log(`Fixed % projection: ${projectedRewards.toFixed(2)} TORUS`);
  console.log(`Difference: ${(projectedRewards - historicalRewards).toFixed(2)} TORUS`);
  
  if (projectedRewards < historicalRewards) {
    console.log('\n❌ PROBLEM: Fixed % projection UNDERESTIMATES rewards!');
    console.log('   The position will earn MORE as other positions exit.');
  } else {
    console.log('\n✅ Fixed % projection is conservative (good for max supply estimate)');
  }
}

// Now check what happens with ALL positions
console.log('\n\n================================================');
console.log('TOTAL SUPPLY CALCULATION');
console.log('================================================\n');

let totalProjectedRewards = 0;
let totalHistoricalRewards = 0;
let positionsAnalyzed = 0;

[...cachedData.stakingData.stakeEvents, ...cachedData.stakingData.createEvents].forEach(position => {
  const maturityDate = new Date(position.maturityDate);
  const maturityDay = Math.floor((maturityDate.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  
  // Only count positions maturing after current day
  if (maturityDay >= currentProtocolDay && maturityDay <= 117) {
    positionsAnalyzed++;
    const shares = parseFloat(position.shares) / 1e18;
    const startTime = new Date(parseInt(position.timestamp) * 1000);
    const startDay = Math.floor((startTime.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    
    // Historical calculation
    for (let day = Math.max(startDay, currentProtocolDay); day < maturityDay; day++) {
      const dayData = cachedData.stakingData.rewardPoolData.find(d => d.day === day);
      if (dayData) {
        const totalShares = parseFloat(dayData.totalShares);
        const rewardPool = parseFloat(dayData.rewardPool);
        if (totalShares > 0) {
          totalHistoricalRewards += (shares / totalShares) * rewardPool;
        }
      }
    }
    
    // Fixed percentage calculation
    const currentDayData = cachedData.stakingData.rewardPoolData.find(d => d.day === currentProtocolDay);
    if (currentDayData) {
      const currentTotalShares = parseFloat(currentDayData.totalShares);
      const sharePercentage = shares / currentTotalShares;
      
      for (let day = currentProtocolDay; day < maturityDay; day++) {
        const dayData = cachedData.stakingData.rewardPoolData.find(d => d.day === day);
        if (dayData) {
          const rewardPool = parseFloat(dayData.rewardPool);
          totalProjectedRewards += sharePercentage * rewardPool;
        }
      }
    }
  }
});

console.log(`Analyzed ${positionsAnalyzed} positions maturing between day ${currentProtocolDay} and 117\n`);
console.log('TOTAL REWARDS:');
console.log('=============');
console.log(`Historical (varying %): ${(totalHistoricalRewards/1e6).toFixed(3)}M TORUS`);
console.log(`Fixed % projection: ${(totalProjectedRewards/1e6).toFixed(3)}M TORUS`);
console.log(`Difference: ${((totalProjectedRewards - totalHistoricalRewards)/1e6).toFixed(3)}M TORUS\n`);

const currentSupply = parseFloat(cachedData.currentSupply || 18444);
const newTokensFromCreates = cachedData.stakingData.createEvents
  .filter(c => {
    const maturityDate = new Date(c.maturityDate);
    const maturityDay = Math.floor((maturityDate.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    return maturityDay >= currentProtocolDay && maturityDay <= 117;
  })
  .reduce((sum, c) => sum + parseFloat(c.torusAmount) / 1e18, 0);

console.log('FINAL SUPPLY PROJECTIONS:');
console.log('========================');
console.log(`Current Supply: ${(currentSupply/1000).toFixed(2)}K TORUS`);
console.log(`New Tokens (creates): ${(newTokensFromCreates/1000).toFixed(2)}K TORUS\n`);
console.log(`With Historical Rewards: ${((currentSupply + newTokensFromCreates + totalHistoricalRewards)/1e6).toFixed(3)}M TORUS`);
console.log(`With Fixed % Rewards: ${((currentSupply + newTokensFromCreates + totalProjectedRewards)/1e6).toFixed(3)}M TORUS`);

console.log('\n🎯 INSIGHT:');
console.log('If the chart uses fixed % (maintaining current share percentages),');
console.log('it would show a MUCH HIGHER supply because it assumes positions');
console.log('keep their day-29 share percentage for their entire lifetime,');
console.log('ignoring that competition decreases as other positions exit.');