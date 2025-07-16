const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
const stakes = data.stakingData?.stakeEvents || [];

console.log('🔍 Auditing Stake End Date Calculations\n');

// Check if we have endTime or need to calculate it
const samplesWithEndTime = stakes.filter(s => s.endTime).length;
console.log(`Stakes with endTime field: ${samplesWithEndTime}/${stakes.length}`);

// Analyze the first few stakes
console.log('\n=== ANALYZING STAKE TIMESTAMPS ===');
stakes.slice(0, 10).forEach((stake, i) => {
  const timestamp = parseInt(stake.timestamp);
  const duration = parseInt(stake.duration || stake.stakingDays);
  
  // Current calculation (assuming 86400 seconds per day)
  const currentCalc = timestamp + (duration * 86400);
  const currentDate = new Date(currentCalc * 1000);
  
  // What if CREATE_CYCLE_DURATION is different?
  // Let's try common values
  const oneHour = 3600;
  const sixHours = 21600;
  const twelveHours = 43200;
  const oneDay = 86400;
  
  console.log(`\nStake ${i}:`);
  console.log(`  Timestamp: ${timestamp} (${new Date(timestamp * 1000).toISOString()})`);
  console.log(`  Duration: ${duration} days`);
  console.log(`  Current calc (86400s): ${currentDate.toISOString()}`);
  console.log(`  If 1h cycle: ${new Date((timestamp + duration * oneHour) * 1000).toISOString()}`);
  console.log(`  If 6h cycle: ${new Date((timestamp + duration * sixHours) * 1000).toISOString()}`);
  console.log(`  If 12h cycle: ${new Date((timestamp + duration * twelveHours) * 1000).toISOString()}`);
  
  if (stake.endTime) {
    const endTime = parseInt(stake.endTime);
    const endDate = new Date(endTime * 1000);
    console.log(`  Actual endTime: ${endDate.toISOString()}`);
    
    // Reverse engineer CREATE_CYCLE_DURATION
    const cycleDuration = (endTime - timestamp) / duration;
    console.log(`  Calculated cycle duration: ${cycleDuration} seconds (${cycleDuration/3600} hours)`);
  }
  
  if (stake.maturityDate) {
    console.log(`  Stored maturityDate: ${stake.maturityDate}`);
  }
});

// Check if we have any stakes ending soon
const now = Math.floor(Date.now() / 1000);
const today = new Date();
today.setHours(0, 0, 0, 0);

console.log('\n=== CHECKING FOR STAKES ENDING SOON ===');
console.log(`Current timestamp: ${now}`);
console.log(`Today: ${today.toISOString()}`);

// Group stakes by calculated end dates (using different cycle durations)
const endDates = {
  '1day': {},
  '6hour': {},
  '12hour': {},
  '1hour': {}
};

stakes.forEach(stake => {
  const timestamp = parseInt(stake.timestamp);
  const duration = parseInt(stake.duration || stake.stakingDays);
  
  // Calculate end dates with different cycle durations
  const end1day = timestamp + (duration * 86400);
  const end6hour = timestamp + (duration * 21600);
  const end12hour = timestamp + (duration * 43200);
  const end1hour = timestamp + (duration * 3600);
  
  const date1day = new Date(end1day * 1000).toISOString().split('T')[0];
  const date6hour = new Date(end6hour * 1000).toISOString().split('T')[0];
  const date12hour = new Date(end12hour * 1000).toISOString().split('T')[0];
  const date1hour = new Date(end1hour * 1000).toISOString().split('T')[0];
  
  endDates['1day'][date1day] = (endDates['1day'][date1day] || 0) + 1;
  endDates['6hour'][date6hour] = (endDates['6hour'][date6hour] || 0) + 1;
  endDates['12hour'][date12hour] = (endDates['12hour'][date12hour] || 0) + 1;
  endDates['1hour'][date1hour] = (endDates['1hour'][date1hour] || 0) + 1;
});

console.log('\n=== STAKE ENDINGS BY CYCLE DURATION ===');
Object.entries(endDates).forEach(([cycleName, dates]) => {
  const nonZeroDates = Object.entries(dates).filter(([date, count]) => count > 0);
  console.log(`\n${cycleName.toUpperCase()} CYCLE:`);
  console.log(`Total dates with stakes: ${nonZeroDates.length}`);
  nonZeroDates.sort().slice(0, 10).forEach(([date, count]) => {
    const daysFromNow = Math.ceil((new Date(date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`  ${date}: ${count} stakes (${daysFromNow} days from now)`);
  });
});

// Check for stakes ending in next 30 days with different calculations
console.log('\n=== STAKES ENDING IN NEXT 30 DAYS ===');
const next30Days = new Date(today);
next30Days.setDate(next30Days.getDate() + 30);

Object.entries(endDates).forEach(([cycleName, dates]) => {
  const soonEnding = Object.entries(dates).filter(([date, count]) => {
    const endDate = new Date(date);
    return endDate >= today && endDate <= next30Days && count > 0;
  });
  
  const totalSoon = soonEnding.reduce((sum, [date, count]) => sum + count, 0);
  console.log(`${cycleName}: ${totalSoon} stakes ending in next 30 days`);
});