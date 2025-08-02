/**
 * Quick test to verify our maturityDate calculation works in the scripts
 */

const fs = require('fs');

// Load current data
const data = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));

// Get first stake event
const firstStake = data.stakingData.stakeEvents[0];
console.log('First stake event (current):');
console.log(JSON.stringify(firstStake, null, 2));

// Calculate what maturityDate should be
const timestamp = parseInt(firstStake.timestamp);
const stakingDays = parseInt(firstStake.stakingDays);
const endTimestamp = timestamp + (stakingDays * 24 * 60 * 60);
const maturityDate = new Date(endTimestamp * 1000).toISOString();

console.log('\nCalculated maturityDate:', maturityDate);
console.log('This is what should be added to stake events');

// Show what the stake should look like with maturityDate
const updatedStake = { ...firstStake, maturityDate };
console.log('\nStake with maturityDate added:');
console.log(JSON.stringify(updatedStake, null, 2));