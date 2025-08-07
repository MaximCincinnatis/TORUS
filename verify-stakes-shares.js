const data = require('./public/data/cached-data.json');

// Check stakes
const stakesWithoutShares = data.stakingData.stakeEvents.filter(s => !s.shares || s.shares === '0').length;
const stakesWithShares = data.stakingData.stakeEvents.filter(s => s.shares && s.shares !== '0').length;

console.log('Stakes Analysis:');
console.log('- Total stakes:', data.stakingData.stakeEvents.length);
console.log('- Stakes with shares:', stakesWithShares);
console.log('- Stakes without shares:', stakesWithoutShares);

// Check by payment type
const stakesByPayment = {
  eth: data.stakingData.stakeEvents.filter(s => s.rawCostETH && s.rawCostETH !== '0').length,
  titanx: data.stakingData.stakeEvents.filter(s => s.rawCostTitanX && s.rawCostTitanX !== '0').length
};

console.log('\nStakes by payment type:');
console.log('- Paid with ETH:', stakesByPayment.eth);
console.log('- Paid with TitanX:', stakesByPayment.titanx);

// Verify all stakes have shares regardless of payment type
const ethStakesWithoutShares = data.stakingData.stakeEvents.filter(s => 
  s.rawCostETH && s.rawCostETH !== '0' && (!s.shares || s.shares === '0')
).length;

const titanxStakesWithoutShares = data.stakingData.stakeEvents.filter(s => 
  s.rawCostTitanX && s.rawCostTitanX !== '0' && (!s.shares || s.shares === '0')
).length;

console.log('\nShares verification:');
console.log('- ETH stakes without shares:', ethStakesWithoutShares);
console.log('- TitanX stakes without shares:', titanxStakesWithoutShares);

if (stakesWithoutShares === 0) {
  console.log('\n✅ All stakes have shares correctly calculated!');
} else {
  console.log('\n❌ Some stakes are missing shares');
}