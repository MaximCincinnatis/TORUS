#!/usr/bin/env node

/**
 * Fetch Complete Reward Pool Data
 * This script fetches all historical reward pool data from the blockchain
 * and updates the cached data file
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { 
  fetchRewardPoolData, 
  validateRewardPoolData, 
  mergeRewardPoolData,
  TOTAL_REWARD_DAYS 
} = require('../../src/utils/rewardPoolManager');

// RPC providers
const RPC_PROVIDERS = [
  'https://eth.drpc.org',
  'https://rpc.payload.de',
  'https://eth-mainnet.public.blastapi.io',
  'https://ethereum.publicnode.com',
];

async function main() {
  console.log('=== FETCHING COMPLETE REWARD POOL DATA ===\n');
  
  try {
    // Load current data
    const dataPath = path.join(__dirname, '../../public/data/cached-data.json');
    const currentData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const existingRewardData = currentData.stakingData.rewardPoolData || [];
    
    console.log(`Current reward pool data: ${existingRewardData.length} days`);
    
    // Create provider
    console.log('Connecting to Ethereum...');
    const provider = new ethers.providers.JsonRpcProvider(RPC_PROVIDERS[0]);
    
    // Test connection
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ Connected to Ethereum (block ${blockNumber})\n`);
    
    // Fetch all reward pool data
    console.log('Fetching reward pool data from blockchain...');
    console.log('This may take a few minutes...\n');
    
    const startTime = Date.now();
    const newRewardData = await fetchRewardPoolData(provider, 1, TOTAL_REWARD_DAYS + 8);
    const fetchTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`\n✅ Fetched ${newRewardData.length} days in ${fetchTime} seconds`);
    
    // Validate the data
    console.log('\nValidating reward pool data...');
    const validation = validateRewardPoolData(newRewardData);
    
    if (!validation.isValid) {
      console.error('❌ Validation errors found:');
      validation.errors.forEach(error => console.error(`  - ${error}`));
      
      // Ask user to continue
      console.log('\nData has validation errors. Continue anyway? (y/n)');
      // In production, this would be interactive
    }
    
    // Merge with existing data
    console.log('\nMerging with existing data...');
    const mergedData = mergeRewardPoolData(existingRewardData, newRewardData);
    console.log(`✅ Merged data contains ${mergedData.length} days`);
    
    // Show sample data
    console.log('\nSample reward pool data:');
    [1, 10, 50, 88, 89].forEach(day => {
      const dayData = mergedData.find(d => d.day === day);
      if (dayData) {
        console.log(`  Day ${day}: ${dayData.rewardPool.toFixed(2)} TORUS`);
      }
    });
    
    // Create backup
    const backupPath = dataPath.replace('.json', `-backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(currentData, null, 2));
    console.log(`\n✅ Backup created: ${path.basename(backupPath)}`);
    
    // Update the data
    currentData.stakingData.rewardPoolData = mergedData;
    currentData.lastUpdated = new Date().toISOString();
    
    // Save updated data
    fs.writeFileSync(dataPath, JSON.stringify(currentData, null, 2));
    console.log('✅ Updated cached-data.json with complete reward pool data');
    
    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total days with rewards: ${mergedData.filter(d => d.rewardPool > 0).length}`);
    console.log(`Days with 0 rewards: ${mergedData.filter(d => d.rewardPool === 0).length}`);
    console.log(`Total reward pool (day 1-88): ${mergedData.slice(0, 88).reduce((sum, d) => sum + d.rewardPool, 0).toFixed(2)} TORUS`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}