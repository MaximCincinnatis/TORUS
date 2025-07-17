#!/usr/bin/env node

const fs = require('fs');
const { ethers } = require('ethers');

// Load cached data
const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));

// Calculate total staked from stake events (principal is in wei)
const stakeEvents = cachedData.stakingData.stakeEvents || [];
const totalStakedWei = stakeEvents.reduce((sum, stake) => {
  return sum.add(ethers.BigNumber.from(stake.principal));
}, ethers.BigNumber.from(0));
const totalStaked = parseFloat(ethers.utils.formatEther(totalStakedWei));

// Calculate total created from create events (torusAmount is in wei)
const createEvents = cachedData.stakingData.createEvents || [];
const totalCreatedWei = createEvents.reduce((sum, create) => {
  return sum.add(ethers.BigNumber.from(create.torusAmount || create.principal || "0"));
}, ethers.BigNumber.from(0));
const totalCreated = parseFloat(ethers.utils.formatEther(totalCreatedWei));

// Get total supply
const totalSupply = cachedData.stakingData.totalSupply || cachedData.totalSupply || 19626.6;

// Calculate percentages
const percentStaked = (totalStaked / totalSupply) * 100;
const percentCreated = (totalCreated / totalSupply) * 100;
const percentLocked = ((totalStaked + totalCreated) / totalSupply) * 100;

// Display results
console.log('\n🔍 TORUS STAKING TOTALS AUDIT (ACCURATE)');
console.log('=========================================\n');

console.log('📁 CACHED DATA ANALYSIS:');
console.log(`Total Supply: ${totalSupply.toFixed(2)} TORUS`);
console.log(`Total Stake Events: ${stakeEvents.length}`);
console.log(`Total Create Events: ${createEvents.length}`);
console.log(`Total Staked: ${totalStaked.toFixed(2)} TORUS`);
console.log(`Total Created: ${totalCreated.toFixed(2)} TORUS`);
console.log(`Total Locked: ${(totalStaked + totalCreated).toFixed(2)} TORUS`);

console.log('\n📈 PERCENTAGES:');
console.log(`% Staked: ${percentStaked.toFixed(2)}%`);
console.log(`% Created: ${percentCreated.toFixed(2)}%`);
console.log(`% Total Locked: ${percentLocked.toFixed(2)}%`);

// Check for active vs matured
const now = new Date();
const activeStakes = stakeEvents.filter(s => new Date(s.maturityDate) > now);
const maturedStakes = stakeEvents.filter(s => new Date(s.maturityDate) <= now);

console.log('\n⏱️ STAKE STATUS:');
console.log(`Active Stakes: ${activeStakes.length}`);
console.log(`Matured Stakes: ${maturedStakes.length}`);

// Sample some recent events with proper formatting
console.log('\n📝 RECENT STAKE EVENTS (last 5):');
stakeEvents.slice(-5).forEach((stake, i) => {
  const amount = parseFloat(ethers.utils.formatEther(stake.principal));
  console.log(`  ${stakeEvents.length - 5 + i + 1}. User: ${stake.user.slice(0, 10)}... Principal: ${amount.toFixed(2)} TORUS`);
});

console.log('\n📝 RECENT CREATE EVENTS (last 5):');
createEvents.slice(-5).forEach((create, i) => {
  const amount = parseFloat(ethers.utils.formatEther(create.torusAmount || create.principal || "0"));
  console.log(`  ${createEvents.length - 5 + i + 1}. User: ${create.user.slice(0, 10)}... Amount: ${amount.toFixed(2)} TORUS`);
});

// Check for data inconsistencies
console.log('\n🔍 DATA CONSISTENCY CHECK:');
const hasOldFormatStakes = stakeEvents.some(s => s.principal && s.principal.includes('.'));
const hasOldFormatCreates = createEvents.some(c => (c.torusAmount || c.principal || "").includes('.'));
console.log(`Stake events with decimal format: ${hasOldFormatStakes ? 'YES (NEEDS FIX)' : 'NO (GOOD)'}`);
console.log(`Create events with decimal format: ${hasOldFormatCreates ? 'YES (NEEDS FIX)' : 'NO (GOOD)'}`);

console.log('\n✅ Audit complete!');