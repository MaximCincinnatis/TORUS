#!/usr/bin/env node

const fs = require('fs');

console.log('🔧 FIXING LP FEE PROTOCOL DAY CALCULATION');
console.log('=======================================\n');

// Load LP fee burn data
const dataPath = './public/data/buy-process-burns.json';
const lpFeeBurnData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Backup original
const backupPath = `./public/data/buy-process-burns-backup-${Date.now()}.json`;
fs.writeFileSync(backupPath, JSON.stringify(lpFeeBurnData, null, 2));
console.log(`✅ Created backup at: ${backupPath}`);

// Contract start date for protocol day calculation
const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z'); // July 10, 2025 at 6 PM UTC

// Fix protocol days for all entries
console.log('\n📅 FIXING PROTOCOL DAYS:');

lpFeeBurnData.feeDrivenBurns.forEach((burn, index) => {
  const burnDate = new Date(burn.timestamp * 1000);
  
  // Calculate protocol day properly
  const burnDayUTC = new Date(burnDate.getUTCFullYear(), burnDate.getUTCMonth(), burnDate.getUTCDate());
  burnDayUTC.setUTCHours(18, 0, 0, 0); // 6 PM UTC boundary
  
  // If the burn happened before 6 PM UTC, it's still the previous day
  if (burnDate.getTime() < burnDayUTC.getTime()) {
    burnDayUTC.setUTCDate(burnDayUTC.getUTCDate() - 1);
  }
  
  const msPerDay = 24 * 60 * 60 * 1000;
  const protocolDay = Math.max(1, Math.floor((burnDayUTC.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1);
  
  const oldDay = burn.protocolDay;
  burn.protocolDay = protocolDay;
  
  console.log(`  ${index + 1}. ${burn.date.split('T')[0]}`);
  console.log(`     - Burn time: ${burnDate.toISOString()}`);
  console.log(`     - Day boundary: ${burnDayUTC.toISOString()}`);
  console.log(`     - Protocol day: ${oldDay} → ${protocolDay}`);
  console.log(`     - TORUS burned: ${burn.torusBurned}`);
});

// Save the fixed data
fs.writeFileSync(dataPath, JSON.stringify(lpFeeBurnData, null, 2));
console.log(`\n✅ Fixed data saved to: ${dataPath}`);

// Show updated summary
console.log('\n📊 UPDATED SUMMARY:');
console.log(`  Total collections: ${lpFeeBurnData.totals.feeCollections}`);
console.log(`  Total TORUS burned: ${lpFeeBurnData.totals.torusBurned}`);
console.log(`  Total TitanX collected: ${lpFeeBurnData.totals.titanxCollected}`);

console.log('\n📈 COLLECTION TIMELINE:');
lpFeeBurnData.feeDrivenBurns.forEach((burn, i) => {
  console.log(`  ${i + 1}. Day ${burn.protocolDay} (${burn.date.split('T')[0]}): ${parseFloat(burn.torusBurned).toFixed(2)} TORUS`);
});

console.log('\n🎉 Fix complete!');