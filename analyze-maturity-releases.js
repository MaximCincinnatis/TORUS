const fs = require('fs');
const path = require('path');

// Load cached data
const cachedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data', 'cached-data.json'), 'utf8'));

console.log('\n================================================');
console.log('📊 ANALYZING WHAT GETS RELEASED ON MATURITY');
console.log('================================================\n');

const contractStartDate = new Date('2025-07-10T18:00:00Z');
const currentProtocolDay = 29;

// For each day from 110-117, calculate what gets released
for (let targetDay = 110; targetDay <= 117; targetDay++) {
  console.log(`\nDAY ${targetDay} MATURITY RELEASES:`);
  console.log('=' .repeat(40));
  
  let dayReleaseStakes = 0;
  let dayReleaseCreates = 0;
  let positionsMaturing = 0;
  
  // Find all positions maturing on this day
  [...cachedData.stakingData.stakeEvents, ...cachedData.stakingData.createEvents].forEach(position => {
    const maturityDate = new Date(position.maturityDate);
    const maturityDay = Math.floor((maturityDate.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    
    if (maturityDay === targetDay) {
      positionsMaturing++;
      
      if (position.type === 'stake') {
        // Stake returns: principal + accumulated rewards
        const principal = parseFloat(position.principal || 0) / 1e18;
        dayReleaseStakes += principal;
        
        // Plus accumulated rewards (we'll calculate below)
      } else if (position.type === 'create') {
        // Create returns: new tokens + accumulated rewards
        const newTokens = parseFloat(position.torusAmount || 0) / 1e18;
        dayReleaseCreates += newTokens;
        
        // Plus accumulated rewards (we'll calculate below)
      }
    }
  });
  
  console.log(`Positions Maturing: ${positionsMaturing}`);
  console.log(`Principal (stakes): ${dayReleaseStakes.toFixed(2)} TORUS`);
  console.log(`New Tokens (creates): ${dayReleaseCreates.toFixed(2)} TORUS`);
  
  // Now the key question: How much rewards do these positions claim?
  let totalRewardsReleased = 0;
  
  [...cachedData.stakingData.stakeEvents, ...cachedData.stakingData.createEvents].forEach(position => {
    const maturityDate = new Date(position.maturityDate);
    const maturityDay = Math.floor((maturityDate.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    
    if (maturityDay === targetDay) {
      const shares = parseFloat(position.shares) / 1e18;
      const startTime = new Date(parseInt(position.timestamp) * 1000);
      const startDay = Math.floor((startTime.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      
      let positionRewards = 0;
      
      // Calculate rewards over position lifetime
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
      
      totalRewardsReleased += positionRewards;
    }
  });
  
  const totalDayRelease = dayReleaseStakes + dayReleaseCreates + totalRewardsReleased;
  
  console.log(`Accumulated Rewards: ${totalRewardsReleased.toFixed(2)} TORUS`);
  console.log(`TOTAL RELEASED: ${totalDayRelease.toFixed(2)} TORUS`);
  
  if (totalDayRelease > 1000000) {
    console.log('🚨 Over 1M TORUS released in one day!');
  }
}

console.log('\n================================================');
console.log('💡 KEY INSIGHT:');
console.log('================================================');
console.log('The chart shows the CUMULATIVE max supply, not daily releases.');
console.log('Each day adds to the previous total.');
console.log('');
console.log('If the chart shows a big jump, it means many positions');
console.log('with large accumulated rewards are maturing that day.');
console.log('');
console.log('The issue might be in how we\'re adding these to the cumulative total.');