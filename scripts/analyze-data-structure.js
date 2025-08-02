const fs = require('fs');

// Check all data files
const dataFiles = [
  './public/data/cached-data.json',
  './public/data/cached-data-complete.json',
  './public/data/buy-process-data.json'
];

console.log('=== ANALYZING DATA STRUCTURE ===\n');

// Check cached-data.json
const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json'));
console.log('cached-data.json:');
console.log('- Top level keys:', Object.keys(cachedData));
console.log('- stakingData keys:', Object.keys(cachedData.stakingData || {}));
console.log('- Total creates:', cachedData.stakingData?.createEvents?.length || 0);
console.log('- Creates with titanAmount > 0:', cachedData.stakingData?.createEvents?.filter(c => c.titanAmount && c.titanAmount !== '0').length || 0);
console.log('- Creates with eventId:', cachedData.stakingData?.createEvents?.filter(c => c.eventId).length || 0);

// Check if there's aggregated daily data somewhere
if (cachedData.dailyStakingData) {
  console.log('- dailyStakingData exists! Length:', cachedData.dailyStakingData.length);
  const day21 = cachedData.dailyStakingData.find(d => d.protocolDay === 21);
  console.log('- Day 21 in dailyStakingData:', day21);
}

// Check staking section
if (cachedData.staking) {
  console.log('\n- staking section exists!');
  console.log('  Keys:', Object.keys(cachedData.staking));
}

// Check aggregated data
if (cachedData.aggregatedData) {
  console.log('\n- aggregatedData exists!');
  console.log('  Keys:', Object.keys(cachedData.aggregatedData));
}

// Check for daily data anywhere
for (const key of Object.keys(cachedData)) {
  if (key.toLowerCase().includes('daily') || key.toLowerCase().includes('day')) {
    console.log(`\n- Found ${key}:`, typeof cachedData[key], Array.isArray(cachedData[key]) ? `array[${cachedData[key].length}]` : '');
  }
}