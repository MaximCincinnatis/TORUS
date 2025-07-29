const fs = require('fs');

// Load the cached data
const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));

// Extract stake and create data
const stakeData = cachedData.stakingData?.stakeEvents || [];
const createData = cachedData.stakingData?.createEvents || [];

console.log('DEEP AUDIT: DAY 106 SHARES ENDING ISSUE');
console.log('=====================================\n');

// Helper function to get protocol day from date
function getProtocolDay(date) {
  const CONTRACT_START_DATE = new Date('2025-07-09T18:00:00.000Z');
  const targetDate = new Date(date);
  const diffTime = targetDate.getTime() - CONTRACT_START_DATE.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Helper function to get date from protocol day
function getDateFromProtocolDay(protocolDay) {
  const CONTRACT_START_DATE = new Date('2025-07-09T18:00:00.000Z');
  const targetDate = new Date(CONTRACT_START_DATE);
  targetDate.setUTCDate(targetDate.getUTCDate() + protocolDay);
  return targetDate.toISOString().split('T')[0];
}

const day106Date = getDateFromProtocolDay(106);
console.log(`Day 106 corresponds to date: ${day106Date}`);

// Find all creates ending on Day 106
const createsEndingOn106 = [];

createData.forEach((create, index) => {
  const maturityDate = create.maturityDate instanceof Date ? create.maturityDate : new Date(create.maturityDate);
  const dateKey = maturityDate.toISOString().split('T')[0];
  
  if (dateKey === day106Date) {
    createsEndingOn106.push({
      index,
      user: create.user,
      rawShares: create.shares,
      shares: create.shares ? parseFloat(create.shares) / 1e18 : 0,
      hasShares: !!create.shares,
      maturityDate: dateKey,
      protocolDay: getProtocolDay(maturityDate),
      // Include other relevant fields
      amount: create.amount,
      principal: create.principal,
      term: create.term,
      startDate: create.startDate
    });
  }
});

console.log(`\n=== DAY 106 CREATE POSITIONS ANALYSIS ===`);
console.log(`Total positions ending on Day 106: ${createsEndingOn106.length}`);

const positionsWithShares = createsEndingOn106.filter(p => p.hasShares);
const positionsWithoutShares = createsEndingOn106.filter(p => !p.hasShares);

console.log(`Positions WITH shares data: ${positionsWithShares.length}`);
console.log(`Positions WITHOUT shares data: ${positionsWithoutShares.length}`);

if (positionsWithShares.length > 0) {
  console.log('\nPositions WITH shares:');
  positionsWithShares.forEach((pos, i) => {
    console.log(`  ${i+1}. User: ${pos.user.slice(0, 10)}..., Shares: ${pos.shares.toFixed(2)}, Raw: ${pos.rawShares}`);
  });
}

if (positionsWithoutShares.length > 0) {
  console.log('\nPositions WITHOUT shares (showing first 10):');
  positionsWithoutShares.slice(0, 10).forEach((pos, i) => {
    console.log(`  ${i+1}. User: ${pos.user.slice(0, 10)}..., Principal: ${pos.principal}, Amount: ${pos.amount}, Term: ${pos.term}`);
  });
}

// Check the data structure of a few positions to understand what's missing
console.log('\n=== DATA STRUCTURE ANALYSIS ===');
if (positionsWithoutShares.length > 0) {
  const samplePos = positionsWithoutShares[0];
  console.log('Sample position missing shares data:');
  console.log(JSON.stringify(samplePos, null, 2));
}

if (positionsWithShares.length > 0) {
  const samplePos = positionsWithShares[0];
  console.log('\nSample position WITH shares data:');
  console.log(JSON.stringify(samplePos, null, 2));
}

// Check when these positions were created to understand the term calculation
console.log('\n=== MATURITY CALCULATION VERIFICATION ===');
createsEndingOn106.slice(0, 5).forEach((pos, i) => {
  if (pos.startDate && pos.term) {
    const startDate = new Date(pos.startDate);
    const expectedMaturity = new Date(startDate);
    expectedMaturity.setUTCDate(expectedMaturity.getUTCDate() + parseInt(pos.term));
    
    console.log(`Position ${i+1}:`);
    console.log(`  Start: ${pos.startDate}`);
    console.log(`  Term: ${pos.term} days`);
    console.log(`  Expected maturity: ${expectedMaturity.toISOString().split('T')[0]}`);
    console.log(`  Actual maturity: ${pos.maturityDate}`);
    console.log(`  Match: ${expectedMaturity.toISOString().split('T')[0] === pos.maturityDate ? '✅' : '❌'}`);
  }
});

// Compare with other days to see the pattern
console.log('\n=== SHARES DATA AVAILABILITY ACROSS DAYS ===');
const daysToCheck = [104, 105, 106, 107, 108];
daysToCheck.forEach(day => {
  const dateKey = getDateFromProtocolDay(day);
  const createsOnDay = createData.filter(create => {
    const maturityDate = create.maturityDate instanceof Date ? create.maturityDate : new Date(create.maturityDate);
    return maturityDate.toISOString().split('T')[0] === dateKey;
  });
  
  const withShares = createsOnDay.filter(c => c.shares).length;
  const withoutShares = createsOnDay.filter(c => !c.shares).length;
  const totalShares = createsOnDay.reduce((sum, c) => sum + (c.shares ? parseFloat(c.shares) / 1e18 : 0), 0);
  
  const marker = day === 106 ? ' ← PROBLEM DAY' : '';
  console.log(`Day ${day} (${dateKey}): ${createsOnDay.length} total, ${withShares} with shares, ${withoutShares} without, Total: ${totalShares.toFixed(2)}${marker}`);
});

// Check if this is a shares calculation issue or data collection issue
console.log('\n=== ROOT CAUSE ANALYSIS ===');

const totalCreatesWithoutShares = createData.filter(c => !c.shares).length;
const totalCreatesWithShares = createData.filter(c => c.shares).length;
console.log(`Across entire dataset:`);
console.log(`  Creates with shares: ${totalCreatesWithShares}`);
console.log(`  Creates without shares: ${totalCreatesWithoutShares}`);
console.log(`  Percentage missing shares: ${(totalCreatesWithoutShares / (totalCreatesWithShares + totalCreatesWithoutShares) * 100).toFixed(1)}%`);

// Check if Day 106 missing shares positions have a pattern
const day106MissingShares = positionsWithoutShares;
if (day106MissingShares.length > 0) {
  // Group by term to see if specific terms are affected
  const termCounts = {};
  day106MissingShares.forEach(pos => {
    const term = pos.term || 'unknown';
    termCounts[term] = (termCounts[term] || 0) + 1;
  });
  
  console.log('\nDay 106 positions missing shares - grouped by term:');
  Object.entries(termCounts).forEach(([term, count]) => {
    console.log(`  ${term} days: ${count} positions`);
  });
  
  // Check start dates to see if there's a pattern
  const startDates = day106MissingShares
    .filter(pos => pos.startDate)
    .map(pos => pos.startDate)
    .sort();
  
  if (startDates.length > 0) {
    console.log(`\nStart date range for missing shares positions:`);
    console.log(`  Earliest: ${startDates[0]}`);
    console.log(`  Latest: ${startDates[startDates.length - 1]}`);
  }
}

console.log('\n=== CONCLUSION ===');
if (positionsWithoutShares.length > 0) {
  console.log('🔍 ISSUE IDENTIFIED:');
  console.log(`Day 106 has ${positionsWithoutShares.length} create positions that are missing shares data.`);
  console.log('This explains why the "Shares ending by future date" chart shows a very small value for Day 106.');
  console.log('\nPossible causes:');
  console.log('1. These positions were created before shares calculation was implemented');
  console.log('2. Data collection script failed to calculate shares for these specific positions');
  console.log('3. These positions have some data structure that prevents shares calculation');
  console.log('\nRecommendation: Run a shares recalculation script for positions missing shares data.');
} else {
  console.log('✅ All positions on Day 106 have shares data - the low value is legitimate.');
}