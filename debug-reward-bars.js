// Debug why reward bars are not showing despite non-zero reward pools

const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));

console.log('🔍 DEBUGGING REWARD BARS NOT SHOWING');
console.log('====================================');

const stakeEvents = data.stakingData.stakeEvents;
const createEvents = data.stakingData.createEvents;
const rewardPoolData = data.stakingData.rewardPoolData;

// First, confirm we have non-zero reward pools
const nonZeroRewardDays = rewardPoolData.filter(d => d.rewardPool > 0);
console.log(`✅ Found ${nonZeroRewardDays.length} days with non-zero reward pools`);
console.log('Days with rewards:', nonZeroRewardDays.map(d => `Day ${d.day}: ${d.rewardPool} TORUS`));

// Simulate the calculateTorusReleasesWithRewards function
console.log('\n🔍 SIMULATING REWARD CALCULATION...');

const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
const msPerDay = 24 * 60 * 60 * 1000;

// Initialize releases for first 30 days
const releases = {};
for (let i = 0; i < 30; i++) {
  const date = new Date(CONTRACT_START_DATE.getTime() + (i * msPerDay));
  const dateKey = date.toISOString().split('T')[0];
  releases[dateKey] = { principal: 0, rewards: 0, total: 0 };
}

console.log('Initialized release tracking for first 30 days');

// Add principal amounts first (simplified - just check if they're there)
createEvents.slice(0, 10).forEach(create => {
  const maturityDate = new Date(create.maturityDate);
  const dateKey = maturityDate.toISOString().split('T')[0];
  if (releases[dateKey]) {
    const amount = parseFloat(create.torusAmount) / 1e18;
    releases[dateKey].principal += amount;
  }
});

stakeEvents.slice(0, 10).forEach(stake => {
  const maturityDate = new Date(stake.maturityDate);
  const dateKey = maturityDate.toISOString().split('T')[0];
  if (releases[dateKey]) {
    const amount = parseFloat(stake.principal) / 1e18;
    releases[dateKey].principal += amount;
  }
});

console.log('Added principal amounts for first 10 positions');

// Now the critical part - calculate rewards
const allPositions = [...createEvents.slice(0, 10), ...stakeEvents.slice(0, 10)];
console.log(`\nProcessing ${allPositions.length} sample positions for reward calculation...`);

// For each day with rewards
nonZeroRewardDays.forEach(rewardDay => {
  const protocolDay = rewardDay.day;
  const date = new Date(CONTRACT_START_DATE.getTime() + ((protocolDay - 1) * msPerDay));
  
  console.log(`\n--- DAY ${protocolDay} (${date.toISOString().split('T')[0]}) ---`);
  console.log(`Reward Pool: ${rewardDay.rewardPool} TORUS`);
  console.log(`Total Shares: ${rewardDay.totalShares}`);
  
  const rewardPool = rewardDay.rewardPool;
  const totalShares = rewardDay.totalShares;
  
  let activePositions = 0;
  let totalRewardsDistributed = 0;
  let rewardsByMaturityDate = {};
  
  allPositions.forEach((position, idx) => {
    const startDate = new Date(position.timestamp * 1000);
    const endDate = new Date(position.maturityDate);
    
    // Check if position is active on this day
    if (date >= startDate && date < endDate) {
      activePositions++;
      
      const positionShares = parseFloat(position.shares) / 1e18;
      const dailyReward = (rewardPool * positionShares) / totalShares;
      totalRewardsDistributed += dailyReward;
      
      // This is where rewards go - to the MATURITY date
      const maturityKey = endDate.toISOString().split('T')[0];
      
      if (!rewardsByMaturityDate[maturityKey]) {
        rewardsByMaturityDate[maturityKey] = 0;
      }
      rewardsByMaturityDate[maturityKey] += dailyReward;
      
      // Also add to our releases tracking if within range
      if (releases[maturityKey]) {
        releases[maturityKey].rewards += dailyReward;
      }
      
      if (idx < 3) { // Debug first 3 positions
        console.log(`  Position ${idx}: ${positionShares.toFixed(2)} shares → ${dailyReward.toFixed(4)} TORUS reward → matures ${maturityKey}`);
      }
    }
  });
  
  console.log(`Active positions: ${activePositions}`);
  console.log(`Total rewards distributed: ${totalRewardsDistributed.toFixed(4)} TORUS`);
  console.log(`Reward distribution by maturity date:`);
  Object.entries(rewardsByMaturityDate).forEach(([date, amount]) => {
    console.log(`  ${date}: ${amount.toFixed(4)} TORUS`);
  });
});

