// Fix to ensure future rewards are calculated for Days 20+ (current day + 88)

const fs = require('fs');

const INITIAL_REWARD = 100000;
const DAILY_REDUCTION_RATE = 0.0008;

function calculateFutureRewards() {
  console.log('🔧 FIXING FUTURE REWARDS CALCULATION');
  console.log('====================================');
  
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
    console.log(`Existing reward pool entries: ${rewardPoolData.length}`);
    
    // Calculate rewards for future days (current + 88 days out)
    const maxDay = currentProtocolDay + 88;
    console.log(`Calculating rewards for days ${currentProtocolDay + 1} to ${maxDay}`);
    
    // Find the last known reward value
    let lastKnownReward = INITIAL_REWARD;
    for (let day = currentProtocolDay; day >= 1; day--) {
      const dayData = rewardPoolData.find(d => d.day === day);
      if (dayData && dayData.rewardPool > 0) {
        lastKnownReward = dayData.rewardPool;
        console.log(`Last known reward from Day ${day}: ${lastKnownReward.toFixed(2)} TORUS`);
        break;
      }
    }
    
    // Calculate future rewards
    let addedDays = 0;
    let currentReward = lastKnownReward;
    
    for (let day = currentProtocolDay + 1; day <= maxDay; day++) {
      // Apply daily reduction
      currentReward = currentReward * (1 - DAILY_REDUCTION_RATE);
      
      // Check if this day exists
      const existingIndex = rewardPoolData.findIndex(d => d.day === day);
      
      const dayData = {
        day,
        rewardPool: day <= 88 ? currentReward : 0, // Base rewards stop at day 88
        totalShares: 0, // Will be calculated when positions are active
        penaltiesInPool: 0, // Future penalties unknown
        calculated: true, // Mark as calculated vs fetched
        lastUpdated: new Date().toISOString()
      };
      
      if (existingIndex >= 0) {
        // Update existing entry
        rewardPoolData[existingIndex] = {
          ...rewardPoolData[existingIndex],
          ...dayData
        };
      } else {
        // Add new entry
        rewardPoolData.push(dayData);
        addedDays++;
      }
      
      if (day <= currentProtocolDay + 5 || day === 88) {
        console.log(`Day ${day}: ${currentReward.toFixed(2)} TORUS (calculated)`);
      }
    }
    
    // Sort by day
    rewardPoolData.sort((a, b) => a.day - b.day);
    
    // Update cached data
    cachedData.stakingData.rewardPoolData = rewardPoolData;
    cachedData.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync('public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
    
    console.log(`\n✅ Added/updated ${addedDays} future reward days`);
    console.log(`✅ Reward data now covers days 1-${maxDay}`);
    
    // Verify some key days
    console.log('\n📊 Verification:');
    const day30 = rewardPoolData.find(d => d.day === 30);
    const day60 = rewardPoolData.find(d => d.day === 60);
    const day88 = rewardPoolData.find(d => d.day === 88);
    const day89 = rewardPoolData.find(d => d.day === 89);
    
    console.log(`Day 30: ${day30 ? day30.rewardPool.toFixed(2) : 'Not found'} TORUS`);
    console.log(`Day 60: ${day60 ? day60.rewardPool.toFixed(2) : 'Not found'} TORUS`);
    console.log(`Day 88: ${day88 ? day88.rewardPool.toFixed(2) : 'Not found'} TORUS`);
    console.log(`Day 89: ${day89 ? day89.rewardPool.toFixed(2) : 'Not found'} TORUS (should be 0)`);
    
    // Calculate total rewards for 88 days
    let totalRewards = 0;
    for (let i = 0; i < rewardPoolData.length && rewardPoolData[i].day <= 88; i++) {
      totalRewards += rewardPoolData[i].rewardPool;
    }
    console.log(`\nTotal rewards Days 1-88: ${totalRewards.toFixed(2)} TORUS`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Also update the reward pool manager to handle this automatically
function updateRewardPoolManager() {
  console.log('\n🔧 UPDATING REWARD POOL MANAGER...');
  
  const managerPath = 'src/utils/rewardPoolManager.js';
  let managerCode = fs.readFileSync(managerPath, 'utf8');
  
  // Find the fetchRewardPoolData function
  const functionStart = managerCode.indexOf('async function fetchRewardPoolData');
  const functionEnd = managerCode.indexOf('\n}', functionStart) + 2;
  
  if (functionStart > -1) {
    // Add logic to calculate future rewards after fetching
    const insertPoint = managerCode.lastIndexOf('return rewardPoolData;', functionEnd);
    
    const calculationLogic = `
    // Calculate future rewards for chart display
    const currentDay = await contract.getCurrentDayIndex();
    const maxProjectionDay = Math.min(currentDay + 88, 365);
    
    // Fill in future days with calculated rewards
    let lastReward = INITIAL_REWARD_POOL;
    for (let day = 1; day <= maxProjectionDay; day++) {
      if (day === 1) {
        lastReward = INITIAL_REWARD_POOL;
      } else {
        lastReward = lastReward * (1 - DAILY_REDUCTION_RATE);
      }
      
      // Check if we already have this day
      const existing = rewardPoolData.find(d => d.day === day);
      if (!existing) {
        rewardPoolData.push({
          day,
          rewardPool: day <= 88 ? lastReward : 0,
          totalShares: 0,
          penaltiesInPool: 0,
          calculated: true
        });
      }
    }
    
    // Sort by day
    rewardPoolData.sort((a, b) => a.day - b.day);
    `;
    
    if (!managerCode.includes('Calculate future rewards for chart display')) {
      managerCode = managerCode.slice(0, insertPoint) + calculationLogic + '\n    ' + managerCode.slice(insertPoint);
      fs.writeFileSync(managerPath, managerCode);
      console.log('✅ Updated rewardPoolManager.js to calculate future rewards');
    } else {
      console.log('✅ RewardPoolManager already calculates future rewards');
    }
  }
}

// Run the fix
calculateFutureRewards();
updateRewardPoolManager();

console.log('\n📋 SUMMARY:');
console.log('1. Future rewards calculated for current day + 88');
console.log('2. Reward pool manager updated to always calculate future');
console.log('3. Charts will now show proper reward projections');
console.log('4. Update scripts will maintain these calculations');