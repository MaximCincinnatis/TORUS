#!/usr/bin/env node

/**
 * One-time script to fix all historical totalShares in rewardPoolData
 * This recalculates totalShares for all protocol days based on actual position data
 */

const fs = require('fs');
const path = require('path');
const { calculateTotalSharesForDay } = require('./shared/totalSharesCalculator');

async function main() {
  console.log('=== FIXING HISTORICAL TOTALSHARES IN REWARD POOL DATA ===\n');
  
  try {
    // Load current data
    const dataPath = path.join(__dirname, '../public/data/cached-data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    if (!data.stakingData?.rewardPoolData) {
      console.error('❌ No reward pool data found in cached-data.json');
      process.exit(1);
    }
    
    if (!data.stakingData?.createEvents || !data.stakingData?.stakeEvents) {
      console.error('❌ No create/stake events found in cached-data.json');
      process.exit(1);
    }
    
    // Create backup
    const backupPath = dataPath.replace('.json', `-backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, fs.readFileSync(dataPath));
    console.log(`✅ Backup created: ${path.basename(backupPath)}`);
    
    // Get position data
    const creates = data.stakingData.createEvents;
    const stakes = data.stakingData.stakeEvents;
    console.log(`\n📊 Processing ${creates.length} creates and ${stakes.length} stakes`);
    
    // Track changes
    let updated = 0;
    let zeroShareDays = 0;
    
    // Update each day's totalShares
    console.log('\n🔄 Recalculating totalShares for each protocol day...');
    
    data.stakingData.rewardPoolData.forEach(dayData => {
      const oldTotalShares = dayData.totalShares || 0;
      const newTotalShares = calculateTotalSharesForDay(creates, stakes, dayData.day);
      
      if (Math.abs(oldTotalShares - newTotalShares) > 0.01) {
        console.log(`  Day ${dayData.day}: ${oldTotalShares.toFixed(2)} → ${newTotalShares.toFixed(2)}`);
        dayData.totalShares = newTotalShares;
        updated++;
      }
      
      if (newTotalShares === 0) {
        zeroShareDays++;
      }
    });
    
    console.log(`\n✅ Updated totalShares for ${updated} days`);
    console.log(`ℹ️  Days with 0 shares: ${zeroShareDays} (normal for early/future days)`);
    
    // Show some statistics
    const activeDays = data.stakingData.rewardPoolData.filter(d => d.totalShares > 0);
    if (activeDays.length > 0) {
      const maxSharesDay = activeDays.reduce((max, d) => d.totalShares > max.totalShares ? d : max);
      const avgShares = activeDays.reduce((sum, d) => sum + d.totalShares, 0) / activeDays.length;
      
      console.log('\n📊 Statistics:');
      console.log(`  - Days with active shares: ${activeDays.length}`);
      console.log(`  - Average totalShares: ${avgShares.toFixed(2)}`);
      console.log(`  - Peak totalShares: ${maxSharesDay.totalShares.toFixed(2)} (Day ${maxSharesDay.day})`);
    }
    
    // Save updated data
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log('\n✅ Updated cached-data.json with correct totalShares');
    
    // Verify a sample day
    const sampleDay = 10;
    const sampleTotalShares = calculateTotalSharesForDay(creates, stakes, sampleDay);
    const sampleRewardData = data.stakingData.rewardPoolData.find(d => d.day === sampleDay);
    
    console.log(`\n🔍 Verification - Day ${sampleDay}:`);
    console.log(`  - Calculated totalShares: ${sampleTotalShares.toFixed(2)}`);
    console.log(`  - Saved totalShares: ${sampleRewardData?.totalShares?.toFixed(2) || 'N/A'}`);
    console.log(`  - Match: ${Math.abs((sampleRewardData?.totalShares || 0) - sampleTotalShares) < 0.01 ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();