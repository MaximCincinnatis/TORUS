#!/usr/bin/env node

/**
 * Updates TitanX/ETH cost information for creates
 * The Created event doesn't include payment info, so we need to fetch it from position data
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Contract configuration
const STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
const CONTRACT_ABI = [
  'function getStakePositions(address user) view returns (tuple(uint256 principal, uint256 power, uint24 stakingDays, uint256 startTime, uint24 startDayIndex, uint256 endTime, uint256 shares, bool claimedCreate, bool claimedStake, uint256 costTitanX, uint256 costETH, uint256 rewards, uint256 penalties, uint256 claimedAt, bool isCreate)[])'
];

// RPC endpoints
const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function updateCreateCosts() {
  console.log('💰 Updating TitanX/ETH costs for creates...\n');
  
  try {
    // Connect to Ethereum
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const contract = new ethers.Contract(STAKE_CONTRACT, CONTRACT_ABI, provider);
    
    // Load cached data
    const dataPath = path.join(__dirname, '../public/data/cached-data.json');
    const cachedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Get all unique users from creates
    const createUsers = new Set();
    cachedData.stakingData.createEvents.forEach(c => {
      if (c.user) createUsers.add(c.user.toLowerCase());
    });
    
    console.log(`Found ${createUsers.size} unique users with creates`);
    console.log('Fetching position data...\n');
    
    // Fetch positions for all users
    const userPositions = new Map();
    let processed = 0;
    const batchSize = 5;
    const users = Array.from(createUsers);
    
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      
      const promises = batch.map(async (user) => {
        try {
          const positions = await contract.getStakePositions(user);
          return { user, positions };
        } catch (error) {
          console.error(`  Error fetching positions for ${user}:`, error.message);
          return { user, positions: [] };
        }
      });
      
      const results = await Promise.all(promises);
      results.forEach(({ user, positions }) => {
        userPositions.set(user, positions);
      });
      
      processed = Math.min(i + batchSize, users.length);
      process.stdout.write(`\r  Processing users: ${processed}/${users.length} (${((processed / users.length) * 100).toFixed(1)}%)`);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('\n\n📊 Updating create costs...');
    
    let updatedCount = 0;
    let notFoundCount = 0;
    
    // Update each create with cost information
    cachedData.stakingData.createEvents.forEach(event => {
      const userPos = userPositions.get(event.user?.toLowerCase());
      if (userPos && userPos.length > 0) {
        const eventMaturityTime = Math.floor(new Date(event.maturityDate).getTime() / 1000);
        
        // Find matching position (isCreate = true, similar end time)
        const matchingPosition = userPos.find(pos => 
          Math.abs(Number(pos.endTime) - eventMaturityTime) < 86400 && pos.isCreate
        );
        
        if (matchingPosition) {
          // Users pay EITHER ETH OR TitanX, not both
          if (matchingPosition.costETH.gt(0)) {
            event.costETH = ethers.utils.formatEther(matchingPosition.costETH);
            event.costTitanX = "0.0";
            event.rawCostETH = matchingPosition.costETH.toString();
            event.rawCostTitanX = "0";
            event.titanAmount = "0";
            event.ethAmount = matchingPosition.costETH.toString();
          } else {
            event.costETH = "0.0";
            event.costTitanX = ethers.utils.formatEther(matchingPosition.costTitanX);
            event.rawCostETH = "0";
            event.rawCostTitanX = matchingPosition.costTitanX.toString();
            event.titanAmount = matchingPosition.costTitanX.toString();
            event.titanXAmount = matchingPosition.costTitanX.toString();
            event.ethAmount = "0";
          }
          event.shares = matchingPosition.shares.toString();
          updatedCount++;
        } else {
          notFoundCount++;
        }
      }
    });
    
    console.log(`\n✅ Updated ${updatedCount} creates with cost information`);
    console.log(`⚠️  Could not find position data for ${notFoundCount} creates`);
    
    // Show sample of updated creates
    const updatedCreates = cachedData.stakingData.createEvents.filter(c => 
      (c.rawCostTitanX && c.rawCostTitanX !== "0") || (c.rawCostETH && c.rawCostETH !== "0")
    );
    
    console.log(`\n📊 Sample of creates with costs:`);
    updatedCreates.slice(-5).forEach(c => {
      const date = new Date(c.timestamp * 1000);
      if (c.rawCostTitanX && c.rawCostTitanX !== "0") {
        console.log(`  ${date.toISOString()} - ${(parseFloat(c.rawCostTitanX) / 1e18).toFixed(2)} TitanX`);
      } else if (c.rawCostETH && c.rawCostETH !== "0") {
        console.log(`  ${date.toISOString()} - ${(parseFloat(c.rawCostETH) / 1e18).toFixed(4)} ETH`);
      }
    });
    
    // Update last modified time
    cachedData.lastUpdated = new Date().toISOString();
    
    // Backup and save
    const backupPath = dataPath.replace('.json', `-backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, fs.readFileSync(dataPath));
    fs.writeFileSync(dataPath, JSON.stringify(cachedData, null, 2));
    
    console.log(`\n✅ Successfully updated create costs`);
    console.log(`📁 Backup saved to: ${path.basename(backupPath)}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
updateCreateCosts().catch(console.error);