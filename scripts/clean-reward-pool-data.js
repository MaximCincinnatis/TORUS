#!/usr/bin/env node

/**
 * Clean Reward Pool Data
 * This script cleans up the reward pool data by removing duplicates
 * and ensuring proper format
 */

const fs = require('fs');
const path = require('path');

// Constants from the contract
const INITIAL_REWARD_POOL = 100000; // 100,000 TORUS
const DAILY_REDUCTION_RATE = 0.0008; // 0.08%

function calculateRewardPoolForDay(day) {
  if (day < 1) return 0;
  
  let rewardPool = INITIAL_REWARD_POOL;
  for (let i = 1; i < day; i++) {
    rewardPool = rewardPool * (1 - DAILY_REDUCTION_RATE);
  }
  
  return rewardPool;
}

async function main() {
  console.log('=== CLEANING REWARD POOL DATA ===\n');
  
  try {
    // Load current data
    const dataPath = path.join(__dirname, '../public/data/cached-data.json');
    const currentData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Create backup
    const backupPath = dataPath.replace('.json', `-backup-before-clean-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(currentData, null, 2));
    console.log(`✅ Backup created: ${path.basename(backupPath)}`);
    
    // Check if rewardPoolData exists at top level
    if (currentData.rewardPoolData && Array.isArray(currentData.rewardPoolData)) {
      console.log(`Found top-level rewardPoolData with ${currentData.rewardPoolData.length} entries - removing...`);
      delete currentData.rewardPoolData;
    }
    
    // Ensure stakingData exists
    if (!currentData.stakingData) {
      currentData.stakingData = {};
    }
    
    // Clean up stakingData.rewardPoolData
    if (!currentData.stakingData.rewardPoolData) {
      currentData.stakingData.rewardPoolData = [];
    }
    
    console.log(`Processing stakingData.rewardPoolData with ${currentData.stakingData.rewardPoolData.length} entries...`);
    
    // Create a map to store the best data for each day
    const dayDataMap = new Map();
    
    // Process existing data in stakingData
    currentData.stakingData.rewardPoolData.forEach(dayData => {
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
      
      // Store the data for this day
      dayDataMap.set(day, {
        day,
        rewardPool,
        totalShares: totalShares || 2500000000, // Default if 0
        penaltiesInPool
      });
    });
    
    // Ensure we have data for days 1-88 at minimum
    for (let day = 1; day <= 88; day++) {
      if (!dayDataMap.has(day) || dayDataMap.get(day).rewardPool === 0) {
        const rewardPool = calculateRewardPoolForDay(day);
        const existing = dayDataMap.get(day) || {};
        dayDataMap.set(day, {
          day,
          rewardPool,
          totalShares: existing.totalShares || 2500000000,
          penaltiesInPool: existing.penaltiesInPool || 0
        });
      }
    }
    
    // Convert map to sorted array
    const cleanedRewardPoolData = Array.from(dayDataMap.values()).sort((a, b) => a.day - b.day);
    
    // Update the data
    currentData.stakingData.rewardPoolData = cleanedRewardPoolData;
    currentData.lastUpdated = new Date().toISOString();
    
    // Save cleaned data
    fs.writeFileSync(dataPath, JSON.stringify(currentData, null, 2));
    
    console.log('\n=== SUMMARY ===');
    console.log(`✅ Cleaned reward pool data: ${cleanedRewardPoolData.length} days`);
    console.log(`📊 Days with rewards (1-88): ${cleanedRewardPoolData.filter(d => d.day <= 88 && d.rewardPool > 0).length}`);
    console.log(`📊 Days with 0 rewards: ${cleanedRewardPoolData.filter(d => d.rewardPool === 0).length}`);
    
    // Show sample of cleaned data
    console.log('\nSample reward pool data after cleaning:');
    [1, 10, 20, 21, 22, 23, 30, 50, 88].forEach(day => {
      const dayData = cleanedRewardPoolData.find(d => d.day === day);
      if (dayData) {
        console.log(`  Day ${day}: ${dayData.rewardPool.toFixed(2)} TORUS`);
      }
    });
    
    console.log('\n✅ Reward pool data cleaned successfully!');
    
  } catch (error) {
    console.error('❌ Error cleaning reward pool data:', error);
  }
}

main();