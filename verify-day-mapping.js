#!/usr/bin/env node

const fs = require('fs');
const { ethers } = require('ethers');

// Load cached data
const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));

console.log('🔍 Verifying Day Mapping\n');

// Get the first create to determine protocol start
const firstCreate = data.stakingData.createEvents
  .sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp))[0];

const firstTimestamp = parseInt(firstCreate.timestamp);
const firstDate = new Date(firstTimestamp * 1000);

console.log(`First create timestamp: ${firstTimestamp}`);
console.log(`First create date: ${firstDate.toISOString()}`);

// Protocol likely started at 18:00 UTC on July 10, 2025
const PROTOCOL_START = Math.floor(new Date('2025-07-10T18:00:00Z').getTime() / 1000);
console.log(`\nAssumed protocol start: ${new Date(PROTOCOL_START * 1000).toISOString()}`);

// Calculate days
console.log('\n=== DAY MAPPING ===');
for (let day = 1; day <= 15; day++) {
  const dayStart = PROTOCOL_START + ((day - 1) * 86400);
  const dayEnd = dayStart + 86400;
  const dateStr = new Date(dayStart * 1000).toISOString().split('T')[0];
  
  console.log(`Day ${day}: ${dateStr} (${new Date(dayStart * 1000).toISOString()} to ${new Date(dayEnd * 1000).toISOString()})`);
}

// Now find July 24 creates
const july24Start = Math.floor(new Date('2025-07-24T00:00:00Z').getTime() / 1000);
const july24End = july24Start + 86400;

console.log('\n=== JULY 24, 2025 CREATES ===');
const july24Creates = data.stakingData.createEvents.filter(c => {
  const timestamp = parseInt(c.timestamp);
  return timestamp >= july24Start && timestamp < july24End;
});

console.log(`Total creates on July 24: ${july24Creates.length}`);

// Check TitanX amounts
let zeroTitanX = 0;
let nonZeroTitanX = 0;
let totalTitanX = ethers.BigNumber.from(0);

july24Creates.forEach(c => {
  const titanAmount = c.titanAmount || c.titanXAmount || c.costTitanX || '0';
  
  if (titanAmount === '0' || titanAmount === 0) {
    zeroTitanX++;
  } else {
    nonZeroTitanX++;
    try {
      totalTitanX = totalTitanX.add(titanAmount.toString());
    } catch (e) {}
  }
});

console.log(`Creates with 0 TitanX: ${zeroTitanX}`);
console.log(`Creates with non-zero TitanX: ${nonZeroTitanX}`);
console.log(`Total TitanX: ${ethers.utils.formatEther(totalTitanX)}`);

// Show specific users mentioned
console.log('\n=== SPECIFIC USERS ON JULY 24 ===');
const specificUsers = ['0xd0979b1b', '0xe649bf6e', '0x8599a6ca'];

july24Creates.forEach(c => {
  const user = (c.user || c.owner || '').toLowerCase();
  if (specificUsers.some(u => user.startsWith(u))) {
    const torusAmount = parseFloat(ethers.utils.formatEther(c.torusAmount || c.principal || '0'));
    const titanAmount = c.titanAmount || c.titanXAmount || c.costTitanX || '0';
    const ethAmount = c.ethAmount || c.costETH || '0';
    
    console.log(`\nUser: ${user}`);
    console.log(`  TORUS: ${torusAmount.toFixed(2)}`);
    console.log(`  TitanX: ${titanAmount} (formatted: ${parseFloat(ethers.utils.formatEther(titanAmount)).toFixed(2)})`);
    console.log(`  ETH: ${ethAmount}`);
    console.log(`  Timestamp: ${new Date(parseInt(c.timestamp) * 1000).toISOString()}`);
    console.log(`  Block: ${c.blockNumber}`);
    console.log(`  Tx: ${c.transactionHash}`);
  }
});

// Show a few examples of July 24 creates
console.log('\n=== SAMPLE JULY 24 CREATES ===');
july24Creates.slice(0, 5).forEach((c, i) => {
  const titanAmount = c.titanAmount || c.titanXAmount || c.costTitanX || '0';
  const ethAmount = c.ethAmount || c.costETH || '0';
  
  console.log(`\n${i + 1}. User: ${c.user || c.owner}`);
  console.log(`   Time: ${new Date(parseInt(c.timestamp) * 1000).toISOString()}`);
  console.log(`   TORUS: ${parseFloat(ethers.utils.formatEther(c.torusAmount || c.principal || '0')).toFixed(2)}`);
  console.log(`   TitanX: ${titanAmount}`);
  console.log(`   ETH: ${ethAmount}`);
});