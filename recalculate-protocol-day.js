console.log('=== RECALCULATING PROTOCOL DAY ===\n');

// Contract starts July 10, 2025 at 6:00 PM UTC
// But let me double-check this timing with the actual contract data

const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));

console.log('Cached data says currentProtocolDay:', data.currentProtocolDay);
console.log('This came from contract.getCurrentDayIndex()');

// Let me calculate based on different assumptions
const now = new Date();
console.log('Current time UTC:', now.toISOString());

// Option 1: July 10, 2025 at 6:00 PM UTC
const start1 = new Date('2025-07-10T18:00:00.000Z');
const day1 = Math.floor((now - start1) / (24 * 60 * 60 * 1000)) + 1;

// Option 2: July 10, 2025 at midnight UTC  
const start2 = new Date('2025-07-10T00:00:00.000Z');
const day2 = Math.floor((now - start2) / (24 * 60 * 60 * 1000)) + 1;

// Option 3: Check if contract start was July 11 instead?
const start3 = new Date('2025-07-11T18:00:00.000Z');
const day3 = Math.floor((now - start3) / (24 * 60 * 60 * 1000)) + 1;

console.log('\nCalculations:');
console.log(`If start was July 10 6PM UTC: Day ${day1}`);
console.log(`If start was July 10 midnight UTC: Day ${day2}`);
console.log(`If start was July 11 6PM UTC: Day ${day3}`);

console.log('\nContract says day:', data.currentProtocolDay);

// Let me check which calculation matches the contract
if (data.currentProtocolDay === day1) {
  console.log('✅ Matches July 10 6PM UTC start');
} else if (data.currentProtocolDay === day2) {
  console.log('✅ Matches July 10 midnight UTC start');
} else if (data.currentProtocolDay === day3) {
  console.log('✅ Matches July 11 6PM UTC start');
} else {
  console.log('❌ None of my calculations match the contract!');
  console.log('The contract must be using different timing logic');
}

// Let me reverse-engineer what start date would give day 17
const targetDay = data.currentProtocolDay;
const msPerDay = 24 * 60 * 60 * 1000;

// If we're on day 17, what was the start date?
const impliedStart = new Date(now.getTime() - (targetDay - 1) * msPerDay);
console.log(`\nIf we're on day ${targetDay}, contract started: ${impliedStart.toISOString()}`);

// Check when that would be in different timezones
console.log('That would be:');
console.log('- UTC:', impliedStart.toISOString());
console.log('- EST:', new Date(impliedStart.getTime() - 5*60*60*1000).toISOString(), '(EST)');
console.log('- PST:', new Date(impliedStart.getTime() - 8*60*60*1000).toISOString(), '(PST)');

console.log('\n=== CONCLUSION ===');
console.log('I need to trust the CONTRACT, not my calculations!');
console.log(`The contract says we're on day ${data.currentProtocolDay}`);
console.log('The contract is the authoritative source of truth.');