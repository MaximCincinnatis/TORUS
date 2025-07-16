const data = require('./public/data/cached-data.json');
const stakes = data.stakingData?.stakeEvents || [];

console.log('=== STAKE END DAYS AUDIT ===');
const today = new Date();
today.setHours(0, 0, 0, 0);

console.log('Today:', today.toISOString().split('T')[0]);
console.log('Total stakes:', stakes.length);

// Check distribution of stake end dates
const endDateDistribution = {};
for (let i = 0; i < 90; i++) {
  const date = new Date(today);
  date.setDate(date.getDate() + i);
  const dateKey = date.toISOString().split('T')[0];
  endDateDistribution[dateKey] = 0;
}

stakes.forEach(stake => {
  const maturityDate = new Date(stake.maturityDate);
  const dateKey = maturityDate.toISOString().split('T')[0];
  
  if (endDateDistribution[dateKey] !== undefined) {
    endDateDistribution[dateKey]++;
  }
});

// Show first 90 days with counts
console.log('\n=== FIRST 90 DAYS STAKE END COUNTS ===');
Object.entries(endDateDistribution).forEach(([date, count], index) => {
  if (count > 0) {
    console.log(`Day ${index + 1} (${date}): ${count} stakes`);
  }
});

// Count stakes by day ranges
const first30 = Object.entries(endDateDistribution).slice(0, 30).reduce((sum, [_, count]) => sum + count, 0);
const day31to60 = Object.entries(endDateDistribution).slice(30, 60).reduce((sum, [_, count]) => sum + count, 0);
const day61to90 = Object.entries(endDateDistribution).slice(60, 90).reduce((sum, [_, count]) => sum + count, 0);

console.log('\n=== STAKE DISTRIBUTION BY RANGES ===');
console.log(`Days 1-30: ${first30} stakes`);
console.log(`Days 31-60: ${day31to60} stakes`);
console.log(`Days 61-90: ${day61to90} stakes`);