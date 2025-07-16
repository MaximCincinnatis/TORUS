const fs = require('fs');

// Load cached data
const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
const createEvents = data.stakingData.createEvents;
const stakeEvents = data.stakingData.stakeEvents;

console.log('🔧 Fixing cached data totals...');

// Calculate correct totals
let totalTitanX = 0;
let validTitanXCreates = 0;
createEvents.forEach((c) => {
  if (c.titanAmount && c.titanAmount !== '0') {
    const amount = parseFloat(c.titanAmount) / 1e18;
    totalTitanX += amount;
    validTitanXCreates++;
  }
});

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

const totalETH = totalStakeETH + totalCreateETH;
const avgTitanXPerCreate = validTitanXCreates > 0 ? totalTitanX / validTitanXCreates : 0;

console.log('📊 Corrected calculations:');
console.log('Total TitanX:', totalTitanX.toLocaleString());
console.log('Average TitanX per create:', avgTitanXPerCreate.toFixed(2));
console.log('Total ETH:', totalETH.toFixed(6));
console.log('Total Staked ETH:', totalStakeETH.toFixed(6));
console.log('Total Created ETH:', totalCreateETH.toFixed(6));

// Update the totals object
data.totals = {
  totalETH: totalETH.toFixed(6),
  totalTitanX: Math.round(totalTitanX).toString(),
  totalStakedETH: totalStakeETH.toFixed(6),
  totalCreatedETH: totalCreateETH.toFixed(6),
  totalStakedTitanX: "0", // Stakes don't use TitanX
  totalCreatedTitanX: Math.round(totalTitanX).toString()
};

// Write corrected data back
fs.writeFileSync('public/data/cached-data.json', JSON.stringify(data, null, 2));

console.log('✅ Cached data totals have been corrected!');
console.log('📋 Summary:');
console.log('- Total ETH corrected from', '0.298637', 'to', totalETH.toFixed(6));
console.log('- Created ETH corrected from', '0', 'to', totalCreateETH.toFixed(6));
console.log('- TitanX totals remain accurate at', Math.round(totalTitanX).toLocaleString());
console.log('- Average TitanX per create:', avgTitanXPerCreate.toFixed(2));