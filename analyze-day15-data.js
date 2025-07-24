#!/usr/bin/env node

const fs = require('fs');
const { ethers } = require('ethers');

// Load cached data
const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));

console.log('🔍 Analyzing Day 15 Data\n');

// Protocol start from the contract
const PROTOCOL_START = 1720634400; // July 10, 2025 18:00:00 UTC

// Calculate Day 15 range
const day15Start = PROTOCOL_START + (14 * 86400);
const day15End = day15Start + 86400;

console.log(`Protocol Start: ${new Date(PROTOCOL_START * 1000).toISOString()}`);
console.log(`Day 15 Start: ${new Date(day15Start * 1000).toISOString()}`);
console.log(`Day 15 End: ${new Date(day15End * 1000).toISOString()}`);

// Find creates in Day 15
const day15Creates = data.stakingData.createEvents.filter(c => {
  const timestamp = parseInt(c.timestamp);
  return timestamp >= day15Start && timestamp < day15End;
});

console.log(`\n📊 Day 15 Creates: ${day15Creates.length}`);

// Analyze TitanX usage
let totalTitanX = ethers.BigNumber.from(0);
let totalETH = ethers.BigNumber.from(0);
let zeroTitanXCount = 0;

console.log('\n=== ALL DAY 15 CREATES ===');
day15Creates.forEach((create, index) => {
  const titanAmount = create.titanAmount || create.titanXAmount || create.costTitanX || '0';
  const ethAmount = create.ethAmount || create.costETH || '0';
  
  if (titanAmount === '0' || titanAmount === 0) {
    zeroTitanXCount++;
  }
  
  try {
    totalTitanX = totalTitanX.add(titanAmount.toString());
    totalETH = totalETH.add(ethAmount.toString());
  } catch (e) {
    console.log(`Error processing amounts for create ${index}:`, e.message);
  }
  
  const torusAmount = parseFloat(ethers.utils.formatEther(create.torusAmount || create.principal || '0'));
  const titanX = parseFloat(ethers.utils.formatEther(titanAmount));
  const eth = parseFloat(ethers.utils.formatEther(ethAmount));
  
  console.log(`\n${index + 1}. ${new Date(parseInt(create.timestamp) * 1000).toISOString()}`);
  console.log(`   User: ${create.user || create.owner}`);
  console.log(`   TORUS: ${torusAmount.toFixed(2)}`);
  console.log(`   TitanX: ${titanX.toFixed(2)} (raw: ${titanAmount})`);
  console.log(`   ETH: ${eth.toFixed(6)} (raw: ${ethAmount})`);
  console.log(`   Block: ${create.blockNumber}`);
  console.log(`   Tx: ${create.transactionHash}`);
});

console.log('\n=== SUMMARY ===');
console.log(`Total Creates: ${day15Creates.length}`);
console.log(`Creates with 0 TitanX: ${zeroTitanXCount}`);
console.log(`Total TitanX: ${ethers.utils.formatEther(totalTitanX)}`);
console.log(`Total ETH: ${ethers.utils.formatEther(totalETH)}`);

// Check for specific users
const specificUsers = ['0xd0979b1b', '0xe649bf6e', '0x8599a6ca'];
console.log('\n=== SPECIFIC USERS ===');
specificUsers.forEach(userPrefix => {
  const userCreates = day15Creates.filter(c => 
    (c.user || c.owner || '').toLowerCase().startsWith(userPrefix)
  );
  
  if (userCreates.length > 0) {
    console.log(`\nUser ${userPrefix}:`);
    userCreates.forEach(c => {
      const torusAmount = parseFloat(ethers.utils.formatEther(c.torusAmount || c.principal || '0'));
      const titanAmount = c.titanAmount || c.titanXAmount || c.costTitanX || '0';
      const ethAmount = c.ethAmount || c.costETH || '0';
      
      console.log(`  TORUS: ${torusAmount.toFixed(2)}`);
      console.log(`  TitanX: ${titanAmount} (${parseFloat(ethers.utils.formatEther(titanAmount)).toFixed(2)} TITANX)`);
      console.log(`  ETH: ${ethAmount}`);
      console.log(`  Tx: ${c.transactionHash}`);
    });
  }
});

// Check daily summaries if they exist
if (data.dailySummaries && data.dailySummaries[14]) {
  console.log('\n=== DAILY SUMMARY FOR DAY 15 ===');
  console.log(JSON.stringify(data.dailySummaries[14], null, 2));
}