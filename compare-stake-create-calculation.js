const data = require('./public/data/cached-data.json');
const stakes = data.stakingData?.stakeEvents || [];
const creates = data.stakingData?.createEvents || [];

console.log('=== STAKE vs CREATE MATURITY CALCULATION COMPARISON ===');

// Sample a few stakes and creates to compare their calculation
console.log('\n=== SAMPLE STAKES ===');
stakes.slice(0, 5).forEach((stake, i) => {
  const timestamp = parseInt(stake.timestamp);
  const duration = parseInt(stake.stakingDays);
  const maturityDate = new Date(stake.maturityDate);
  
  // Calculate what the maturity SHOULD be with different cycle durations
  const expectedWith86400 = new Date((timestamp + (duration * 86400)) * 1000);
  const expectedWith3600 = new Date((timestamp + (duration * 3600)) * 1000);
  
  console.log(`\nStake ${i}:`);
  console.log(`  Timestamp: ${timestamp} (${new Date(timestamp * 1000).toISOString()})`);
  console.log(`  Duration: ${duration} days`);
  console.log(`  Cached maturity: ${maturityDate.toISOString()}`);
  console.log(`  Expected (86400s): ${expectedWith86400.toISOString()}`);
  console.log(`  Expected (3600s): ${expectedWith3600.toISOString()}`);
  console.log(`  Matches 86400s: ${maturityDate.getTime() === expectedWith86400.getTime()}`);
  console.log(`  Matches 3600s: ${maturityDate.getTime() === expectedWith3600.getTime()}`);
});

console.log('\n=== SAMPLE CREATES ===');
creates.slice(0, 5).forEach((create, i) => {
  const timestamp = parseInt(create.timestamp);
  const duration = parseInt(create.stakingDays);
  const maturityDate = new Date(create.maturityDate);
  
  // Calculate what the maturity SHOULD be with different cycle durations
  const expectedWith86400 = new Date((timestamp + (duration * 86400)) * 1000);
  const expectedWith3600 = new Date((timestamp + (duration * 3600)) * 1000);
  
  console.log(`\nCreate ${i}:`);
  console.log(`  Timestamp: ${timestamp} (${new Date(timestamp * 1000).toISOString()})`);
  console.log(`  Duration: ${duration} days`);
  console.log(`  Cached maturity: ${maturityDate.toISOString()}`);
  console.log(`  Expected (86400s): ${expectedWith86400.toISOString()}`);
  console.log(`  Expected (3600s): ${expectedWith3600.toISOString()}`);
  console.log(`  Matches 86400s: ${maturityDate.getTime() === expectedWith86400.getTime()}`);
  console.log(`  Matches 3600s: ${maturityDate.getTime() === expectedWith3600.getTime()}`);
});

// Check if there's a pattern in the duration differences
console.log('\n=== DURATION ANALYSIS ===');
const stakeDurations = stakes.map(s => parseInt(s.stakingDays));
const createDurations = creates.map(c => parseInt(c.stakingDays));

console.log('Stake duration distribution:');
const stakeDistribution = {};
stakeDurations.forEach(d => {
  stakeDistribution[d] = (stakeDistribution[d] || 0) + 1;
});
Object.entries(stakeDistribution).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).forEach(([duration, count]) => {
  console.log(`  ${duration} days: ${count} stakes`);
});

console.log('\nCreate duration distribution (first 20):');
const createDistribution = {};
createDurations.forEach(d => {
  createDistribution[d] = (createDistribution[d] || 0) + 1;
});
Object.entries(createDistribution).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).slice(0, 20).forEach(([duration, count]) => {
  console.log(`  ${duration} days: ${count} creates`);
});