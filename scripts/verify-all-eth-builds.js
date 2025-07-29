#!/usr/bin/env node

const fs = require('fs');

// Load current data
const data = JSON.parse(fs.readFileSync('public/data/buy-process-data.json', 'utf8'));

console.log('🔍 VERIFYING ALL ETH BUILD VALUES - DAYS 1-20\n');
console.log('===============================================\n');

// Track totals
let totalETHBuilds = 0;
let totalTitanXBuilds = 0;
let totalBuildOps = 0;
let totalETHUsed = 0;

console.log('Day | Date       | Builds | ETH Used      | TitanX Used    | Type    | Status');
console.log('----|------------|--------|---------------|----------------|---------|-------');

for (let day = 1; day <= 20; day++) {
  const dayData = data.dailyData.find(d => d.protocolDay === day);
  
  if (!dayData) {
    console.log(`${day.toString().padStart(3)} | MISSING    |      - |             - |              - |       - | ❌`);
    continue;
  }
  
  if (dayData.buyAndBuildCount === 0) {
    console.log(`${day.toString().padStart(3)} | ${dayData.date} |      0 |             - |              - |    None | ✅`);
    continue;
  }
  
  totalBuildOps += dayData.buyAndBuildCount;
  
  // Determine build type
  let buildType = 'Unknown';
  let status = '❌';
  
  if (dayData.ethUsedForBuilds > 0) {
    buildType = 'ETH';
    totalETHBuilds += dayData.buyAndBuildCount;
    totalETHUsed += dayData.ethUsedForBuilds;
    status = '✅';
  } else if (dayData.titanXUsedForBuilds > 0) {
    buildType = 'TitanX';
    totalTitanXBuilds += dayData.buyAndBuildCount;
    status = '✅';
  } else {
    status = '❌ MISSING';
  }
  
  const ethStr = dayData.ethUsedForBuilds > 0 ? dayData.ethUsedForBuilds.toFixed(10) : '-';
  const titanStr = dayData.titanXUsedForBuilds > 0 ? (dayData.titanXUsedForBuilds / 1e6).toFixed(2) + 'M' : '-';
  
  console.log(`${day.toString().padStart(3)} | ${dayData.date} | ${dayData.buyAndBuildCount.toString().padStart(6)} | ${ethStr.padStart(13)} | ${titanStr.padStart(14)} | ${buildType.padStart(7)} | ${status}`);
}

console.log('\n===============================================');
console.log('📊 SUMMARY\n');

console.log(`Total Buy & Build Operations: ${totalBuildOps}`);
console.log(`  - ETH Builds: ${totalETHBuilds}`);
console.log(`  - TitanX Builds: ${totalTitanXBuilds}`);
console.log(`  - Missing/Unknown: ${totalBuildOps - totalETHBuilds - totalTitanXBuilds}`);
console.log(`\nTotal ETH Used: ${totalETHUsed.toFixed(6)} ETH`);

// Verify specific ETH values
console.log('\n🔍 ETH VALUE VERIFICATION:');

const ethBuilds = data.dailyData.filter(d => d.ethUsedForBuilds > 0);
const ethValueCounts = {};

ethBuilds.forEach(day => {
  const key = day.ethUsedForBuilds.toFixed(10);
  if (!ethValueCounts[key]) {
    ethValueCounts[key] = [];
  }
  ethValueCounts[key].push(day.protocolDay);
});

console.log('\nETH Value         | Days with this value');
console.log('------------------|---------------------');
Object.entries(ethValueCounts).forEach(([value, days]) => {
  console.log(`${value} | Days: ${days.join(', ')}`);
});

// Check against JSON totals
console.log('\n📊 TOTAL VERIFICATION:');
const jsonTotal = parseFloat(data.totals.ethUsedForBuilds);
console.log(`JSON Total ETH for Builds: ${jsonTotal}`);
console.log(`Calculated Total: ${totalETHUsed}`);
console.log(`Match: ${Math.abs(jsonTotal - totalETHUsed) < 0.000001 ? '✅' : '❌'}`);

// List any days with builds but no payment
const problemDays = data.dailyData.filter(d => 
  d.buyAndBuildCount > 0 && 
  d.ethUsedForBuilds === 0 && 
  d.titanXUsedForBuilds === 0
);

if (problemDays.length > 0) {
  console.log('\n⚠️  PROBLEM DAYS (Builds with no payment):');
  problemDays.forEach(d => {
    console.log(`  Day ${d.protocolDay}: ${d.buyAndBuildCount} builds with no ETH or TitanX`);
  });
} else {
  console.log('\n✅ All builds have associated payments (ETH or TitanX)');
}

console.log('\n✅ VERIFICATION COMPLETE');