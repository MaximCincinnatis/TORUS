const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
const createEvents = data.stakingData.createEvents;

console.log('=== TITANX CALCULATION VERIFICATION ===');
console.log('From totals object:');
console.log('Total TitanX:', data.totals.totalTitanX);
console.log('Total Created TitanX:', data.totals.totalCreatedTitanX);

let totalTitanX = 0;
let validTitanXCreates = 0;
createEvents.forEach((c, i) => {
  if (c.titanAmount && c.titanAmount !== '0') {
    const amount = parseFloat(c.titanAmount) / 1e18;
    totalTitanX += amount;
    validTitanXCreates++;
    if (i < 5) {
      console.log('Create ' + i + ': ' + c.titanAmount + ' -> ' + amount.toFixed(2) + ' TitanX');
    }
  }
});

console.log('\nCalculated from events:');
console.log('Creates with TitanX:', validTitanXCreates);
console.log('Calculated total TitanX:', totalTitanX.toLocaleString());
console.log('Average TitanX per create:', (totalTitanX / validTitanXCreates).toFixed(2));
console.log('\nVerification:');
console.log('Totals match:', Math.abs(parseFloat(data.totals.totalTitanX) - totalTitanX) < 1);

// ETH calculation verification
const stakeEvents = data.stakingData.stakeEvents;
console.log('\n=== ETH CALCULATION VERIFICATION ===');

let totalStakeETH = 0;
stakeEvents.forEach(s => {
  if (s.costETH) {
    totalStakeETH += parseFloat(s.costETH) / 1e18;
  }
});

let totalCreateETH = 0;
createEvents.forEach(c => {
  if (c.costETH) {
    totalCreateETH += parseFloat(c.costETH) / 1e18;
  }
});

console.log('From totals object:');
console.log('Total ETH:', data.totals.totalETH);
console.log('Total Staked ETH:', data.totals.totalStakedETH);
console.log('Total Created ETH:', data.totals.totalCreatedETH);

console.log('\nCalculated from events:');
console.log('Calculated stake ETH:', totalStakeETH.toFixed(6));
console.log('Calculated create ETH:', totalCreateETH.toFixed(6));
console.log('Calculated total ETH:', (totalStakeETH + totalCreateETH).toFixed(6));

console.log('\nISSUES FOUND:');
console.log('- ETH totals mismatch: Cached shows', data.totals.totalETH, 'but calculated', (totalStakeETH + totalCreateETH).toFixed(6));
console.log('- Create ETH missing: Cached shows', data.totals.totalCreatedETH, 'but calculated', totalCreateETH.toFixed(6));

console.log('\n=== STAKING DAYS VERIFICATION ===');
console.log('Checking that all stakes/creates are <= 88 days...');
const allStakingDays = [...stakeEvents.map(s => s.stakingDays), ...createEvents.map(c => c.stakingDays)];
const maxDays = Math.max(...allStakingDays);
const minDays = Math.min(...allStakingDays);
const over88 = allStakingDays.filter(d => d > 88).length;
console.log('Min days:', minDays);
console.log('Max days:', maxDays);
console.log('Items over 88 days:', over88);
console.log('Staking days verification:', over88 === 0 ? 'PASS' : 'FAIL');