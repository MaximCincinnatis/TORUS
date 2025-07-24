const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));

console.log('=== FIELD NAME ANALYSIS ===\n');

// Check creates for field names
console.log('CREATE EVENTS - Checking field names:');
const createSample = data.stakingData.createEvents[0];
if (createSample) {
  console.log('Sample create event fields:', Object.keys(createSample).join(', '));
}

// Check which field has the TitanX data
let titanXField = null;
let titanAmountField = null;

data.stakingData.createEvents.forEach(c => {
  if (c.titanXAmount && c.titanXAmount !== '0') titanXField = 'titanXAmount';
  if (c.titanAmount && c.titanAmount !== '0') titanAmountField = 'titanAmount';
});

console.log('\nTitanX data found in fields:');
console.log('  titanXAmount:', titanXField ? 'YES' : 'NO');
console.log('  titanAmount:', titanAmountField ? 'YES' : 'NO');

// Count creates by payment type
const createsByPayment = {
  titanX: 0,
  titanAmount: 0,
  eth: 0,
  none: 0
};

data.stakingData.createEvents.forEach(c => {
  if (c.titanXAmount && c.titanXAmount !== '0') createsByPayment.titanX++;
  else if (c.titanAmount && c.titanAmount !== '0') createsByPayment.titanAmount++;
  else if (c.ethAmount && c.ethAmount !== '0') createsByPayment.eth++;
  else createsByPayment.none++;
});

console.log('\nCreates by payment type:');
console.log('  With titanXAmount:', createsByPayment.titanX);
console.log('  With titanAmount:', createsByPayment.titanAmount);
console.log('  With ETH:', createsByPayment.eth);
console.log('  No payment data:', createsByPayment.none);

// Check specific days 13-14
console.log('\n=== DAY 13-14 DETAILED CHECK ===');

const day13Creates = data.stakingData.createEvents.filter(e => {
  const ts = parseInt(e.timestamp);
  return ts >= 1753142400 && ts < 1753228800;
});

const day14Creates = data.stakingData.createEvents.filter(e => {
  const ts = parseInt(e.timestamp);
  return ts >= 1753228800 && ts < 1753315200;
});

console.log('\nDay 13 creates:', day13Creates.length);
day13Creates.slice(0, 3).forEach(c => {
  console.log(`  User: ${c.user.substring(0, 10)}...`);
  console.log(`    titanXAmount: ${c.titanXAmount || 'undefined'}`);
  console.log(`    titanAmount: ${c.titanAmount || 'undefined'}`);
  console.log(`    ethAmount: ${c.ethAmount || 'undefined'}`);
});

console.log('\nDay 14 creates:', day14Creates.length);
day14Creates.slice(0, 3).forEach(c => {
  console.log(`  User: ${c.user.substring(0, 10)}...`);
  console.log(`    titanXAmount: ${c.titanXAmount || 'undefined'}`);
  console.log(`    titanAmount: ${c.titanAmount || 'undefined'}`);
  console.log(`    ethAmount: ${c.ethAmount || 'undefined'}`);
});

// Check if the chart might be looking for wrong field
console.log('\n=== CHART COMPATIBILITY CHECK ===');
console.log('If chart expects "titanAmount" but data has "titanXAmount", that would explain zeros!');

// Count events with titanAmount on days 13-14
const day13WithTitanAmount = day13Creates.filter(c => c.titanAmount && c.titanAmount !== '0').length;
const day14WithTitanAmount = day14Creates.filter(c => c.titanAmount && c.titanAmount !== '0').length;

console.log(`\nDay 13 creates with titanAmount field: ${day13WithTitanAmount}`);
console.log(`Day 14 creates with titanAmount field: ${day14WithTitanAmount}`);