// Calculate totals for our releases
Object.keys(releases).forEach(dateKey => {
  releases[dateKey].total = releases[dateKey].principal + releases[dateKey].rewards;
});

// Show the results for dates that have any activity
console.log('\n📊 FINAL RELEASE CALCULATION RESULTS:');
console.log('====================================');
const datesWithActivity = Object.entries(releases)
  .filter(([_, data]) => data.total > 0)
  .sort((a, b) => a[0].localeCompare(b[0]));

if (datesWithActivity.length === 0) {
  console.log('❌ NO ACTIVITY FOUND - This is the problem!');
  console.log('Checking why no releases are calculated...');
  
  // Debug why no releases
  console.log('\nDEBUG - First few positions:');
  allPositions.slice(0, 3).forEach((pos, i) => {
    console.log(`Position ${i}:`);
    console.log(`  Timestamp: ${pos.timestamp} (${new Date(pos.timestamp * 1000).toISOString()})`);
    console.log(`  Maturity: ${pos.maturityDate}`);
    console.log(`  Shares: ${pos.shares} (${parseFloat(pos.shares) / 1e18})`);
    console.log(`  Principal/Torus: ${pos.principal || pos.torusAmount} (${parseFloat(pos.principal || pos.torusAmount) / 1e18})`);
  });
} else {
  console.log(`Found ${datesWithActivity.length} dates with activity:`);
  datesWithActivity.forEach(([date, data]) => {
    console.log(`${date}: P=${data.principal.toFixed(2)}, R=${data.rewards.toFixed(4)}, Total=${data.total.toFixed(2)}`);
  });
}

// Check if the issue is with days after Day 17
console.log('\n🎯 CHECKING DAYS 17+ SPECIFICALLY:');
const day17Data = rewardPoolData.find(d => d.day === 17);
if (day17Data && day17Data.rewardPool > 0) {
  console.log(`Day 17 has ${day17Data.rewardPool} TORUS rewards`);
  
  // Check if any positions are active on Day 17
  const day17Date = new Date('2025-07-26T18:00:00.000Z'); // Day 17
  let day17ActivePositions = 0;
  
  allPositions.forEach(position => {
    const startDate = new Date(position.timestamp * 1000);
    const endDate = new Date(position.maturityDate);
    
    if (day17Date >= startDate && day17Date < endDate) {
      day17ActivePositions++;
    }
  });
  
  console.log(`Positions active on Day 17: ${day17ActivePositions}`);
  
  if (day17ActivePositions === 0) {
    console.log('❌ NO POSITIONS ACTIVE ON DAY 17 - This could be the issue!');
    console.log('Checking position timelines...');
    
    allPositions.slice(0, 3).forEach((pos, i) => {
      const start = new Date(pos.timestamp * 1000);
      const end = new Date(pos.maturityDate);
      console.log(`Position ${i}: ${start.toISOString().split('T')[0]} → ${end.toISOString().split('T')[0]}`);
      console.log(`  Day 17 (2025-07-26) within range? ${day17Date >= start && day17Date < end ? 'YES' : 'NO'}`);
    });
  }
} else {
  console.log('❌ Day 17 has no reward pool');
}

console.log('\n✅ Reward bar debugging complete');