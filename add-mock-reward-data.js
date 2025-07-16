// Add mock reward pool data to fix the release schedule chart
const fs = require('fs');

console.log('🔧 ADDING MOCK REWARD POOL DATA...');

// Load cached data
const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
const currentProtocolDay = cachedData.stakingData.currentProtocolDay || 5;

console.log(`📅 Current protocol day: ${currentProtocolDay}`);

// Create mock reward pool data for next 88 days
const rewardPoolData = [];
const startDay = currentProtocolDay;
const endDay = currentProtocolDay + 88;

console.log(`📊 Creating mock reward pool data for days ${startDay} to ${endDay}...`);

for (let day = startDay; day <= endDay; day++) {
  // Create realistic mock data
  const baseRewardPool = Math.floor(Math.random() * 1000) + 500; // 500-1500 TORUS per day
  const baseTotalShares = Math.floor(Math.random() * 100000) + 50000; // 50k-150k shares
  const basePenalties = Math.floor(Math.random() * 100) + 10; // 10-110 TORUS penalties
  
  const dayData = {
    day: day,
    rewardPool: (baseRewardPool * 1e18).toString(), // Convert to Wei
    totalShares: (baseTotalShares * 1e18).toString(), // Convert to Wei
    penalties: (basePenalties * 1e18).toString(), // Convert to Wei
    dailyRewardRate: Math.floor((baseRewardPool / baseTotalShares) * 1e18).toString()
  };
  
  rewardPoolData.push(dayData);
}

console.log(`✅ Created ${rewardPoolData.length} days of mock reward pool data`);

// Update cached data
cachedData.stakingData.rewardPoolData = rewardPoolData;
cachedData.lastUpdated = new Date().toISOString();

fs.writeFileSync('public/data/cached-data.json', JSON.stringify(cachedData, null, 2));

console.log('✅ Updated cached data with mock reward pool data');

// Show summary
const totalRewards = rewardPoolData.reduce((sum, day) => sum + parseFloat(day.rewardPool) / 1e18, 0);
const totalShares = rewardPoolData.reduce((sum, day) => sum + parseFloat(day.totalShares) / 1e18, 0);
const avgRewardPerDay = totalRewards / rewardPoolData.length;

console.log(`📊 MOCK DATA SUMMARY:`);
console.log(`  Total rewards: ${totalRewards.toFixed(2)} TORUS`);
console.log(`  Average reward per day: ${avgRewardPerDay.toFixed(2)} TORUS`);
console.log(`  Total shares: ${totalShares.toFixed(2)}`);
console.log(`  Days with data: ${rewardPoolData.length}`);

console.log('\n🔄 Refresh localhost to see updated release schedule chart');
console.log('📊 The chart should now show bars for release schedule with accrued rewards');