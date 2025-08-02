#!/usr/bin/env node

/**
 * Simple verification script to ensure data integrity
 * Checks that historical data isn't being overwritten
 */

const fs = require('fs');

console.log('🔍 Verifying data integrity...\n');

try {
  // Load current data
  const data = JSON.parse(fs.readFileSync('./public/data/buy-process-data.json', 'utf8'));
  
  // Check critical days
  const criticalDays = [
    { day: 19, expectedBurns: 47.29, expectedBurnCount: 13 },
    { day: 20, expectedMinBurns: 40, expectedMinBurnCount: 4 }
  ];
  
  let allGood = true;
  
  criticalDays.forEach(check => {
    const dayData = data.dailyData.find(d => d.protocolDay === check.day);
    
    if (!dayData) {
      console.error(`❌ Day ${check.day} is missing!`);
      allGood = false;
      return;
    }
    
    console.log(`\n📊 Day ${check.day} (${dayData.date}):`);
    console.log(`  Burns: ${dayData.buyAndBurnCount} (expected: ${check.expectedBurnCount || check.expectedMinBurnCount}+)`);
    console.log(`  TORUS Burned: ${dayData.torusBurned} (expected: ${check.expectedBurns || check.expectedMinBurns}+)`);
    console.log(`  TitanX Used: ${dayData.titanXUsed.toLocaleString()}`);
    
    // Verify data
    if (check.expectedBurns && Math.abs(dayData.torusBurned - check.expectedBurns) > 0.01) {
      console.error(`  ❌ TORUS burned mismatch!`);
      allGood = false;
    } else if (check.expectedMinBurns && dayData.torusBurned < check.expectedMinBurns) {
      console.error(`  ❌ TORUS burned too low!`);
      allGood = false;
    }
    
    if (check.expectedBurnCount && dayData.buyAndBurnCount !== check.expectedBurnCount) {
      console.error(`  ❌ Burn count mismatch!`);
      allGood = false;
    } else if (check.expectedMinBurnCount && dayData.buyAndBurnCount < check.expectedMinBurnCount) {
      console.error(`  ❌ Burn count too low!`);
      allGood = false;
    }
    
    if (dayData.buyAndBurnCount === 0 && dayData.buyAndBuildCount === 0) {
      console.warn(`  ⚠️  No activity recorded for this day`);
    }
  });
  
  // Check for any days with suspicious zero data
  console.log('\n🔍 Checking for suspicious zero days...');
  const zeroDays = data.dailyData.filter(d => 
    d.protocolDay <= 20 && 
    d.buyAndBurnCount === 0 && 
    d.buyAndBuildCount === 0
  );
  
  if (zeroDays.length > 0) {
    console.warn(`\n⚠️  Found ${zeroDays.length} days with zero activity:`);
    zeroDays.forEach(d => {
      console.warn(`  - Day ${d.protocolDay} (${d.date})`);
    });
  }
  
  // Summary
  console.log('\n📈 Summary:');
  console.log(`  Total days: ${data.dailyData.length}`);
  console.log(`  Total burns: ${data.eventCounts.buyAndBurn}`);
  console.log(`  Total builds: ${data.eventCounts.buyAndBuild}`);
  console.log(`  Last update: ${data.lastUpdated}`);
  console.log(`  Last block: ${data.metadata.lastBlock}`);
  
  if (allGood) {
    console.log('\n✅ All critical data verified successfully!');
  } else {
    console.error('\n❌ Data integrity issues detected!');
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}