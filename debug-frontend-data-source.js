// Debug what data source the frontend is actually using
const fs = require('fs');

console.log('🔍 DEBUGGING FRONTEND DATA SOURCE...');

// Check the cached data
const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
console.log('📊 CACHED DATA SUMMARY:');
console.log(`  Last updated: ${cachedData.lastUpdated}`);
console.log(`  Stake events: ${cachedData.stakingData.stakeEvents.length}`);
console.log(`  Create events: ${cachedData.stakingData.createEvents.length}`);
console.log(`  Current protocol day: ${cachedData.stakingData.currentProtocolDay}`);

// Check creates ending in next 10 days
const today = new Date();
today.setHours(0, 0, 0, 0);

const CONTRACT_START_DATE = new Date('2025-07-11');
CONTRACT_START_DATE.setHours(0, 0, 0, 0);

const getContractDay = (date) => {
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.floor((date.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1;
  return daysDiff;
};

console.log('\n🔍 CREATES ENDING IN NEXT 10 DAYS FROM CACHED DATA:');
const createEvents = cachedData.stakingData.createEvents;
const next10Days = [];

for (let i = 0; i < 10; i++) {
  const date = new Date(today);
  date.setDate(date.getDate() + i);
  const dateKey = date.toISOString().split('T')[0];
  
  const createsOnDay = createEvents.filter(create => {
    const maturityDate = new Date(create.maturityDate);
    return maturityDate.toISOString().split('T')[0] === dateKey;
  });
  
  const contractDay = getContractDay(date);
  next10Days.push({
    date: dateKey,
    contractDay,
    count: createsOnDay.length,
    creates: createsOnDay.slice(0, 3) // Show first 3 for debugging
  });
}

next10Days.forEach(day => {
  console.log(`  ${day.date} (Day ${day.contractDay}): ${day.count} creates`);
  day.creates.forEach(create => {
    console.log(`    - User: ${create.user.substring(0, 10)}..., TORUS: ${(parseFloat(create.torusAmount) / 1e18).toFixed(2)}`);
  });
});

// Check if localhost might be using different data
console.log('\n🔍 CHECKING IF FRONTEND COULD BE USING DIFFERENT DATA:');

// Check if there are other cached data files
const dataDir = 'public/data/';
const files = fs.readdirSync(dataDir);
console.log('Available data files:');
files.forEach(file => {
  if (file.endsWith('.json')) {
    const stats = fs.statSync(`${dataDir}${file}`);
    console.log(`  ${file} (${Math.round(stats.size / 1024)}KB, modified: ${stats.mtime.toISOString()})`);
  }
});

// Check if the frontend is configured to use cached data
console.log('\n🔍 CHECKING FRONTEND CONFIGURATION:');
console.log('Frontend should be using cached data from public/data/cached-data.json');
console.log('If bar chart shows creates on day 5, possible issues:');
console.log('1. Frontend is not loading from cached JSON');
console.log('2. Frontend is making RPC calls instead of using cache');
console.log('3. There is a bug in the frontend chart processing');
console.log('4. The cached data is not being used correctly');

console.log('\n🎯 SOLUTION: Need to verify frontend is using cached data, not RPC calls');
console.log('Next step: Check App.tsx data loading logic to ensure it uses cached-data.json');