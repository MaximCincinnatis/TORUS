#!/usr/bin/env node

const fs = require('fs');

function validateNoDuplicates() {
  console.log('🔍 Validating Buy & Process Data for Duplicates\n');
  
  const data = JSON.parse(fs.readFileSync('public/data/buy-process-data.json', 'utf8'));
  
  // Check ETH values for builds
  const ethBuildValues = new Map();
  const titanXBuildValues = new Map();
  
  data.dailyData.forEach(day => {
    // Check ETH for builds
    if (day.ethUsedForBuilds > 0) {
      const key = day.ethUsedForBuilds.toFixed(6);
      if (!ethBuildValues.has(key)) {
        ethBuildValues.set(key, []);
      }
      ethBuildValues.get(key).push(day.protocolDay);
    }
    
    // Check TitanX for builds
    if (day.titanXUsedForBuilds > 0) {
      const key = day.titanXUsedForBuilds.toFixed(2);
      if (!titanXBuildValues.has(key)) {
        titanXBuildValues.set(key, []);
      }
      titanXBuildValues.get(key).push(day.protocolDay);
    }
  });
  
  let hasIssues = false;
  
  // Report ETH duplicates
  console.log('📊 ETH Used for Builds:');
  ethBuildValues.forEach((days, value) => {
    if (days.length > 1) {
      console.log(`  ❌ DUPLICATE: ${value} ETH appears on days: ${days.join(', ')}`);
      hasIssues = true;
    }
  });
  
  if (!hasIssues) {
    console.log('  ✅ No duplicate ETH values found');
  }
  
  // Check for suspicious patterns
  console.log('\n🔍 Pattern Analysis:');
  
  // Check for too many zero values
  const zeroEthDays = data.dailyData.filter(d => 
    d.buyAndBuildCount > 0 && d.ethUsedForBuilds === 0
  );
  
  if (zeroEthDays.length > 0) {
    console.log(`  ⚠️  ${zeroEthDays.length} days have builds but 0 ETH used`);
    console.log(`     Days: ${zeroEthDays.map(d => d.protocolDay).join(', ')}`);
  }
  
  // Summary
  console.log('\n📈 Summary:');
  console.log(`  Total days: ${data.dailyData.length}`);
  console.log(`  Days with builds: ${data.dailyData.filter(d => d.buyAndBuildCount > 0).length}`);
  console.log(`  Days with ETH builds: ${data.dailyData.filter(d => d.ethUsedForBuilds > 0).length}`);
  console.log(`  Total ETH for builds: ${data.totals.ethUsedForBuilds} ETH`);
  
  if (hasIssues) {
    console.log('\n❌ VALIDATION FAILED - Duplicate values detected!');
    console.log('   Run fix-eth-build-values-comprehensive.js to fix');
    process.exit(1);
  } else {
    console.log('\n✅ Validation passed - No duplicates found');
  }
}

// Add this to smart-update-fixed.js
if (require.main === module) {
  validateNoDuplicates();
} else {
  module.exports = { validateNoDuplicates };
}