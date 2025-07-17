#!/usr/bin/env node

const fs = require('fs');

// Load cached data
const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));

// Get stakes and creates
const stakes = cachedData.stakingData.stakeEvents || [];
const creates = cachedData.stakingData.createEvents || [];
const currentProtocolDay = cachedData.stakingData.currentProtocolDay || 7;

console.log('\n🔍 VERIFYING OCT 11 DATA');
console.log('========================\n');

console.log(`Current Protocol Day: ${currentProtocolDay}`);
console.log(`Current Date: ${new Date().toISOString().split('T')[0]}`);

// Calculate days until Oct 11
const today = new Date();
today.setHours(0, 0, 0, 0);
const oct11 = new Date('2025-10-11');
oct11.setHours(0, 0, 0, 0);
const daysUntilOct11 = Math.ceil((oct11 - today) / (1000 * 60 * 60 * 24));
const oct11ProtocolDay = currentProtocolDay + daysUntilOct11;

console.log(`Days until Oct 11: ${daysUntilOct11}`);
console.log(`Oct 11 Protocol Day: ${oct11ProtocolDay}`);

// Find positions maturing on Oct 11
const oct11Stakes = stakes.filter(s => {
  const maturity = new Date(s.maturityDate);
  return maturity.toISOString().split('T')[0] === '2025-10-11';
});

const oct11Creates = creates.filter(c => {
  const maturity = new Date(c.maturityDate);
  return maturity.toISOString().split('T')[0] === '2025-10-11';
});

console.log(`\nPositions maturing on Oct 11:`);
console.log(`- Stakes: ${oct11Stakes.length}`);
console.log(`- Creates: ${oct11Creates.length}`);

// Calculate totals
const oct11StakePrincipal = oct11Stakes.reduce((sum, s) => sum + parseFloat(s.principal) / 1e18, 0);
const oct11CreatePrincipal = oct11Creates.reduce((sum, c) => sum + parseFloat(c.torusAmount || c.principal || "0") / 1e18, 0);

console.log(`\nPrincipal amounts maturing on Oct 11:`);
console.log(`- From Stakes: ${oct11StakePrincipal.toFixed(2)} TORUS`);
console.log(`- From Creates: ${oct11CreatePrincipal.toFixed(2)} TORUS`);
console.log(`- Total Principal: ${(oct11StakePrincipal + oct11CreatePrincipal).toFixed(2)} TORUS`);

// Check reward pool data for that day
const rewardPools = cachedData.stakingData.rewardPoolData || [];
const oct11Pool = rewardPools.find(p => p.day === oct11ProtocolDay);

if (oct11Pool) {
  console.log(`\nReward Pool for Oct 11 (Day ${oct11ProtocolDay}):`);
  console.log(`- Reward Pool: ${(parseFloat(oct11Pool.rewardPool) / 1e18).toFixed(2)} TORUS`);
  console.log(`- Penalties: ${(parseFloat(oct11Pool.penaltiesInPool) / 1e18).toFixed(2)} TORUS`);
  console.log(`- Total Shares: ${(parseFloat(oct11Pool.totalShares) / 1e18).toFixed(2)}`);
} else {
  console.log(`\n⚠️ No reward pool data found for protocol day ${oct11ProtocolDay}`);
}

// Check nearby dates
console.log('\n📅 Checking nearby dates (Oct 9-13):');
for (let i = -2; i <= 2; i++) {
  const checkDate = new Date(oct11);
  checkDate.setDate(checkDate.getDate() + i);
  const dateStr = checkDate.toISOString().split('T')[0];
  
  const dayStakes = stakes.filter(s => s.maturityDate.split('T')[0] === dateStr);
  const dayCreates = creates.filter(c => c.maturityDate.split('T')[0] === dateStr);
  
  const dayStakePrincipal = dayStakes.reduce((sum, s) => sum + parseFloat(s.principal) / 1e18, 0);
  const dayCreatePrincipal = dayCreates.reduce((sum, c) => sum + parseFloat(c.torusAmount || c.principal || "0") / 1e18, 0);
  
  console.log(`${dateStr}: ${dayStakes.length} stakes (${dayStakePrincipal.toFixed(2)} TORUS), ${dayCreates.length} creates (${dayCreatePrincipal.toFixed(2)} TORUS)`);
}

console.log('\n✅ Verification complete!');