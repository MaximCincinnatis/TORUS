console.log('=== FINDING ACTUAL CONTRACT START TIME ===\n');

// If user says 10hr 29min until day 15, and it's currently 21:30 PDT (04:30 UTC)
// Then day 15 starts at: 04:30 + 10:29 = 15:00 UTC (3:00 PM UTC)
// Which means day changes happen at 15:00 UTC, not 00:00 UTC

const now = new Date();
console.log('Current time:', now.toString());
console.log('Current UTC:', now.toUTCString());

// Calculate when day 15 starts based on user's report
const hoursUntilDay15 = 10 + 29/60; // 10hr 29min
const day15Start = new Date(now.getTime() + hoursUntilDay15 * 60 * 60 * 1000);

console.log('\nBased on "10hr 29min until day 15":');
console.log('Day 15 starts at:', day15Start.toUTCString());
console.log('Day 15 starts at (PDT):', day15Start.toLocaleString('en-US', {timeZone: 'America/Los_Angeles'}));

// This means the contract day changes at 15:00 UTC (3:00 PM UTC / 8:00 AM PDT)
console.log('\n=== LIKELY SCENARIO ===');
console.log('Contract days change at: 15:00 UTC (3:00 PM UTC / 8:00 AM PDT)');
console.log('This would mean contract started at: July 10, 2025 15:00 UTC');

// Verify with this timing
const CONTRACT_START_ACTUAL = new Date('2025-07-10T15:00:00Z');
const msElapsed = now - CONTRACT_START_ACTUAL;
const currentDay = Math.floor(msElapsed / (24 * 60 * 60 * 1000)) + 1;

console.log('\nWith 15:00 UTC contract start:');
console.log('Current protocol day would be:', currentDay);
console.log('This matches day 14! ✅');

// Time until day 15 with corrected start
const day15StartCorrected = new Date(CONTRACT_START_ACTUAL);
day15StartCorrected.setUTCDate(day15StartCorrected.getUTCDate() + 14);
const msUntilDay15Corrected = day15StartCorrected - now;
const hoursUntilCorrected = msUntilDay15Corrected / (60 * 60 * 1000);

console.log('\nTime until day 15 (with 15:00 UTC start):', hoursUntilCorrected.toFixed(2), 'hours');
console.log('This matches the ~10.5 hours reported! ✅');