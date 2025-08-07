const data = require('./public/data/cached-data.json');

// Get creates
const creates = data.stakingData.createEvents;

// Find one with shares > 0
const goodCreate = creates.find(c => c.shares && c.shares !== '0' && c.shares !== 0);
console.log('Example of create WITH shares:');
console.log(JSON.stringify(goodCreate, null, 2));

// Find one with 0 shares
const zeroCreate = creates.find(c => c.shares === '0' || c.shares === 0);
console.log('\nExample of create with 0 shares:');
console.log(JSON.stringify(zeroCreate, null, 2));

// Find one with undefined shares
const undefinedCreate = creates.find(c => c.shares === undefined);
console.log('\nExample of create with undefined shares:');
console.log(JSON.stringify(undefinedCreate, null, 2));

// Check if this is related to claimedCreate status
const claimedWithShares = creates.filter(c => c.claimedCreate === true && c.shares && c.shares !== '0').length;
const unclaimedWithShares = creates.filter(c => c.claimedCreate === false && c.shares && c.shares !== '0').length;
const claimedWithZero = creates.filter(c => c.claimedCreate === true && (c.shares === '0' || c.shares === 0)).length;
const unclaimedWithZero = creates.filter(c => c.claimedCreate === false && (c.shares === '0' || c.shares === 0)).length;

console.log('\nShares by claimed status:');
console.log(`Claimed with shares > 0: ${claimedWithShares}`);
console.log(`Unclaimed with shares > 0: ${unclaimedWithShares}`);
console.log(`Claimed with 0 shares: ${claimedWithZero}`);
console.log(`Unclaimed with 0 shares: ${unclaimedWithZero}`);