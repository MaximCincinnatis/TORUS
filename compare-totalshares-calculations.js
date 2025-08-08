const fs = require('fs');
const path = require('path');

// Load cached data
const cachedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data', 'cached-data.json'), 'utf8'));

console.log('\n================================================');
console.log('🔍 COMPARING TOTALSHARES CALCULATIONS');
console.log('================================================\n');

const contractStartDate = new Date('2025-07-10T18:00:00Z');

// Sample some critical days
const checkDays = [1, 10, 29, 88, 110, 111, 112, 113, 114, 115, 116, 117];

console.log('COMPARING: rewardPoolData.totalShares vs Frontend Recalculation\n');

for (const day of checkDays) {
  // Get totalShares from rewardPoolData (what we fixed)
  const dayData = cachedData.stakingData.rewardPoolData.find(d => d.day === day);
  const rewardPoolTotalShares = dayData ? parseFloat(dayData.totalShares) : 0;
  
  // Recalculate like the frontend does
  let frontendTotalShares = 0;
  const positions = [...cachedData.stakingData.stakeEvents, ...cachedData.stakingData.createEvents];
  
  positions.forEach(position => {
    const positionStart = new Date(parseInt(position.timestamp) * 1000);
    const positionStartDay = Math.floor((positionStart.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const maturityDate = new Date(position.maturityDate);
    const maturityDay = Math.floor((maturityDate.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    
    // Position is active if it started before or on this day and hasn't matured yet
    if (day >= positionStartDay && day < maturityDay) {
      frontendTotalShares += parseFloat(position.shares) / 1e18;
    }
  });
  
  const match = Math.abs(rewardPoolTotalShares - frontendTotalShares) < 1000; // Within 1000 shares
  
  console.log(`Day ${day}:`);
  console.log(`  RewardPoolData: ${(rewardPoolTotalShares/1e6).toFixed(2)}M shares`);
  console.log(`  Frontend Calc:  ${(frontendTotalShares/1e6).toFixed(2)}M shares`);
  console.log(`  Status: ${match ? '✅ MATCH' : '❌ MISMATCH!'}`);
  
  if (!match) {
    const diff = frontendTotalShares - rewardPoolTotalShares;
    console.log(`  Difference: ${(diff/1e6).toFixed(2)}M shares`);
  }
  console.log('');
}

console.log('🎯 KEY INSIGHT:');
console.log('==============');
console.log('If these match, then the frontend is correctly calculating totalShares.');
console.log('If they don\'t match, we need to understand why.');
console.log('');
console.log('The frontend IGNORES rewardPoolData.totalShares and recalculates from positions.');
console.log('This is actually GOOD because it ensures accuracy based on actual positions.');