#!/usr/bin/env node

/**
 * Fix maturity dates in cached-data.json
 * Converts incorrect 1978 dates to proper 2025 dates
 */

const fs = require('fs');
const path = require('path');

// Contract launch date - this is the base for all timestamps
const CONTRACT_START_DATE = new Date('2025-07-10T00:00:00Z');
const SECONDS_PER_DAY = 86400;

console.log('🔧 FIXING MATURITY DATES IN CACHED DATA...\n');

// Load cached data
const cachedDataPath = path.join(__dirname, 'public/data/cached-data.json');
const cachedData = JSON.parse(fs.readFileSync(cachedDataPath, 'utf8'));

console.log('📊 Current data status:');
console.log(`  - Stakes: ${cachedData.stakingData.stakeEvents.length}`);
console.log(`  - Creates: ${cachedData.stakingData.createEvents.length}`);

// Sample current dates
if (cachedData.stakingData.stakeEvents.length > 0) {
  const firstStake = cachedData.stakingData.stakeEvents[0];
  console.log(`\n❌ Current first stake maturity: ${firstStake.maturityDate}`);
  console.log(`   Timestamp: ${firstStake.timestamp}`);
  console.log(`   Staking days: ${firstStake.stakingDays}`);
}

// Fix function to convert protocol timestamp to proper date
function fixMaturityDate(event, isStake = true) {
  // The timestamp appears to be seconds since contract start
  const startTimeInSeconds = parseInt(event.timestamp);
  const stakingDays = parseInt(event.stakingDays || event.duration || 0);
  
  // Calculate the actual start date
  const startDate = new Date(CONTRACT_START_DATE.getTime() + (startTimeInSeconds * 1000));
  
  // Calculate maturity date
  const maturityDate = new Date(startDate.getTime() + (stakingDays * SECONDS_PER_DAY * 1000));
  
  return {
    ...event,
    maturityDate: maturityDate.toISOString(),
    // Also store the calculated start date for verification
    calculatedStartDate: startDate.toISOString()
  };
}

// Fix stake events
console.log('\n🔄 Fixing stake maturity dates...');
let fixedStakes = 0;
cachedData.stakingData.stakeEvents = cachedData.stakingData.stakeEvents.map(stake => {
  const fixed = fixMaturityDate(stake, true);
  if (fixed.maturityDate !== stake.maturityDate) {
    fixedStakes++;
  }
  return fixed;
});

// Fix create events
console.log('🔄 Fixing create maturity dates...');
let fixedCreates = 0;
cachedData.stakingData.createEvents = cachedData.stakingData.createEvents.map(create => {
  const fixed = fixMaturityDate(create, false);
  if (fixed.maturityDate !== create.maturityDate) {
    fixedCreates++;
  }
  return fixed;
});

// Update last updated timestamp
cachedData.lastUpdated = new Date().toISOString();
cachedData.stakingData.lastUpdated = new Date().toISOString();

// Save the fixed data
console.log('\n💾 Saving fixed data...');
fs.writeFileSync(cachedDataPath, JSON.stringify(cachedData, null, 2));

// Verify the fix
if (cachedData.stakingData.stakeEvents.length > 0) {
  const firstStake = cachedData.stakingData.stakeEvents[0];
  console.log(`\n✅ Fixed first stake maturity: ${firstStake.maturityDate}`);
  console.log(`   Start date: ${firstStake.calculatedStartDate}`);
}

// Count active stakes (maturity date > now)
const now = new Date();
const activeStakes = cachedData.stakingData.stakeEvents.filter(stake => 
  new Date(stake.maturityDate) > now
).length;

const activeCreates = cachedData.stakingData.createEvents.filter(create => 
  new Date(create.maturityDate) > now
).length;

console.log('\n📊 Summary:');
console.log(`  - Fixed ${fixedStakes} stake maturity dates`);
console.log(`  - Fixed ${fixedCreates} create maturity dates`);
console.log(`  - Active stakes: ${activeStakes}`);
console.log(`  - Active creates: ${activeCreates}`);

// Show distribution of stake end days
const stakeEndDays = {};
cachedData.stakingData.stakeEvents.forEach(stake => {
  if (new Date(stake.maturityDate) > now) {
    const daysUntilEnd = Math.ceil((new Date(stake.maturityDate) - now) / (1000 * 60 * 60 * 24));
    stakeEndDays[daysUntilEnd] = (stakeEndDays[daysUntilEnd] || 0) + 1;
  }
});

console.log('\n📊 Stake end days distribution:');
Object.keys(stakeEndDays).sort((a, b) => a - b).forEach(day => {
  console.log(`  Day ${day}: ${stakeEndDays[day]} stakes`);
});

console.log('\n✅ Maturity dates fixed successfully!');