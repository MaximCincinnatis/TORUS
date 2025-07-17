// Mathematical Audit - Manual calculation verification
console.log('🔍 MATHEMATICAL AUDIT - Manual Calculations');
console.log('===========================================\n');

// Test timestamp conversion
console.log('📅 1. Testing Timestamp Conversion:');
const testTimestamp = 1720656000;
const convertedDate = new Date(testTimestamp * 1000);
console.log('Timestamp:', testTimestamp);
console.log('Converted:', convertedDate.toISOString());
console.log('Year:', convertedDate.getFullYear());

// This should be 2025, but it's 2024\!
if (convertedDate.getFullYear() === 2024) {
  console.log('❌ CRITICAL ISSUE: Timestamp is for 2024, not 2025\!');
  
  // Calculate correct timestamp for July 11, 2025
  const correctDate = new Date('2025-07-11T00:00:00Z');
  const correctTimestamp = Math.floor(correctDate.getTime() / 1000);
  console.log('Correct timestamp for July 11, 2025:', correctTimestamp);
  console.log('Correct date:', correctDate.toISOString());
}

// Test share calculations
console.log('\n📊 2. Testing Share Calculations:');
const position1Shares = 5000;
const day1TotalShares = 10000;
const day1RewardPool = 1000;

const sharePercentage = position1Shares / day1TotalShares;
const dailyReward = day1RewardPool * sharePercentage;

console.log('Position 1 shares:', position1Shares);
console.log('Day 1 total shares:', day1TotalShares);
console.log('Share percentage:', sharePercentage, '(' + (sharePercentage * 100) + '%)');
console.log('Daily reward:', dailyReward, 'TORUS');

console.log('\n✅ Basic calculations look correct');
console.log('🚨 MAJOR ISSUE: Test data uses 2024 timestamps, not 2025!');
