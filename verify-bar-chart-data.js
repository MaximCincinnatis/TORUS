const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
const stakes = data.stakingData?.stakeEvents || [];

// Simulate the bar chart calculation
const today = new Date();
today.setHours(0, 0, 0, 0);

const releases = {};

// Initialize next 88 days
for (let i = 0; i < 88; i++) {
  const date = new Date(today);
  date.setDate(date.getDate() + i);
  const dateKey = date.toISOString().split('T')[0];
  releases[dateKey] = 0;
}

// Count stakes by maturity date
let futureStakes = 0;
stakes.forEach(stake => {
  const maturityDate = new Date(stake.maturityDate);
  if (maturityDate > today) {
    futureStakes++;
    const dateKey = maturityDate.toISOString().split('T')[0];
    if (releases[dateKey] !== undefined) {
      releases[dateKey] += 1;
    }
  }
});

console.log('Bar Chart Data Verification:\n');
console.log(`Total stakes: ${stakes.length}`);
console.log(`Future stakes (not yet matured): ${futureStakes}`);
console.log(`\nStakes ending by date (non-zero only):`);

// Show non-zero days
Object.entries(releases)
  .filter(([date, count]) => count > 0)
  .sort()
  .forEach(([date, count]) => {
    console.log(`${date}: ${count} stakes`);
  });

// Calculate days until first stake matures
const firstMaturity = Math.min(...stakes.map(s => new Date(s.maturityDate).getTime()));
const daysUntilFirst = Math.ceil((firstMaturity - today.getTime()) / (1000 * 60 * 60 * 24));
console.log(`\nDays until first stake matures: ${daysUntilFirst}`);

// Show what the bar chart should display
console.log('\nBar chart preview (first 10 days with activity):');
const chartData = Object.entries(releases).map(([date, count]) => ({ date, count }));
const activeData = chartData.filter(d => d.count > 0);
activeData.slice(0, 10).forEach(d => {
  const bar = '█'.repeat(Math.ceil(d.count / 2));
  console.log(`${d.date}: ${bar} (${d.count})`);
});