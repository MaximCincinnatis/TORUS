const data = require('./public/data/cached-data.json');
const creates = data.stakingData?.createEvents || [];

console.log('=== CREATE EVENTS TIMING ANALYSIS ===');

const today = new Date();
today.setHours(0, 0, 0, 0);

console.log('Today:', today.toISOString().split('T')[0]);
console.log('Total creates:', creates.length);

// Check distribution of create end dates
const endDateDistribution = {};
for (let i = 0; i < 90; i++) {
  const date = new Date(today);
  date.setDate(date.getDate() + i);
  const dateKey = date.toISOString().split('T')[0];
  endDateDistribution[dateKey] = 0;
}

creates.forEach(create => {
  const maturityDate = new Date(create.maturityDate);
  const dateKey = maturityDate.toISOString().split('T')[0];
  
  if (endDateDistribution[dateKey] !== undefined) {
    endDateDistribution[dateKey]++;
  }
});

// Show first 90 days with counts
console.log('\n=== FIRST 90 DAYS CREATE END COUNTS ===');
Object.entries(endDateDistribution).forEach(([date, count], index) => {
  if (count > 0) {
    console.log(`Day ${index + 1} (${date}): ${count} creates`);
  }
});

// Count creates by day ranges
const first30 = Object.entries(endDateDistribution).slice(0, 30).reduce((sum, [_, count]) => sum + count, 0);
const day31to60 = Object.entries(endDateDistribution).slice(30, 60).reduce((sum, [_, count]) => sum + count, 0);
const day61to90 = Object.entries(endDateDistribution).slice(60, 90).reduce((sum, [_, count]) => sum + count, 0);

console.log('\n=== CREATE DISTRIBUTION BY RANGES ===');
console.log(`Days 1-30: ${first30} creates`);
console.log(`Days 31-60: ${day31to60} creates`);
console.log(`Days 61-90: ${day61to90} creates`);

// Check for creates ending before day 83
const createsBefore83 = Object.entries(endDateDistribution).slice(0, 82).reduce((sum, [_, count]) => sum + count, 0);
console.log(`\nCreates ending before day 83: ${createsBefore83}`);

// Show some sample creates that end early
console.log('\n=== SAMPLE CREATES ENDING EARLY ===');
creates.slice(0, 10).forEach((create, i) => {
  const maturityDate = new Date(create.maturityDate);
  const daysFromNow = Math.ceil((maturityDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  console.log(`Create ${i}: ends in ${daysFromNow} days (${maturityDate.toISOString().split('T')[0]}), duration: ${create.stakingDays} days`);
});