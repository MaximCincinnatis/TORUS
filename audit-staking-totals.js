#!/usr/bin/env node

const fs = require('fs');
const { ethers } = require('ethers');

// Load cached data
const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));

// Calculate total staked from stake events
const stakeEvents = cachedData.stakingData.stakeEvents || [];
const totalStakedFromEvents = stakeEvents.reduce((sum, stake) => {
  return sum + parseFloat(stake.principal);
}, 0);

// Calculate total created from create events  
const createEvents = cachedData.stakingData.createEvents || [];
const totalCreatedFromEvents = createEvents.reduce((sum, create) => {
  return sum + parseFloat(create.principal);
}, 0);

// Get blockchain data for comparison
async function getBlockchainTotals() {
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  
  // Contract addresses
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  // Get contract events to count
  const contractABI = [
    'event Staked(address indexed user, uint256 stakeIndex, uint256 principal, uint256 stakingDays, uint256 shares)',
    'event Created(address indexed user, uint256 indexed createId, uint256 amount, uint256 shares, uint16 indexed duration, uint256 rewardDay, uint256 timestamp, address referrer)',
    'function getCreateShares() view returns (uint256)',
    'function getStakeShares() view returns (uint256)',
    'function getTotalSupply() view returns (uint256)'
  ];
  
  const contract = new ethers.Contract(CREATE_STAKE_CONTRACT, contractABI, provider);
  
  try {
    // Get total shares from contract
    const [createShares, stakeShares] = await Promise.all([
      contract.getCreateShares().catch(() => ethers.BigNumber.from(0)),
      contract.getStakeShares().catch(() => ethers.BigNumber.from(0))
    ]);
    
    console.log('\n📊 CONTRACT TOTALS:');
    console.log(`Create Shares: ${ethers.utils.formatUnits(createShares, 18)} shares`);
    console.log(`Stake Shares: ${ethers.utils.formatUnits(stakeShares, 18)} shares`);
  } catch (e) {
    console.log('Could not fetch contract totals:', e.message);
  }
}

// Display results
console.log('\n🔍 TORUS STAKING TOTALS AUDIT');
console.log('==============================\n');

console.log('📁 CACHED DATA ANALYSIS:');
console.log(`Total Supply: ${cachedData.stakingData.totalSupply?.toFixed(2) || 'N/A'} TORUS`);
console.log(`Total Stake Events: ${stakeEvents.length}`);
console.log(`Total Create Events: ${createEvents.length}`);
console.log(`Total Staked (from events): ${totalStakedFromEvents.toFixed(2)} TORUS`);
console.log(`Total Created (from events): ${totalCreatedFromEvents.toFixed(2)} TORUS`);
console.log(`Total Locked: ${(totalStakedFromEvents + totalCreatedFromEvents).toFixed(2)} TORUS`);

// Calculate percentage
const totalSupply = cachedData.stakingData.totalSupply || cachedData.totalSupply || 19626.6;
const percentStaked = (totalStakedFromEvents / totalSupply) * 100;
const percentCreated = (totalCreatedFromEvents / totalSupply) * 100;
const percentLocked = ((totalStakedFromEvents + totalCreatedFromEvents) / totalSupply) * 100;

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

// Sample some recent events
console.log('\n📝 RECENT STAKE EVENTS (last 5):');
stakeEvents.slice(-5).forEach((stake, i) => {
  console.log(`  ${stakeEvents.length - 5 + i + 1}. User: ${stake.user.slice(0, 10)}... Principal: ${parseFloat(stake.principal).toFixed(2)} TORUS`);
});

// Get blockchain totals
getBlockchainTotals().then(() => {
  console.log('\n✅ Audit complete!');
}).catch(console.error);