#!/usr/bin/env node

/**
 * Verify that all charts will show correct protocol day labels
 */

const fs = require('fs');
const path = require('path');

function verifyChartLabels() {
  console.log('🏷️  CHART LABEL VERIFICATION\n');
  console.log('=' .repeat(60) + '\n');
  
  // Load the data files
  const buyProcessData = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/data/buy-process-data.json'), 'utf8'));
  const lpBurnsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/data/buy-process-burns.json'), 'utf8'));
  
  console.log('1. Buy & Process Data Days:');
  console.log('-'.repeat(40));
  console.log(`First entry: ${buyProcessData.dailyData[0].date} = Day ${buyProcessData.dailyData[0].protocolDay}`);
  console.log(`Last entry: ${buyProcessData.dailyData[buyProcessData.dailyData.length - 1].date} = Day ${buyProcessData.dailyData[buyProcessData.dailyData.length - 1].protocolDay}`);
  
  console.log('\n2. LP Fee Burns Days:');
  console.log('-'.repeat(40));
  if (lpBurnsData.feeDrivenBurns && lpBurnsData.feeDrivenBurns.length > 0) {
    lpBurnsData.feeDrivenBurns.forEach(burn => {
      const date = burn.date.split('T')[0];
      console.log(`${date} = Day ${burn.protocolDay} (${parseFloat(burn.torusBurned).toFixed(2)} TORUS)`);
    });
  } else {
    console.log('No LP fee burns data');
  }
  
  console.log('\n3. Expected Chart Labels:');
  console.log('-'.repeat(40));
  console.log('Charts should now show:');
  console.log('- X-axis: "07-10 (Day 1)", "07-12 (Day 2)", etc.');
  console.log('- Current day should be Day 16 (not Day 17 as before)');
  console.log('- No duplicate Day 1 entries');
  
  console.log('\n4. Data Integrity Check:');
  console.log('-'.repeat(40));
  
  // Check for sequential protocol days
  const protocolDays = buyProcessData.dailyData.map(d => d.protocolDay);
  const isSequential = protocolDays.every((day, index) => {
    if (index === 0) return day === 1;
    return day === protocolDays[index - 1] + 1;
  });
  
  if (isSequential) {
    console.log('✅ Protocol days are sequential (1, 2, 3, ...)');
  } else {
    console.log('❌ Protocol days are NOT sequential');
    console.log(`   Days found: ${protocolDays.join(', ')}`);
  }
  
  // Check date consistency
  const CONTRACT_START = new Date('2025-07-10T18:00:00.000Z');
  const firstDate = new Date(buyProcessData.dailyData[0].date + 'T18:00:00.000Z');
  
  if (firstDate.getTime() === CONTRACT_START.getTime()) {
    console.log('✅ First date aligns with contract start (July 10, 6 PM UTC)');
  } else {
    console.log('⚠️  First date does not align with contract start');
  }
}

// Run verification
verifyChartLabels();