#!/usr/bin/env node

/**
 * STATUS: PROPOSED - Simple solution for reward pool data
 * PURPOSE: Updates reward pool data using contract formula
 * COMPLEXITY: Minimal - just what we need
 */

const fs = require('fs');
const path = require('path');

// Simple and direct approach
function fixRewardPoolData() {
  console.log('Fixing reward pool data (simple approach)...\n');
  
  // Load data
  const dataPath = path.join(__dirname, '../public/data/cached-data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  
  // Calculate all 88 days
  const INITIAL = 100000;
  const DAILY_REDUCTION = 0.0008;
  let currentReward = INITIAL;
  
  const rewardPoolData = [];
  
  // Days 1-88 have rewards
  for (let day = 1; day <= 88; day++) {
    rewardPoolData.push({
      day: day,
      rewardPool: currentReward,
      totalShares: 808558839.0090909, // Default, will be updated by blockchain fetch
      penaltiesInPool: 0
    });
    
    currentReward = currentReward * (1 - DAILY_REDUCTION);
  }
  
  // Days 89+ have no rewards
  for (let day = 89; day <= 96; day++) {
    rewardPoolData.push({
      day: day,
      rewardPool: 0,
      totalShares: 0,
      penaltiesInPool: 0
    });
  }
  
  // Update data
  data.stakingData.rewardPoolData = rewardPoolData;
  
  // Save with backup
  const backup = dataPath.replace('.json', '-backup.json');
  fs.writeFileSync(backup, fs.readFileSync(dataPath));
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  
  console.log('✅ Done! Reward pools updated for days 1-88');
  console.log(`📁 Backup saved to: ${path.basename(backup)}`);
}

// Run it
if (require.main === module) {
  fixRewardPoolData();
}