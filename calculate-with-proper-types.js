const fs = require('fs');
const path = require('path');

// Load cached data
const cachedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data', 'cached-data.json'), 'utf8'));

console.log('\n================================================');
console.log('📊 CALCULATING WITH PROPER TYPE DETECTION');
console.log('================================================\n');

const contractStartDate = new Date('2025-07-10T18:00:00Z');
const currentProtocolDay = 29;
const currentSupply = parseFloat(cachedData.currentSupply || 18444);

// Combine all positions with proper type field
const allPositions = [
  ...cachedData.stakingData.stakeEvents.map(s => ({...s, type: 'stake'})),
  ...cachedData.stakingData.createEvents.map(c => ({...c, type: 'create'}))
];

console.log(`Total positions: ${allPositions.length}`);
console.log(`Stakes: ${cachedData.stakingData.stakeEvents.length}`);
console.log(`Creates: ${cachedData.stakingData.createEvents.length}\n`);

// Calculate totals
let totalNewTokens = 0;
let totalPrincipal = 0;
let totalRewards = 0;
let positionsMaturing = 0;

allPositions.forEach(position => {
  const maturityDate = new Date(position.maturityDate);
  const maturityDay = Math.floor((maturityDate.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  
  // Only count positions maturing on or after current day
  if (maturityDay >= currentProtocolDay && maturityDay <= 117) {
    positionsMaturing++;
    
    // Add principal or new tokens
    if (position.type === 'stake' && position.principal) {
      totalPrincipal += parseFloat(position.principal) / 1e18;
    } else if (position.type === 'create' && position.torusAmount) {
      totalNewTokens += parseFloat(position.torusAmount) / 1e18;
    }
    
    // Calculate rewards (from day 29 forward only)
    const shares = parseFloat(position.shares) / 1e18;
    const startTime = new Date(parseInt(position.timestamp) * 1000);
    const startDay = Math.floor((startTime.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    
    for (let day = Math.max(startDay, currentProtocolDay); day < maturityDay; day++) {
      const dayData = cachedData.stakingData.rewardPoolData.find(d => d.day === day);
      if (dayData) {
        const totalShares = parseFloat(dayData.totalShares);
        const rewardPool = parseFloat(dayData.rewardPool);
        
        if (totalShares > 0) {
          totalRewards += (shares / totalShares) * rewardPool;
        }
      }
    }
  }
});

console.log('CORRECT CALCULATION:');
console.log('===================');
console.log(`Positions maturing (days ${currentProtocolDay}-117): ${positionsMaturing}`);
console.log(`Current Supply: ${(currentSupply/1000).toFixed(2)}K TORUS`);
console.log(`Principal (from stakes): ${(totalPrincipal/1000).toFixed(2)}K TORUS`);
console.log(`New Tokens (from creates): ${(totalNewTokens/1000).toFixed(2)}K TORUS`);
console.log(`Accumulated Rewards: ${(totalRewards/1e6).toFixed(3)}M TORUS`);
console.log('');

const projectedSupply = currentSupply + totalPrincipal + totalNewTokens + totalRewards;

console.log(`TOTAL MAX SUPPLY: ${(projectedSupply/1e6).toFixed(3)}M TORUS`);
console.log('');

if (Math.abs(projectedSupply - 2.75e6) < 100000) {
  console.log('✅ THIS IS CORRECT! ~2.75M TORUS expected');
} else {
  console.log(`🤔 This gives ${(projectedSupply/1e6).toFixed(2)}M vs chart showing 11.46M`);
  console.log('There must be another issue in the frontend calculation.');
}

// Check day-by-day progression
console.log('\n================================================');
console.log('DAY-BY-DAY MAX SUPPLY PROGRESSION');
console.log('================================================\n');

let runningSupply = currentSupply;

for (let day = currentProtocolDay; day <= 117; day++) {
  let dayNewTokens = 0;
  let dayPrincipal = 0;
  let dayRewards = 0;
  
  allPositions.forEach(position => {
    const maturityDate = new Date(position.maturityDate);
    const maturityDay = Math.floor((maturityDate.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    
    if (maturityDay === day) {
      // Add principal or new tokens
      if (position.type === 'stake' && position.principal) {
        dayPrincipal += parseFloat(position.principal) / 1e18;
      } else if (position.type === 'create' && position.torusAmount) {
        dayNewTokens += parseFloat(position.torusAmount) / 1e18;
      }
      
      // Calculate lifetime rewards
      const shares = parseFloat(position.shares) / 1e18;
      const startTime = new Date(parseInt(position.timestamp) * 1000);
      const startDay = Math.floor((startTime.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      
      for (let d = Math.max(startDay, currentProtocolDay); d < maturityDay; d++) {
        const dayData = cachedData.stakingData.rewardPoolData.find(dd => dd.day === d);
        if (dayData) {
          const totalShares = parseFloat(dayData.totalShares);
          const rewardPool = parseFloat(dayData.rewardPool);
          
          if (totalShares > 0) {
            dayRewards += (shares / totalShares) * rewardPool;
          }
        }
      }
    }
  });
  
  const dayTotal = dayNewTokens + dayPrincipal + dayRewards;
  runningSupply += dayTotal;
  
  if (day <= 35 || (day >= 110 && day <= 117) || day === 88) {
    console.log(`Day ${day}: ${(runningSupply/1e6).toFixed(3)}M (+${(dayTotal/1000).toFixed(1)}K)`);
  }
}