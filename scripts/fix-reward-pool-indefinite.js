#!/usr/bin/env node

/**
 * Fix reward pool data to continue indefinitely
 * Rewards decline by 0.08% daily forever, not just until day 88
 */

const fs = require('fs');
const path = require('path');

// Constants
const INITIAL_REWARD_POOL = 100000; // 100,000 TORUS
const DAILY_REDUCTION_RATE = 0.0008; // 0.08%
const PROTOCOL_START = new Date('2025-07-10T18:00:00Z');

function calculateRewardPoolForDay(day) {
  if (day < 1) return 0;
  
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
  console.log('=== FIXING REWARD POOL DATA TO CONTINUE INDEFINITELY ===\n');
  
  try {
    // Load current data
    const dataPath = path.join(__dirname, '../public/data/cached-data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    if (!data.stakingData?.rewardPoolData) {
      console.error('❌ No reward pool data found');
      return;
    }
    
    const currentLength = data.stakingData.rewardPoolData.length;
    console.log(`Current reward pool data: ${currentLength} days`);
    
    // Fix existing data and extend to current day + 88
    const currentDay = Math.floor((Date.now() - PROTOCOL_START.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const targetDays = Math.min(currentDay + 88, 365); // Cap at 1 year for now
    
    console.log(`Current protocol day: ${currentDay}`);
    console.log(`Updating to include days 1-${targetDays}`);
    
    // Rebuild the array with correct values
    const rewardPoolData = [];
    for (let day = 1; day <= targetDays; day++) {
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
    
    // Update the data
    data.stakingData.rewardPoolData = rewardPoolData;
    
    // Show sample data to verify
    console.log('\nSample reward pool data (showing continuous decline):');
    [1, 10, 30, 50, 88, 100, 200, 365].forEach(day => {
      if (day <= targetDays) {
        const entry = rewardPoolData.find(d => d.day === day);
        if (entry) {
          console.log(`  Day ${day}: ${entry.rewardPool.toFixed(2)} TORUS`);
        }
      }
    });
    
    // Create backup
    const backupPath = dataPath.replace('.json', `-backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, fs.readFileSync(dataPath));
    console.log(`\n✅ Backup created: ${path.basename(backupPath)}`);
    
    // Save updated data
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log(`✅ Updated reward pool data to ${rewardPoolData.length} days`);
    
    // Show that rewards continue declining
    console.log('\n=== VERIFICATION ===');
    console.log('Rewards continue declining indefinitely:');
    console.log(`Day 88: ${calculateRewardPoolForDay(88).toFixed(2)} TORUS (NOT zero)`);
    console.log(`Day 365: ${calculateRewardPoolForDay(365).toFixed(2)} TORUS`);
    console.log(`Day 1000: ${calculateRewardPoolForDay(1000).toFixed(2)} TORUS`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();