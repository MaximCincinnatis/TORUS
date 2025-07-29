// Fix to calculate rewards 88 days FORWARD from current day (not stop at day 88)

const fs = require('fs');

const INITIAL_REWARD = 100000;
const DAILY_REDUCTION_RATE = 0.0008;

function fixForward88Days() {
  console.log('🔧 FIXING REWARDS TO SHOW 88 DAYS FORWARD FROM CURRENT DAY');
  console.log('==========================================================');
  
  try {
    // Read current data
    const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
    
    // Backup
    const backupPath = `public/data/cached-data-backup-${Date.now()}.json`;
    fs.writeFileSync(backupPath, JSON.stringify(cachedData, null, 2));
    console.log(`✅ Backup saved to ${backupPath}`);
    
    const currentProtocolDay = cachedData.currentProtocolDay || 19;
    const rewardPoolData = cachedData.stakingData.rewardPoolData || [];
    
    console.log(`Current protocol day: ${currentProtocolDay}`);
    
    // Chart should show current day + 88 days forward
    const maxDay = currentProtocolDay + 88;
    console.log(`Chart should show days 1 to ${maxDay} (current + 88)`);
    
    // Calculate rewards for ALL days up to current + 88
    let currentReward = INITIAL_REWARD;
    let updatedDays = 0;
    
    for (let day = 1; day <= maxDay; day++) {
      // Calculate the reward for this day
      if (day > 1) {
        currentReward = currentReward * (1 - DAILY_REDUCTION_RATE);
      }
      
      // Find or create entry
      const existingIndex = rewardPoolData.findIndex(d => d.day === day);
      
      const dayData = {
        day,
        rewardPool: currentReward, // Rewards continue declining forever
        totalShares: 0, // Will be populated when known
        penaltiesInPool: 0, // Future penalties unknown
        calculated: day > currentProtocolDay, // Mark future days as calculated
        lastUpdated: new Date().toISOString()
      };
      
      if (existingIndex >= 0) {
        // Update if it's a future day or has no reward
        if (day > currentProtocolDay || rewardPoolData[existingIndex].rewardPool === 0) {
          rewardPoolData[existingIndex] = {
            ...rewardPoolData[existingIndex],
            ...dayData
          };
          updatedDays++;
        }
      } else {
        // Add new entry
        rewardPoolData.push(dayData);
        updatedDays++;
      }
      
      // Log some key days
      if (day === 88 || day === 89 || day === 100 || day === maxDay) {
        console.log(`Day ${day}: ${currentReward.toFixed(2)} TORUS`);
      }
    }
    
    // Sort by day
    rewardPoolData.sort((a, b) => a.day - b.day);
    
    // Update cached data
    cachedData.stakingData.rewardPoolData = rewardPoolData;
    cachedData.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync('public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
    
    console.log(`\n✅ Updated ${updatedDays} days`);
    console.log(`✅ Reward data now covers days 1-${maxDay}`);
    
    // Show the progression
    console.log('\n📊 REWARD PROGRESSION:');
    console.log(`Day 1: ${INITIAL_REWARD.toFixed(2)} TORUS`);
    console.log(`Day ${currentProtocolDay} (today): ${rewardPoolData.find(d => d.day === currentProtocolDay)?.rewardPool.toFixed(2)} TORUS`);
    console.log(`Day 88: ${rewardPoolData.find(d => d.day === 88)?.rewardPool.toFixed(2)} TORUS`);
    console.log(`Day 100: ${rewardPoolData.find(d => d.day === 100)?.rewardPool.toFixed(2)} TORUS`);
    console.log(`Day ${maxDay}: ${rewardPoolData.find(d => d.day === maxDay)?.rewardPool.toFixed(2)} TORUS`);
    
    // Calculate total rewards available
    const totalRewards = rewardPoolData.reduce((sum, d) => sum + d.rewardPool, 0);
    console.log(`\nTotal rewards in all pools: ${totalRewards.toFixed(2)} TORUS`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Also fix the reward pool manager to use current + 88
function fixRewardPoolManager() {
  console.log('\n🔧 FIXING REWARD POOL MANAGER...');
  
  const managerPath = 'src/utils/rewardPoolManager.js';
  let managerCode = fs.readFileSync(managerPath, 'utf8');
  
  // Find the line that calculates maxProjectionDay
  const oldLine = 'const maxProjectionDay = Math.min(currentDay + 88, 365);';
  const newLine = 'const maxProjectionDay = currentDay + 88; // Always show 88 days forward';
  
  if (managerCode.includes(oldLine)) {
    managerCode = managerCode.replace(oldLine, newLine);
    fs.writeFileSync(managerPath, managerCode);
    console.log('✅ Updated maxProjectionDay calculation');
  } else {
    console.log('⚠️  Could not find maxProjectionDay line to update');
  }
  
  // Also ensure we don't stop rewards at day 88
  const oldCheck = 'rewardPool: day <= 88 ? lastReward : 0,';
  const newCheck = 'rewardPool: lastReward, // Rewards decline forever';
  
  if (managerCode.includes(oldCheck)) {
    managerCode = managerCode.replace(oldCheck, newCheck);
    fs.writeFileSync(managerPath, managerCode);
    console.log('✅ Removed day 88 reward cutoff');
  }
}

// Run the fixes
fixForward88Days();
fixRewardPoolManager();

console.log('\n📋 SUMMARY:');
console.log('1. Rewards now calculated for current day + 88 days');
console.log('2. Rewards continue declining forever (not stopping at day 88)');
console.log('3. Charts will show proper projections through Day ' + (19 + 88));
console.log('4. Positions maturing after Day 88 will accumulate rewards correctly');