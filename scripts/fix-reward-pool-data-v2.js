#!/usr/bin/env node

/**
 * Fix Reward Pool Data V2
 * This script properly fixes the reward pool data by handling wei format values
 * and removing duplicates
 */

const fs = require('fs');
const path = require('path');

// Constants from the contract
const INITIAL_REWARD_POOL = 100000; // 100,000 TORUS
const DAILY_REDUCTION_RATE = 0.0008; // 0.08%
const TOTAL_REWARD_DAYS = 365;

function calculateRewardPoolForDay(day) {
  if (day < 1) return 0;
  
  let rewardPool = INITIAL_REWARD_POOL;
  for (let i = 1; i < day; i++) {
    rewardPool = rewardPool * (1 - DAILY_REDUCTION_RATE);
  }
  
  return rewardPool;
}

async function main() {
  console.log('=== FIXING REWARD POOL DATA V2 ===\n');
  
  try {
    // Load current data
    const dataPath = path.join(__dirname, '../public/data/cached-data.json');
    const currentData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    if (!currentData.rewardPoolData) {
      console.error('❌ No rewardPoolData found in cached-data.json');
      return;
    }
    
    console.log(`Current reward pool data: ${currentData.rewardPoolData.length} entries`);
    
    // Create backup
    const backupPath = dataPath.replace('.json', `-backup-before-fix-v2-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(currentData, null, 2));
    console.log(`✅ Backup created: ${path.basename(backupPath)}`);
    
    // Create a map to store the best data for each day
    const dayDataMap = new Map();
    
    // Process existing data
    currentData.rewardPoolData.forEach(dayData => {
      const day = dayData.day;
      
      // Convert values from wei if needed
      let rewardPool = dayData.rewardPool;
      let totalShares = dayData.totalShares;
      let penaltiesInPool = dayData.penaltiesInPool || 0;
      
      // If value is in wei format (very large), convert it
      if (rewardPool > 1e10) {
        rewardPool = rewardPool / 1e18;
      }
      
      if (totalShares > 1e10) {
        totalShares = totalShares / 1e18;
      }
      
      if (penaltiesInPool > 1e10) {
        penaltiesInPool = penaltiesInPool / 1e18;
      }
      
      // For days 1-88, use calculated values if current is 0
      if (day <= 88 && rewardPool === 0) {
        rewardPool = calculateRewardPoolForDay(day);
      }
      
      // Store the best data for this day (prefer non-zero values)
      const existing = dayDataMap.get(day);
      if (!existing || (existing.rewardPool === 0 && rewardPool > 0)) {
        dayDataMap.set(day, {
          day,
          rewardPool,
          totalShares: totalShares || 2500000000, // Default if 0
          penaltiesInPool
        });
      }
    });
    
    // Ensure we have data for all days up to current day + 88
    const maxExistingDay = Math.max(...Array.from(dayDataMap.keys()));
    const targetDay = Math.min(Math.max(maxExistingDay, 110), TOTAL_REWARD_DAYS);
    
    console.log(`\nEnsuring data exists for days 1-${targetDay}...`);
    
    for (let day = 1; day <= targetDay; day++) {
      if (!dayDataMap.has(day)) {
        // Add missing day with calculated values
        const rewardPool = day <= 88 ? calculateRewardPoolForDay(day) : 0;
        dayDataMap.set(day, {
          day,
          rewardPool,
          totalShares: 2500000000, // Default from existing data pattern
          penaltiesInPool: 0
        });
      }
    }
    
    // Convert map to sorted array
    const fixedRewardPoolData = Array.from(dayDataMap.values()).sort((a, b) => a.day - b.day);
    
    // Update the data
    currentData.rewardPoolData = fixedRewardPoolData;
    currentData.lastUpdated = new Date().toISOString();
    
    // Save fixed data
    fs.writeFileSync(dataPath, JSON.stringify(currentData, null, 2));
    
    console.log('\n=== SUMMARY ===');
    console.log(`✅ Processed ${fixedRewardPoolData.length} days of reward pool data`);
    console.log(`📊 Days with rewards (1-88): ${fixedRewardPoolData.filter(d => d.day <= 88 && d.rewardPool > 0).length}`);
    console.log(`📊 Days with 0 rewards: ${fixedRewardPoolData.filter(d => d.rewardPool === 0).length}`);
    
    // Show sample of fixed data
    console.log('\nSample reward pool data after fix:');
    [1, 10, 20, 21, 22, 23, 30, 50, 88, 89, 90].forEach(day => {
      const dayData = fixedRewardPoolData.find(d => d.day === day);
      if (dayData) {
        console.log(`  Day ${day}: ${dayData.rewardPool.toFixed(2)} TORUS (shares: ${(dayData.totalShares / 1e6).toFixed(2)}M)`);
      }
    });
    
    console.log('\n✅ Reward pool data fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing reward pool data:', error);
  }
}

main();