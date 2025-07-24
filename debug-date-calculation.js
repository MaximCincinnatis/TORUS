const CONTRACT_START = new Date('2025-07-10T15:00:00Z');

console.log('=== DEBUG DATE CALCULATION ===\n');

console.log('Contract Start:', CONTRACT_START.toISOString());
console.log('Contract Start Date:', CONTRACT_START.toISOString().split('T')[0]);

// Test specific days
for (let day = 1; day <= 15; day++) {
  const date = new Date(CONTRACT_START);
  date.setUTCDate(date.getUTCDate() + day - 1);
  
  const dateStr = date.toISOString().split('T')[0];
  console.log(`Day ${day}: ${dateStr}`);
}

console.log('\nExpected:');
console.log('Day 1: 2025-07-10');
console.log('Day 14: 2025-07-23');
console.log('Day 15: 2025-07-24');

// The issue might be that when contract starts at 15:00 UTC on July 10,
// Day 1 actually spans from July 10 15:00 to July 11 15:00
// So the "date" for Day 1 could be considered July 11?

console.log('\n=== Alternative Interpretation ===');
console.log('If Day 1 runs from July 10 15:00 to July 11 15:00:');
console.log('Should we use the START date or END date for display?');

// Current code uses start of day
for (let day = 1; day <= 15; day++) {
  const dayStart = new Date(CONTRACT_START);
  dayStart.setUTCHours(dayStart.getUTCHours() + (day - 1) * 24);
  
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCHours(dayEnd.getUTCHours() + 24);
  
  console.log(`Day ${day}: Starts ${dayStart.toISOString()} (${dayStart.toISOString().split('T')[0]})`);
}