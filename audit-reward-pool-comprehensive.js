const { ethers } = require('ethers');
const fs = require('fs');

console.log('🔍 COMPREHENSIVE TORUS REWARD POOL AUDIT');
console.log('========================================');

// Load cached data
const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));

console.log('\n📊 CACHED DATA OVERVIEW:');
console.log('Current Protocol Day:', cachedData.currentProtocolDay);
console.log('Total Supply:', cachedData.stakingData.totalSupply);
console.log('Reward Pool Data entries:', cachedData.rewardPoolData.length);

// 1. Analyze reward pool data structure
console.log('\n1. REWARD POOL DATA ANALYSIS:');
console.log('============================================');

const rewardPoolData = cachedData.rewardPoolData;
const firstFewDays = rewardPoolData.slice(0, 10);

console.log('First 10 days of reward pool data:');
firstFewDays.forEach((day, index) => {
  console.log(`Day ${day.day}: RewardPool=${day.rewardPool}, TotalShares=${day.totalShares.toFixed(0)}, Penalties=${day.penaltiesInPool}`);
});

// Find days with non-zero reward pools
const nonZeroRewardDays = rewardPoolData.filter(day => day.rewardPool > 0);
console.log(`\nDays with non-zero reward pools: ${nonZeroRewardDays.length}`);
nonZeroRewardDays.forEach(day => {
  console.log(`Day ${day.day}: ${day.rewardPool.toFixed(6)} TORUS`);
});

// Check if reward pool decreases daily
console.log('\n2. REWARD POOL DECREASE PATTERN:');
console.log('============================================');

if (nonZeroRewardDays.length > 1) {
  for (let i = 1; i < nonZeroRewardDays.length; i++) {
    const prev = nonZeroRewardDays[i-1];
    const curr = nonZeroRewardDays[i];
    const decrease = prev.rewardPool - curr.rewardPool;
    const decreasePercent = (decrease / prev.rewardPool) * 100;
    console.log(`Day ${prev.day} to ${curr.day}: ${prev.rewardPool.toFixed(6)} → ${curr.rewardPool.toFixed(6)} (${decrease.toFixed(6)} decrease, ${decreasePercent.toFixed(3)}%)`);
  }
}

// 3. Check for missing days 1-7
console.log('\n3. MISSING DAYS CHECK:');
console.log('============================================');

const currentDay = cachedData.currentProtocolDay;
const expectedDays = Array.from({length: 89}, (_, i) => currentDay + i);
const actualDays = rewardPoolData.map(d => d.day);

console.log(`Expected days: ${currentDay} to ${currentDay + 88}`);
console.log(`First actual day: ${Math.min(...actualDays)}`);
console.log(`Last actual day: ${Math.max(...actualDays)}`);

const missingDays = expectedDays.filter(day => !actualDays.includes(day));
if (missingDays.length > 0) {
  console.log(`Missing days: ${missingDays.join(', ')}`);
} else {
  console.log('No missing days found');
}

// Check for days 1-7 specifically
const earlyDays = [1, 2, 3, 4, 5, 6, 7];
const missingEarlyDays = earlyDays.filter(day => !actualDays.includes(day));
if (missingEarlyDays.length > 0) {
  console.log(`Missing early days (1-7): ${missingEarlyDays.join(', ')}`);
} else {
  console.log('Days 1-7 are present in the data');
}

// 4. Supply Analysis
console.log('\n4. SUPPLY ANALYSIS:');
console.log('============================================');

const stakeEvents = cachedData.stakingData.stakeEvents;
const createEvents = cachedData.stakingData.createEvents;

console.log(`Stake events: ${stakeEvents.length}`);
console.log(`Create events: ${createEvents.length}`);

// Calculate total TORUS from creates (what should be minted on maturity)
let totalTorusFromCreates = 0;
createEvents.forEach(event => {
  if (event.torusAmount) {
    totalTorusFromCreates += parseFloat(event.torusAmount) / 1e18;
  }
});

console.log(`Total TORUS from creates: ${totalTorusFromCreates.toFixed(2)} TORUS`);
console.log(`Current supply: ${cachedData.stakingData.totalSupply.toFixed(2)} TORUS`);
console.log(`Potential max supply (current + creates): ${(cachedData.stakingData.totalSupply + totalTorusFromCreates).toFixed(2)} TORUS`);

// 5. Analyze what "creates supply" means
console.log('\n5. CREATE EVENTS ANALYSIS:');
console.log('============================================');

const createEventsWithTorus = createEvents.filter(event => event.torusAmount && parseFloat(event.torusAmount) > 0);
console.log(`Create events with TORUS amount: ${createEventsWithTorus.length}`);

createEventsWithTorus.slice(0, 5).forEach(event => {
  const torusAmount = parseFloat(event.torusAmount) / 1e18;
  const maturityDate = new Date(event.maturityDate);
  console.log(`  User: ${event.user.substring(0, 10)}..., TORUS: ${torusAmount.toFixed(2)}, Maturity: ${maturityDate.toDateString()}`);
});

