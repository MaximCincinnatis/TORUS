#!/usr/bin/env node

/**
 * Add calculated reward pool data for days 1-88
 * Uses the formula: 100,000 * (0.9992)^(day-1)
 */

const fs = require('fs');
const path = require('path');

// Constants
const INITIAL_REWARD_POOL = 100000; // 100,000 TORUS
const DAILY_REDUCTION_RATE = 0.0008; // 0.08%
const PROTOCOL_START = new Date('2025-07-10T18:00:00Z');

function calculateRewardPoolForDay(day) {
  if (day < 1) return 0;
  if (day > 88) return 0; // Base rewards end after day 88
  
  let rewardPool = INITIAL_REWARD_POOL;
  for (let i = 1; i < day; i++) {
    rewardPool = rewardPool * (1 - DAILY_REDUCTION_RATE);
  }
  
  return rewardPool;
}

function getDateForProtocolDay(day) {
  const date = new Date(PROTOCOL_START);
  date.setDate(date.getDate() + day - 1);
  return date.toISOString();
}

async function main() {
  console.log('=== ADDING CALCULATED REWARD POOL DATA ===\n');
  
  try {
    // Load current data
    const dataPath = path.join(__dirname, '../public/data/cached-data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Initialize stakingData if needed
    if (!data.stakingData) {
      data.stakingData = {};
    }
    
    // Calculate reward pool data for days 1-88
    const rewardPoolData = [];
    for (let day = 1; day <= 88; day++) {
      const rewardPool = calculateRewardPoolForDay(day);
      rewardPoolData.push({
        day,
        date: getDateForProtocolDay(day),
        rewardPool,
        totalShares: 0, // Will be fetched from blockchain later
        penaltiesInPool: 0, // Will be fetched from blockchain later
        calculated: true,
        lastUpdated: new Date().toISOString()
      });
    }
    
    // Add future projections up to current day + 88
    const currentDay = Math.floor((Date.now() - PROTOCOL_START.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    console.log(`Current protocol day: ${currentDay}`);
    
    for (let day = 89; day <= Math.min(currentDay + 88, 365); day++) {
      rewardPoolData.push({
        day,
        date: getDateForProtocolDay(day),
        rewardPool: 0, // Base rewards end after day 88
        totalShares: 0,
        penaltiesInPool: 0,
        calculated: true,
        lastUpdated: new Date().toISOString()
      });
    }
    
    // Set the reward pool data
    data.stakingData.rewardPoolData = rewardPoolData;
    
    // Show sample data
    console.log('\nSample reward pool data:');
    [1, 10, 30, 50, 88, 89].forEach(day => {
      const entry = rewardPoolData.find(d => d.day === day);
      if (entry) {
        console.log(`  Day ${day}: ${entry.rewardPool.toFixed(2)} TORUS`);
      }
    });
    
    // Create backup
    const backupPath = dataPath.replace('.json', `-backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, fs.readFileSync(dataPath));
    console.log(`\n✅ Backup created: ${path.basename(backupPath)}`);
    
    // Save updated data
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log(`✅ Added ${rewardPoolData.length} days of calculated reward pool data`);
    
    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total days: ${rewardPoolData.length}`);
    console.log(`Days with rewards (1-88): 88`);
    console.log(`Days with 0 rewards: ${rewardPoolData.length - 88}`);
    const totalRewards = rewardPoolData.slice(0, 88).reduce((sum, d) => sum + d.rewardPool, 0);
    console.log(`Total base rewards (days 1-88): ${totalRewards.toFixed(2)} TORUS`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();