// Investigate why all costETH values are 0 in cached data
const ethers = require('ethers');
const fs = require('fs');

console.log('🔍 INVESTIGATING ETH AMOUNTS IN STAKE/CREATE EVENTS...');

// Load the cached data to see current state
const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
const stakeEvents = data.stakingData.stakeEvents;
const createEvents = data.stakingData.createEvents;

console.log(`📊 Total stake events: ${stakeEvents.length}`);
console.log(`📊 Total create events: ${createEvents.length}`);

// Check costETH values
const stakeETHValues = stakeEvents.map(s => s.costETH).filter(eth => eth !== "0");
const createETHValues = createEvents.map(c => c.costETH).filter(eth => eth !== "0");

console.log(`💰 Non-zero stake ETH values: ${stakeETHValues.length}`);
console.log(`💰 Non-zero create ETH values: ${createETHValues.length}`);

if (stakeETHValues.length > 0) {
  console.log('Sample stake ETH values:', stakeETHValues.slice(0, 5));
}
if (createETHValues.length > 0) {
  console.log('Sample create ETH values:', createETHValues.slice(0, 5));
}

// Check if the issue is in the contract or our parsing
console.log('\n🔍 CHECKING CONTRACT LOGIC...');

// Sample event for analysis
const sampleStake = stakeEvents[0];
console.log('Sample stake event:');
console.log('  User:', sampleStake.user);
console.log('  Principal:', sampleStake.principal, '(', parseFloat(sampleStake.principal) / 1e18, 'TORUS )');
console.log('  Duration:', sampleStake.duration, 'seconds');
console.log('  StakingDays:', sampleStake.stakingDays);
console.log('  CostETH:', sampleStake.costETH);

const sampleCreate = createEvents[0];
console.log('\nSample create event:');
console.log('  User:', sampleCreate.user);
console.log('  TORUS Amount:', sampleCreate.torusAmount, '(', parseFloat(sampleCreate.torusAmount) / 1e18, 'TORUS )');
console.log('  Duration:', sampleCreate.duration, 'seconds');
console.log('  StakingDays:', sampleCreate.stakingDays);
console.log('  CostETH:', sampleCreate.costETH);

// Check the totals
console.log('\n📊 CURRENT TOTALS:');
console.log('  Total ETH:', data.totals.totalETH);
console.log('  Total Staked ETH:', data.totals.totalStakedETH);
console.log('  Total Created ETH:', data.totals.totalCreatedETH);

console.log('\n💡 ANALYSIS:');
console.log('If all costETH values are 0, this suggests:');
console.log('1. The contract events may not include ETH amounts in the event data');
console.log('2. ETH amounts might need to be calculated from transaction values');
console.log('3. The costETH field might be populated differently than expected');
console.log('4. We may need to look at transaction.value instead of event.costETH');

console.log('\n🎯 NEXT STEPS:');
console.log('1. Check if contract events actually emit ETH amounts');
console.log('2. Look at transaction values for ETH spent');
console.log('3. Verify if costETH should come from getUserInfo() calls');
console.log('4. Check if ETH is spent on token purchases vs staking');