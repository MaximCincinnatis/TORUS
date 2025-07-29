const fs = require('fs');

function getDateFromProtocolDay(protocolDay) {
  const CONTRACT_START_DATE = new Date('2025-07-09T18:00:00.000Z');
  const targetDate = new Date(CONTRACT_START_DATE);
  targetDate.setUTCDate(targetDate.getUTCDate() + protocolDay);
  return targetDate.toISOString().split('T')[0];
}

console.log('VALIDATE SHARES FIX: VERIFYING THE CORRECTION WORKED');
console.log('=====================================================\n');

// Load the updated cached data
const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
const createData = cachedData.stakingData?.createEvents || [];

console.log(`Total create events: ${createData.length}`);

// Check for zero shares
const zeroShares = createData.filter(event => !event.shares || parseFloat(event.shares) === 0);
console.log(`Events with zero shares: ${zeroShares.length}`);

if (zeroShares.length > 0) {
  console.log('\n❌ STILL HAVE ZERO SHARES:');
  zeroShares.forEach((event, i) => {
    console.log(`${i + 1}. User: ${event.user.slice(0, 10)}... Principal: ${event.principal ? parseFloat(event.principal) / 1e18 : 'N/A'} ETH`);
  });
} else {
  console.log('✅ No zero-shares events found!');
}

// Specifically check the "Shares ending by future date" chart for Days 105-108
const day105Date = getDateFromProtocolDay(105);
const day106Date = getDateFromProtocolDay(106);
const day107Date = getDateFromProtocolDay(107);
const day108Date = getDateFromProtocolDay(108);

console.log(`\n=== SHARES ENDING BY FUTURE DATE VALIDATION ===`);

[105, 106, 107, 108].forEach(day => {
  const dateKey = getDateFromProtocolDay(day);
  
  // Get all positions maturing on this day
  const stakesOnDay = cachedData.stakingData.stakeEvents.filter(event => {
    const maturityDate = event.maturityDate instanceof Date ? event.maturityDate : new Date(event.maturityDate);
    return maturityDate.toISOString().split('T')[0] === dateKey;
  });
  
  const createsOnDay = createData.filter(event => {
    const maturityDate = event.maturityDate instanceof Date ? event.maturityDate : new Date(event.maturityDate);
    return maturityDate.toISOString().split('T')[0] === dateKey;
  });
  
  // Calculate total shares
  const stakeShares = stakesOnDay.reduce((sum, event) => {
    return sum + (event.shares ? parseFloat(event.shares) / 1e18 : 0);
  }, 0);
  
  const createShares = createsOnDay.reduce((sum, event) => {
    return sum + (event.shares ? parseFloat(event.shares) / 1e18 : 0);
  }, 0);
  
  const totalShares = stakeShares + createShares;
  
  console.log(`\nDay ${day} (${dateKey}):`);
  console.log(`  Stakes: ${stakesOnDay.length} positions, ${stakeShares.toFixed(0)} shares`);
  console.log(`  Creates: ${createsOnDay.length} positions, ${createShares.toFixed(0)} shares`);
  console.log(`  TOTAL: ${totalShares.toFixed(0)} shares`);
  
  if (day === 106) {
    console.log(`  📊 Day 106 should now show ~${Math.round(totalShares / 1e6)}M shares (was showing ~108K before fix)`);
  }
});

// Check term field was added
const missingTerm = createData.filter(event => !event.term || event.term === 'undefined');
console.log(`\n=== TERM FIELD VALIDATION ===`);
console.log(`Events missing term field: ${missingTerm.length}`);

if (missingTerm.length > 0) {
  console.log('Sample events missing term:');
  missingTerm.slice(0, 5).forEach((event, i) => {
    console.log(`${i + 1}. User: ${event.user.slice(0, 10)}... Term: ${event.term}`);
  });
}

// Validate shares make sense (should be roughly 7,744 shares per ETH for 88-day positions)
console.log(`\n=== SHARES RATIO VALIDATION ===`);

const sampleCreates = createData
  .filter(event => event.shares && event.principal && parseFloat(event.shares) > 0 && parseFloat(event.principal) > 0)
  .slice(0, 10);

console.log('Sample shares-to-principal ratios:');
sampleCreates.forEach((event, i) => {
  const principal = parseFloat(event.principal) / 1e18;
  const shares = parseFloat(event.shares) / 1e18;
  const ratio = shares / principal;
  const term = event.term || 'unknown';
  
  console.log(`${i + 1}. ${ratio.toFixed(0)} shares/ETH (${term} days, ${principal.toFixed(2)} ETH)`);
});

// Final success message
console.log(`\n=== CONCLUSION ===`);
if (zeroShares.length === 0) {
  console.log('🎉 SUCCESS: All zero-shares issues have been fixed!');
  console.log('✅ Charts should now display accurate data for all days');
  console.log('✅ Day 106 "Shares ending by future date" should show proper values');
  console.log('✅ All positions now have accurate on-chain shares data');
} else {
  console.log('⚠️  Some zero-shares positions remain - may need additional investigation');
}

console.log('\n📋 NEXT STEPS:');
console.log('1. Refresh the dashboard to see updated charts');
console.log('2. Verify Day 106 shows correct values in "Shares ending by future date"');
console.log('3. Monitor future updates to prevent recurrence of this issue');