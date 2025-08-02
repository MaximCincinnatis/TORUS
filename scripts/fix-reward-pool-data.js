#!/usr/bin/env node

/**
 * Fix Reward Pool Data
 * This script fixes the reward pool data by filling in calculated values
 * for days where the contract returns 0
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
  console.log('=== FIXING REWARD POOL DATA ===\n');
  
  try {
    // Load current data
    const dataPath = path.join(__dirname, '../public/data/cached-data.json');
    const currentData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    if (!currentData.rewardPoolData) {
      console.error('❌ No rewardPoolData found in cached-data.json');
      return;
    }
    
    console.log(`Current reward pool data: ${currentData.rewardPoolData.length} days`);
    
    // Create backup
    const backupPath = dataPath.replace('.json', `-backup-before-fix-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(currentData, null, 2));
    console.log(`✅ Backup created: ${path.basename(backupPath)}`);
    
    // Fix reward pool values
    let fixedCount = 0;
    let zeroCount = 0;
    
    currentData.rewardPoolData.forEach(dayData => {
      // Check if reward pool is 0 or in wei format
      if (dayData.rewardPool === 0 || dayData.rewardPool > 1e10) {
        const calculatedReward = calculateRewardPoolForDay(dayData.day);
        
        // If the value is in wei format (very large), convert it
        if (dayData.rewardPool > 1e10) {
          dayData.rewardPool = dayData.rewardPool / 1e18;
        }
        
        // If still 0 or incorrect, use calculated value
        if (dayData.rewardPool === 0 && dayData.day <= 88) {
          dayData.rewardPool = calculatedReward;
          fixedCount++;
        }
        
        if (dayData.rewardPool === 0) {
          zeroCount++;
        }
      }
      
      // Also fix totalShares if in wei format
      if (dayData.totalShares > 1e10) {
        dayData.totalShares = dayData.totalShares / 1e18;
      }
      
      // Fix penaltiesInPool if in wei format
      if (dayData.penaltiesInPool > 1e10) {
        dayData.penaltiesInPool = dayData.penaltiesInPool / 1e18;
      }
    });
    
    // Ensure we have data for all days up to current day + 88
    const maxDay = Math.max(...currentData.rewardPoolData.map(d => d.day));
    const targetDay = Math.min(maxDay + 88, TOTAL_REWARD_DAYS);
    
    console.log(`\nEnsuring data exists for days 1-${targetDay}...`);
    
    for (let day = 1; day <= targetDay; day++) {
      const existing = currentData.rewardPoolData.find(d => d.day === day);
      if (!existing) {
        // Add missing day with calculated values
        const rewardPool = day <= 88 ? calculateRewardPoolForDay(day) : 0;
        currentData.rewardPoolData.push({
          day,
          rewardPool,
          totalShares: 2500000000, // Default from existing data pattern
          penaltiesInPool: 0
        });
        fixedCount++;
      }
    }
    
    // Sort by day
    currentData.rewardPoolData.sort((a, b) => a.day - b.day);
    
    // Update timestamp
    currentData.lastUpdated = new Date().toISOString();
    
    // Save fixed data
    fs.writeFileSync(dataPath, JSON.stringify(currentData, null, 2));
    
    console.log('\n=== SUMMARY ===');
    console.log(`✅ Fixed ${fixedCount} days with calculated reward values`);
    console.log(`📊 Total days with 0 rewards: ${zeroCount} (expected after day 88)`);
    console.log(`📊 Total days in data: ${currentData.rewardPoolData.length}`);
    
    // Show sample of fixed data
    console.log('\nSample reward pool data after fix:');
    [1, 10, 20, 21, 22, 23, 50, 88].forEach(day => {
      const dayData = currentData.rewardPoolData.find(d => d.day === day);
      if (dayData) {
        console.log(`  Day ${day}: ${dayData.rewardPool.toFixed(2)} TORUS`);
      }
    });
    
    console.log('\n✅ Reward pool data fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing reward pool data:', error);
  }
}

main();