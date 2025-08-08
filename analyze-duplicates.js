#!/usr/bin/env node

const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));

// Find duplicates with their shares
const stakesByKey = {};
data.stakingData.stakeEvents.forEach(s => {
  const key = s.user + '-' + (s.id || 'undefined');
  if (!stakesByKey[key]) {
    stakesByKey[key] = [];
  }
  stakesByKey[key].push(s);
});

// Find the duplicates with the largest shares
const duplicatesWithShares = [];
Object.entries(stakesByKey).forEach(([key, stakes]) => {
  if (stakes.length > 1) {
    const totalShares = stakes.reduce((sum, s) => sum + parseFloat(s.shares || 0) / 1e18, 0);
    duplicatesWithShares.push({
      key,
      count: stakes.length,
      totalShares,
      stakes: stakes
    });
  }
});

// Sort by total shares
duplicatesWithShares.sort((a, b) => b.totalShares - a.totalShares);

console.log('Top duplicates by total shares:');
duplicatesWithShares.slice(0, 10).forEach(d => {
  console.log(`\n${d.key}: ${d.count} copies, ${(d.totalShares/1e6).toFixed(2)}M total shares`);
  
  // Show details of each duplicate
  d.stakes.forEach((s, i) => {
    const maturityDate = new Date(s.maturityDate);
    const CONTRACT_START = new Date('2025-07-10T18:00:00.000Z');
    const maturityDay = Math.floor((maturityDate - CONTRACT_START) / (24*60*60*1000)) + 1;
    const shares = parseFloat(s.shares || 0) / 1e18;
    console.log(`  Copy ${i+1}: ${(shares/1e6).toFixed(2)}M shares, matures day ${maturityDay}`);
  });
});

// Calculate total duplicate shares
const totalExtraShares = duplicatesWithShares.reduce((sum, d) => {
  // Sum all shares except one copy (the original)
  const extraShares = d.totalShares - (d.totalShares / d.count);
  return sum + extraShares;
}, 0);

console.log(`\nTotal extra shares from duplicates: ${(totalExtraShares/1e6).toFixed(2)}M`);

// Check if this could cause the 50M spike
console.log(`\nIf these ${(totalExtraShares/1e6).toFixed(2)}M extra shares each earned rewards...`);
const avgRewardPerShare = 91000 / 100000000; // Daily pool / 100M shares
const daysActive = 88;
const totalExtraRewards = totalExtraShares * avgRewardPerShare * daysActive;
console.log(`They could accumulate ${(totalExtraRewards/1e6).toFixed(2)}M TORUS in extra rewards over 88 days`);