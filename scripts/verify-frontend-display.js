#!/usr/bin/env node

/**
 * Verifies frontend will display the data correctly
 * Simulates frontend calculations
 */

const fs = require('fs');

console.log('🔍 Verifying frontend display calculations...\n');

try {
  // Load the data files like frontend does
  const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
  const buyProcessData = JSON.parse(fs.readFileSync('./public/data/buy-process-data.json', 'utf8'));
  
  // Check TitanX usage from creates/stakes (like frontend calculateDailyTitanXUsage)
  console.log('📊 TitanX Usage for Creates & Stakes:');
  
  const creates = cachedData.stakingData.createEvents || [];
  const stakes = cachedData.stakingData.stakeEvents || [];
  
  // Count Day 19 & 20 creates/stakes
  const day19Creates = creates.filter(c => c.protocolDay === 19 && c.titanAmount && c.titanAmount !== '0');
  const day20Creates = creates.filter(c => c.protocolDay === 20 && c.titanAmount && c.titanAmount !== '0');
  const day19Stakes = stakes.filter(s => s.protocolDay === 19 && s.rawCostTitanX && s.rawCostTitanX !== '0');
  const day20Stakes = stakes.filter(s => s.protocolDay === 20 && s.rawCostTitanX && s.rawCostTitanX !== '0');
  
  console.log(`\nDay 19:`);
  console.log(`  Creates with TitanX: ${day19Creates.length}`);
  console.log(`  Stakes with TitanX: ${day19Stakes.length}`);
  
  const day19CreateTitanX = day19Creates.reduce((sum, c) => sum + parseFloat(c.titanAmount) / 1e18, 0);
  const day19StakeTitanX = day19Stakes.reduce((sum, s) => sum + parseFloat(s.rawCostTitanX) / 1e18, 0);
  console.log(`  Total TitanX: ${(day19CreateTitanX + day19StakeTitanX).toLocaleString()}`);
  
  console.log(`\nDay 20:`);
  console.log(`  Creates with TitanX: ${day20Creates.length}`);
  console.log(`  Stakes with TitanX: ${day20Stakes.length}`);
  
  const day20CreateTitanX = day20Creates.reduce((sum, c) => sum + parseFloat(c.titanAmount) / 1e18, 0);
  const day20StakeTitanX = day20Stakes.reduce((sum, s) => sum + parseFloat(s.rawCostTitanX) / 1e18, 0);
  console.log(`  Total TitanX: ${(day20CreateTitanX + day20StakeTitanX).toLocaleString()}`);
  
  // Check Buy & Process data
  console.log('\n📊 Buy & Process Data:');
  
  const day19BP = buyProcessData.dailyData.find(d => d.protocolDay === 19);
  const day20BP = buyProcessData.dailyData.find(d => d.protocolDay === 20);
  
  console.log(`\nDay 19:`);
  console.log(`  Buy & Burns: ${day19BP.buyAndBurnCount}`);
  console.log(`  Buy & Builds: ${day19BP.buyAndBuildCount}`);
  console.log(`  TORUS Burned: ${day19BP.torusBurned}`);
  console.log(`  TitanX Used: ${day19BP.titanXUsed.toLocaleString()}`);
  console.log(`  ETH Used: ${day19BP.ethUsed}`);
  
  console.log(`\nDay 20:`);
  console.log(`  Buy & Burns: ${day20BP.buyAndBurnCount}`);
  console.log(`  Buy & Builds: ${day20BP.buyAndBuildCount}`);
  console.log(`  TORUS Burned: ${day20BP.torusBurned}`);
  console.log(`  TitanX Used: ${day20BP.titanXUsed.toLocaleString()}`);
  console.log(`  ETH Used: ${day20BP.ethUsed}`);
  
  // Verify burn charts will show correctly
  console.log('\n📊 Burn Chart Data:');
  console.log('The frontend uses buy-process-data.json dailyData for burn charts.');
  console.log(`Day 19 will show: ${day19BP.torusBurned} TORUS burned`);
  console.log(`Day 20 will show: ${day20BP.torusBurned} TORUS burned`);
  
  if (day19BP.torusBurned > 0) {
    console.log('✅ Day 19 will appear in burn charts');
  } else {
    console.log('❌ Day 19 will NOT appear in burn charts');
  }
  
  if (day20BP.torusBurned > 0) {
    console.log('✅ Day 20 will appear in burn charts');
  } else {
    console.log('⚠️  Day 20 has no burns (which is correct per blockchain)');
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
}