// 6. Check contract start date and protocol day relationship
console.log('\n6. PROTOCOL DAY CALCULATION:');
console.log('============================================');

// Protocol started around July 11, 2025
const protocolStart = new Date('2025-07-11T00:00:00Z');
const now = new Date();
const daysSinceStart = Math.floor((now - protocolStart) / (24 * 60 * 60 * 1000));

console.log(`Protocol start date: ${protocolStart.toDateString()}`);
console.log(`Current date: ${now.toDateString()}`);
console.log(`Days since start: ${daysSinceStart}`);
console.log(`Current protocol day from cache: ${cachedData.currentProtocolDay}`);

// 7. Chart data implications
console.log('\n7. CHART DATA IMPLICATIONS:');
console.log('============================================');

const chartData = cachedData.chartData;
if (chartData && chartData.titanXUsageByEndDate) {
  console.log(`TitanX usage chart points: ${chartData.titanXUsageByEndDate.length}`);
  
  const firstPoint = chartData.titanXUsageByEndDate[0];
  const lastPoint = chartData.titanXUsageByEndDate[chartData.titanXUsageByEndDate.length - 1];
  
  if (firstPoint) {
    console.log(`First chart point: ${firstPoint.date}, ${firstPoint.displayAmount}`);
  }
  if (lastPoint) {
    console.log(`Last chart point: ${lastPoint.date}, ${lastPoint.displayAmount}`);
  }
}

// 8. Contract mechanics verification
console.log('\n8. CONTRACT MECHANICS VERIFICATION:');
console.log('============================================');

// Check if reward pool should start at 100k
const firstRewardDay = nonZeroRewardDays[0];
if (firstRewardDay) {
  console.log(`First reward pool value: ${firstRewardDay.rewardPool.toFixed(6)} TORUS on day ${firstRewardDay.day}`);
  
  // Check if it's close to 100k
  if (firstRewardDay.rewardPool > 90000 && firstRewardDay.rewardPool < 110000) {
    console.log('✅ First reward pool is close to 100k TORUS');
  } else {
    console.log('❌ First reward pool is not close to 100k TORUS');
  }
}

// Check if total shares make sense
const totalSharesValues = rewardPoolData.map(d => d.totalShares);
const uniqueShares = [...new Set(totalSharesValues)];
console.log(`Unique total shares values: ${uniqueShares.length}`);
console.log(`Total shares range: ${Math.min(...totalSharesValues).toFixed(0)} to ${Math.max(...totalSharesValues).toFixed(0)}`);

// 9. Data inconsistencies
console.log('\n9. DATA INCONSISTENCIES:');
console.log('============================================');

let inconsistencies = [];

// Check for negative values
rewardPoolData.forEach(day => {
  if (day.rewardPool < 0) {
    inconsistencies.push(`Day ${day.day}: Negative reward pool ${day.rewardPool}`);
  }
  if (day.totalShares < 0) {
    inconsistencies.push(`Day ${day.day}: Negative total shares ${day.totalShares}`);
  }
});

// Check for increasing reward pool (should only decrease)
for (let i = 1; i < rewardPoolData.length; i++) {
  const prev = rewardPoolData[i-1];
  const curr = rewardPoolData[i];
  
  if (curr.rewardPool > prev.rewardPool && curr.rewardPool > 0 && prev.rewardPool > 0) {
    inconsistencies.push(`Day ${prev.day} to ${curr.day}: Reward pool increased from ${prev.rewardPool} to ${curr.rewardPool}`);
  }
}

if (inconsistencies.length > 0) {
  console.log('Found inconsistencies:');
  inconsistencies.forEach(issue => console.log(`  ❌ ${issue}`));
} else {
  console.log('✅ No major data inconsistencies found');
}

// 10. Summary and recommendations
console.log('\n10. SUMMARY AND RECOMMENDATIONS:');
console.log('============================================');

console.log('Key Findings:');
console.log(`- Current protocol day: ${cachedData.currentProtocolDay}`);
console.log(`- Days with rewards: ${nonZeroRewardDays.length}`);
console.log(`- Current supply: ${cachedData.stakingData.totalSupply.toFixed(2)} TORUS`);
console.log(`- Potential creates supply: ${totalTorusFromCreates.toFixed(2)} TORUS`);
console.log(`- Data inconsistencies: ${inconsistencies.length}`);

console.log('\nRecommendations:');
if (nonZeroRewardDays.length === 0) {
  console.log('❌ No reward pool data found - this is the main issue');
}
if (missingEarlyDays.length > 0) {
  console.log(`❌ Missing early protocol days: ${missingEarlyDays.join(', ')}`);
}
if (firstRewardDay && firstRewardDay.rewardPool < 90000) {
  console.log('❌ First reward pool is not ~100k TORUS as expected');
}

console.log('\n📋 AUDIT COMPLETE');