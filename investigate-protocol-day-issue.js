const { ethers } = require('ethers');

// Contract start: July 10, 2025 at 6:00 PM UTC
const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');

// The function from update-buy-process-data.js
function getProtocolDay(timestamp) {
  const msPerDay = 24 * 60 * 60 * 1000;
  let dateObj;
  
  if (typeof timestamp === 'number') {
    // Unix timestamp in seconds
    dateObj = new Date(timestamp * 1000);
  } else if (typeof timestamp === 'string') {
    // Date string like "2025-07-12", assume 12:00 UTC (noon)
    dateObj = new Date(timestamp + 'T12:00:00.000Z');
  } else {
    dateObj = timestamp;
  }
  
  const daysDiff = Math.floor((dateObj.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1;
  return Math.max(1, daysDiff);
}

// Correct protocol day calculation
function getCorrectProtocolDay(timestampSeconds) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const eventTime = new Date(timestampSeconds * 1000);
  const timeSinceStart = eventTime.getTime() - CONTRACT_START_DATE.getTime();
  return Math.floor(timeSinceStart / msPerDay) + 1;
}

console.log('=== PROTOCOL DAY CALCULATION INVESTIGATION ===\n');

// Test some specific timestamps
const testCases = [
  // Day 20 boundary (July 29, 2025 6PM UTC)
  { time: new Date('2025-07-29T17:59:59Z'), desc: 'Just before day 20' },
  { time: new Date('2025-07-29T18:00:00Z'), desc: 'Start of day 20' },
  { time: new Date('2025-07-29T18:40:23Z'), desc: 'Day 20 burn example' },
  { time: new Date('2025-07-30T05:45:47Z'), desc: 'Day 20 late burn' },
  { time: new Date('2025-07-30T17:59:59Z'), desc: 'End of day 20' },
  { time: new Date('2025-07-30T18:00:00Z'), desc: 'Start of day 21' },
  
  // Day 25 boundary (Aug 3/4)
  { time: new Date('2025-08-03T17:59:59Z'), desc: 'End of day 24' },
  { time: new Date('2025-08-03T18:00:00Z'), desc: 'Start of day 25' },
  { time: new Date('2025-08-04T17:59:59Z'), desc: 'End of day 25' },
  { time: new Date('2025-08-04T18:00:00Z'), desc: 'Start of day 26' },
];

console.log('Timestamp Analysis:');
console.log('==================\n');

testCases.forEach(test => {
  const timestamp = Math.floor(test.time.getTime() / 1000);
  const dateKey = test.time.toISOString().split('T')[0];
  
  // How the script currently calculates
  const scriptProtocolDay = getProtocolDay(timestamp);
  
  // How it should calculate
  const correctProtocolDay = getCorrectProtocolDay(timestamp);
  
  console.log(`${test.desc}:`);
  console.log(`  Time: ${test.time.toISOString()}`);
  console.log(`  Date key used: ${dateKey}`);
  console.log(`  Script calculates: Day ${scriptProtocolDay}`);
  console.log(`  Should be: Day ${correctProtocolDay}`);
  console.log(`  ${scriptProtocolDay === correctProtocolDay ? '✅' : '❌'} ${scriptProtocolDay === correctProtocolDay ? 'CORRECT' : 'WRONG'}`);
  console.log('');
});

console.log('\n=== THE PROBLEM ===\n');
console.log('1. Burns are being grouped by UTC calendar date (YYYY-MM-DD)');
console.log('2. Protocol days start at 6PM UTC, not midnight');
console.log('3. A burn at 5PM UTC on July 30 belongs to protocol day 20 (July 29 6PM - July 30 6PM)');
console.log('4. But the script assigns it to July 30 calendar date, which gets day 21');
console.log('');
console.log('This explains why:');
console.log('- Day 20 is missing burns (they got assigned to day 21)');
console.log('- Day 25 shows burns when it should have 0 (they belong to day 24)');
console.log('- Total is correct but daily allocation is wrong');