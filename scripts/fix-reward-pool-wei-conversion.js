#!/usr/bin/env node

/**
 * Fix reward pool data wei conversion
 * Converts reward pool values from wei to TORUS units
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

async function main() {
  console.log('=== FIXING REWARD POOL DATA WEI CONVERSION ===\n');
  
  try {
    // Load current data
    const dataPath = path.join(__dirname, '../public/data/cached-data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    if (!data.stakingData?.rewardPoolData) {
      console.error('❌ No reward pool data found');
      return;
    }
    
    console.log(`Found ${data.stakingData.rewardPoolData.length} days of reward pool data`);
    
    // Fix each entry
    data.stakingData.rewardPoolData = data.stakingData.rewardPoolData.map(entry => {
      // Convert from wei to TORUS (divide by 1e18)
      return {
        ...entry,
        rewardPool: parseFloat(ethers.utils.formatEther(entry.rewardPool.toString())),
        totalShares: parseFloat(ethers.utils.formatEther(entry.totalShares.toString())), 
        penaltiesInPool: parseFloat(ethers.utils.formatEther(entry.penaltiesInPool.toString()))
      };
    });
    
    // Show sample of fixed data
    console.log('\nSample of fixed data:');
    [1, 10, 50, 88].forEach(day => {
      const entry = data.stakingData.rewardPoolData.find(d => d.day === day);
      if (entry) {
        console.log(`  Day ${day}: ${entry.rewardPool.toFixed(2)} TORUS (${entry.totalShares.toFixed(2)} shares)`);
      }
    });
    
    // Verify day 1 is ~100,000 TORUS
    const day1 = data.stakingData.rewardPoolData.find(d => d.day === 1);
    if (day1) {
      console.log(`\n✅ Day 1 verification: ${day1.rewardPool.toFixed(2)} TORUS (should be ~100,000)`);
    }
    
    // Create backup
    const backupPath = dataPath.replace('.json', `-backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, fs.readFileSync(dataPath));
    console.log(`\n✅ Backup created: ${path.basename(backupPath)}`);
    
    // Save fixed data
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log('✅ Fixed reward pool data wei conversion');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();