#!/usr/bin/env node

/**
 * Quick validation of Day 19 fix
 * Checks if the rebuild resolved the ETH attribution issue
 */

const fs = require('fs');

function validateDay19Fix() {
  console.log('🔍 Validating Day 19 ETH Attribution Fix\n');
  
  try {
    // Read current buy-process data
    const dataPath = './public/data/buy-process-data.json';
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Find Day 19 data
    const day19 = data.dailyData.find(d => d.protocolDay === 19);
    
    if (!day19) {
      console.log('❌ Day 19 data not found');
      return;
    }
    
    console.log('=== DAY 19 DATA VALIDATION ===');
    console.log(`Protocol Day: ${day19.protocolDay}`);
    console.log(`Date: ${day19.date}`);
    console.log(`ETH Used for Burns: ${day19.ethUsedForBurns}`);
    console.log(`Buy & Burn Count: ${day19.buyAndBurnCount}`);
    console.log(`Buy & Build Count: ${day19.buyAndBuildCount}`);
    
    // Expected values based on our audit
    const expectedETH = 0.069475; // From actual blockchain audit
    const expectedBurns = 13; // From event count
    
    const ethDifference = Math.abs(day19.ethUsedForBurns - expectedETH);
    const burnCountMatch = day19.buyAndBurnCount === expectedBurns;
    
    console.log('\n=== VALIDATION RESULTS ===');
    
    if (ethDifference < 0.000001) {
      console.log('✅ ETH Amount: CORRECT');
      console.log(`   Expected: ${expectedETH.toFixed(6)} ETH`);
      console.log(`   Actual: ${day19.ethUsedForBurns} ETH`);
      console.log(`   Difference: ${ethDifference.toFixed(8)} ETH (within tolerance)`);
    } else {
      console.log('❌ ETH Amount: DISCREPANCY STILL EXISTS');
      console.log(`   Expected: ${expectedETH.toFixed(6)} ETH`);
      console.log(`   Actual: ${day19.ethUsedForBurns} ETH`);
      console.log(`   Difference: ${ethDifference.toFixed(6)} ETH`);
    }
    
    if (burnCountMatch) {
      console.log('✅ Burn Count: CORRECT');
      console.log(`   Expected: ${expectedBurns} burns`);
      console.log(`   Actual: ${day19.buyAndBurnCount} burns`);
    } else {
      console.log('❌ Burn Count: MISMATCH');
      console.log(`   Expected: ${expectedBurns} burns`);
      console.log(`   Actual: ${day19.buyAndBurnCount} burns`);
    }
    
    // Check if fix metadata is present
    if (data.metadata?.fixApplied || data.metadata?.rebuildDate) {
      console.log('\n=== FIX STATUS ===');
      if (data.metadata.fixApplied) {
        console.log(`✅ Fix Applied: ${data.metadata.fixApplied}`);
        console.log(`📅 Fix Date: ${data.metadata.fixDate}`);
      }
      if (data.metadata.rebuildDate) {
        console.log(`🔄 Rebuild Date: ${data.metadata.rebuildDate}`);
        console.log(`📊 Reason: ${data.metadata.rebuildReason}`);
      }
    } else {
      console.log('\n⚠️  No fix metadata found - may still be using old data');
    }
    
    // Overall status
    console.log('\n=== OVERALL STATUS ===');
    if (ethDifference < 0.000001 && burnCountMatch) {
      console.log('🎉 DAY 19 FIX: SUCCESSFUL');
      console.log('   ETH attribution issue has been resolved');
    } else {
      console.log('⚠️  DAY 19 FIX: NEEDS ATTENTION');
      console.log('   Some discrepancies still exist');
      
      if (data.metadata?.rebuildDate) {
        console.log('   Rebuild was attempted but may not have completed successfully');
      } else {
        console.log('   Rebuild may still be in progress or not yet applied');
      }
    }
    
  } catch (error) {
    console.error('❌ Error during validation:', error);
  }
}

validateDay19Fix();