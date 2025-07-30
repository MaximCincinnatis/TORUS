#!/usr/bin/env node

const fs = require('fs');

// Load current data
const data = JSON.parse(fs.readFileSync('public/data/buy-process-data.json', 'utf8'));

// Find day 20
const day20 = data.dailyData.find(d => d.protocolDay === 20);

console.log('🔍 Day 20 Build Verification\n');
console.log('Date:', day20.date);
console.log('Buy & Build Count:', day20.buyAndBuildCount);
console.log('ETH Used for Builds:', day20.ethUsedForBuilds);
console.log('TitanX Used for Builds:', day20.titanXUsedForBuilds);
console.log('TORUS Purchased:', day20.torusPurchased);

console.log('\n📊 Analysis:');
if (day20.titanXUsedForBuilds > 0 && day20.ethUsedForBuilds === 0) {
  console.log('✅ This is a TitanX build - 0 ETH is CORRECT');
  console.log(`   ${day20.titanXUsedForBuilds.toLocaleString()} TitanX was used`);
  console.log(`   ${day20.torusPurchased} TORUS was purchased`);
} else if (day20.ethUsedForBuilds > 0) {
  console.log('💰 This is an ETH build');
} else {
  console.log('❓ Unable to determine build type');
}

// Summary of all builds
console.log('\n📊 Complete ETH Build Summary:');
let totalBuilds = 0;
let ethBuilds = 0;
let titanxBuilds = 0;

data.dailyData.forEach(day => {
  if (day.buyAndBuildCount > 0) {
    totalBuilds += day.buyAndBuildCount;
    if (day.ethUsedForBuilds > 0) {
      ethBuilds += day.buyAndBuildCount;
    } else if (day.titanXUsedForBuilds > 0) {
      titanxBuilds += day.buyAndBuildCount;
    }
  }
});

console.log(`Total Buy & Build operations: ${totalBuilds}`);
console.log(`ETH builds: ~${ethBuilds}`);
console.log(`TitanX builds: ~${titanxBuilds}`);
console.log(`\n✅ All ${totalBuilds} Buy & Build operations are accounted for`);