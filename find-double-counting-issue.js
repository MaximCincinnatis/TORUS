const fs = require('fs');
const path = require('path');

// Load cached data
const cachedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data', 'cached-data.json'), 'utf8'));

console.log('\n================================================');
console.log('🔍 FINDING THE DOUBLE-COUNTING ISSUE');
console.log('================================================\n');

const contractStartDate = new Date('2025-07-10T18:00:00Z');
const currentProtocolDay = 29;

// Count positions that started before day 29 but mature after
let earlyPositionsCount = 0;
let earlyPositionsTorus = 0;

[...cachedData.stakingData.stakeEvents, ...cachedData.stakingData.createEvents].forEach(position => {
  const positionStart = new Date(parseInt(position.timestamp) * 1000);
  const startDay = Math.floor((positionStart.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  
  const maturityDate = new Date(position.maturityDate);
  const maturityDay = Math.floor((maturityDate.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  
  // Position started before day 29 but matures after day 29
  if (startDay < currentProtocolDay && maturityDay >= currentProtocolDay) {
    earlyPositionsCount++;
    
    // Calculate rewards from day 1 to day 29
    const shares = parseFloat(position.shares) / 1e18;
    let rewardsBeforeDay29 = 0;
    
    for (let d = startDay; d < currentProtocolDay; d++) {
      const dayData = cachedData.stakingData.rewardPoolData.find(dd => dd.day === d);
      if (dayData) {
        const dayTotalShares = parseFloat(dayData.totalShares);
        const dayRewardPool = parseFloat(dayData.rewardPool);
        if (dayTotalShares > 0) {
          rewardsBeforeDay29 += (shares / dayTotalShares) * dayRewardPool;
        }
      }
    }
    
    earlyPositionsTorus += rewardsBeforeDay29;
    
    if (rewardsBeforeDay29 > 10000) {
      console.log(`Position starting day ${startDay}, maturing day ${maturityDay}:`);
      console.log(`  Accumulated ${rewardsBeforeDay29.toFixed(2)} TORUS before day 29`);
      console.log(`  This gets added to supply when it matures!`);
    }
  }
});

console.log('\n📊 THE PROBLEM:');
console.log('==============');
console.log(`${earlyPositionsCount} positions started before day 29 but mature after`);
console.log(`They accumulated ${(earlyPositionsTorus / 1e6).toFixed(3)}M TORUS in rewards before day 29`);
console.log('');
console.log('When these positions mature (after day 29), the chart adds their');
console.log('FULL accumulated rewards to the supply, including rewards from days 1-28.');
console.log('');
console.log('But the currentSupply (18,427 TORUS) already includes all rewards');
console.log('distributed up to day 29!');
console.log('');
console.log('This causes DOUBLE COUNTING of rewards from days 1-28.');
console.log('');

// Calculate what the chart is probably showing
const correctFutureRewards = 2.68; // Million TORUS (our calculation)
const doubleCountedRewards = earlyPositionsTorus / 1e6;
const chartProbablyShows = correctFutureRewards + doubleCountedRewards;

console.log('🎯 CALCULATION:');
console.log('==============');
console.log(`Correct future supply: ~2.68M TORUS`);
console.log(`Double-counted rewards: ${doubleCountedRewards.toFixed(3)}M TORUS`);
console.log(`Chart probably shows: ~${chartProbablyShows.toFixed(2)}M TORUS`);
console.log('');
console.log('The chart earlier showed 11.46M, which suggests even more double-counting');
console.log('is happening - possibly counting ALL accumulated rewards for ALL positions,');
console.log('not just those maturing after day 29.');