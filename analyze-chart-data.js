const data = require('./public/data/cached-data.json');
const stakes = data.stakingData?.stakeEvents || [];

console.log('=== CHART DATA ANALYSIS ===');

// Replicate the logic from App.tsx
const today = new Date();
today.setHours(0, 0, 0, 0);

const CONTRACT_START_DATE = new Date('2025-07-11');
CONTRACT_START_DATE.setHours(0, 0, 0, 0);

// Calculate contract day for a given date
const getContractDay = (date) => {
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.floor((date.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1;
  return daysDiff;
};

// Initialize chart data (88 days)
const releases = {};
for (let i = 0; i < 88; i++) {
  const date = new Date(today);
  date.setDate(date.getDate() + i);
  const dateKey = date.toISOString().split('T')[0];
  releases[dateKey] = 0;
}

// Count stakes maturing on each day
stakes.forEach(stake => {
  const maturityDate = new Date(stake.maturityDate);
  if (maturityDate > today) {
    const dateKey = maturityDate.toISOString().split('T')[0];
    if (releases[dateKey] !== undefined) {
      releases[dateKey] += 1;
    }
  }
});

// Convert to chart format
const chartData = Object.entries(releases).map(([date, count]) => ({
  date,
  count,
  contractDay: getContractDay(new Date(date)),
  dayFromToday: Math.floor((new Date(date).getTime() - today.getTime()) / (24 * 60 * 60 * 1000)) + 1
}));

console.log('Today:', today.toISOString().split('T')[0]);
console.log('Contract start:', CONTRACT_START_DATE.toISOString().split('T')[0]);
console.log('Today is contract day:', getContractDay(today));
console.log('');

// Show chart data with stakes
console.log('=== CHART DATA (Stakes > 0) ===');
chartData.forEach(entry => {
  if (entry.count > 0) {
    console.log(`Day ${entry.dayFromToday} (${entry.date}): ${entry.count} stakes (Contract Day ${entry.contractDay})`);
  }
});

// Show first 10 days of chart
console.log('\n=== FIRST 10 DAYS OF CHART ===');
chartData.slice(0, 10).forEach(entry => {
  console.log(`Day ${entry.dayFromToday} (${entry.date}): ${entry.count} stakes (Contract Day ${entry.contractDay})`);
});

// Show last 10 days of chart
console.log('\n=== LAST 10 DAYS OF CHART ===');
chartData.slice(-10).forEach(entry => {
  console.log(`Day ${entry.dayFromToday} (${entry.date}): ${entry.count} stakes (Contract Day ${entry.contractDay})`);
});

console.log('\n=== SUMMARY ===');
console.log(`Total stakes in chart: ${chartData.reduce((sum, entry) => sum + entry.count, 0)}`);
console.log(`Days with stakes: ${chartData.filter(entry => entry.count > 0).length}`);
console.log(`First day with stakes: Day ${chartData.find(entry => entry.count > 0)?.dayFromToday}`);
console.log(`Last day with stakes: Day ${chartData.slice().reverse().find(entry => entry.count > 0)?.dayFromToday}`);