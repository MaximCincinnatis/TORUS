#!/usr/bin/env node

/**
 * STATUS: ACTIVE - Fetches penalty pool data from blockchain
 * PURPOSE: Get real penalty data to enable rewards after day 88
 * RUNS: Can be called by update scripts or run manually
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Contract configuration
const STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
const CONTRACT_ABI = [
  'function getCurrentDayIndex() view returns (uint24)',
  'function rewardPool(uint24 day) view returns (uint256)',
  'function totalShares(uint24 day) view returns (uint256)',
  'function penaltiesInRewardPool(uint24 day) view returns (uint256)'
];

// RPC endpoints
const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function fetchPenaltyData() {
  console.log('📊 Fetching penalty pool data from blockchain...\n');
  
  try {
    // Connect to Ethereum
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const contract = new ethers.Contract(STAKE_CONTRACT, CONTRACT_ABI, provider);
    
    // Get current protocol day
    const currentDay = await contract.getCurrentDayIndex();
    console.log(`Current protocol day: ${currentDay}`);
    
    // Load cached data
    const dataPath = path.join(__dirname, '../public/data/cached-data.json');
    const cachedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Fetch penalty data for current day + next 88 days
    const daysToFetch = Math.min(currentDay + 88, 365);
    console.log(`Fetching data for days ${currentDay} to ${daysToFetch}...\n`);
    
    const updatedRewardData = [];
    
    // Fetch in batches of 10 to avoid timeout
    for (let startDay = 1; startDay <= daysToFetch; startDay += 10) {
      const endDay = Math.min(startDay + 9, daysToFetch);
      console.log(`  Fetching days ${startDay}-${endDay}...`);
      
      const promises = [];
      for (let day = startDay; day <= endDay; day++) {
        promises.push(fetchDayData(contract, day));
      }
      
      const results = await Promise.all(promises);
      updatedRewardData.push(...results);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Show sample data
    console.log('\nSample data fetched:');
    [1, 50, 88, 89, currentDay].forEach(day => {
      const data = updatedRewardData.find(d => d.day === day);
      if (data) {
        console.log(`  Day ${day}: Base=${data.rewardPool.toFixed(2)}, Penalties=${data.penaltiesInPool.toFixed(2)}`);
      }
    });
    
    // Update cached data
    cachedData.stakingData.rewardPoolData = updatedRewardData;
    cachedData.lastUpdated = new Date().toISOString();
    
    // Backup and save
    const backupPath = dataPath.replace('.json', `-backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, fs.readFileSync(dataPath));
    fs.writeFileSync(dataPath, JSON.stringify(cachedData, null, 2));
    
    console.log('\n✅ Successfully updated reward pool data with penalties');
    console.log(`✅ Data now includes days 1-${daysToFetch}`);
    console.log(`📁 Backup saved to: ${path.basename(backupPath)}`);
    
  } catch (error) {
    console.error('❌ Error fetching penalty data:', error.message);
    process.exit(1);
  }
}

async function fetchDayData(contract, day) {
  try {
    const [rewardPool, totalShares, penalties] = await Promise.all([
      contract.rewardPool(day),
      contract.totalShares(day),
      contract.penaltiesInRewardPool(day)
    ]);
    
    // Calculate base reward (0 after day 88)
    const baseReward = day <= 88 ? parseFloat(ethers.utils.formatEther(rewardPool)) : 0;
    
    return {
      day,
      rewardPool: baseReward,
      totalShares: parseFloat(ethers.utils.formatEther(totalShares)),
      penaltiesInPool: parseFloat(ethers.utils.formatEther(penalties))
    };
  } catch (error) {
    console.error(`  ⚠️  Error fetching day ${day}:`, error.message);
    // Return calculated fallback
    return {
      day,
      rewardPool: calculateBaseReward(day),
      totalShares: 0,
      penaltiesInPool: 0
    };
  }
}

function calculateBaseReward(day) {
  if (day < 1 || day > 88) return 0;
  
  let reward = 100000;
  for (let i = 1; i < day; i++) {
    reward = reward * (1 - 0.0008);
  }
  return reward;
}

// Run if called directly
if (require.main === module) {
  fetchPenaltyData().catch(console.error);
}

module.exports = { fetchPenaltyData };