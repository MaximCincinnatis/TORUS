#!/usr/bin/env node

/**
 * Fix missing shares data for create events
 * Fetches shares from blockchain for all creates without shares
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// RPC providers
const RPC_PROVIDERS = [
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.payload.de'
];

// Contract configuration
const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';

const STAKE_CONTRACT_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
    "name": "getStakePositions",
    "outputs": [{
      "components": [
        {"internalType": "uint256", "name": "stakeIndex", "type": "uint256"},
        {"internalType": "uint256", "name": "torusAmount", "type": "uint256"},
        {"internalType": "uint256", "name": "startTime", "type": "uint256"},
        {"internalType": "uint24", "name": "startDayIndex", "type": "uint24"},
        {"internalType": "uint256", "name": "endTime", "type": "uint256"},
        {"internalType": "uint256", "name": "shares", "type": "uint256"},
        {"internalType": "bool", "name": "claimedCreate", "type": "bool"},
        {"internalType": "bool", "name": "claimedStake", "type": "bool"},
        {"internalType": "uint256", "name": "costTitanX", "type": "uint256"},
        {"internalType": "uint256", "name": "costETH", "type": "uint256"},
        {"internalType": "uint256", "name": "rewards", "type": "uint256"},
        {"internalType": "uint256", "name": "penalties", "type": "uint256"},
        {"internalType": "uint256", "name": "claimedAt", "type": "uint256"},
        {"internalType": "bool", "name": "isCreate", "type": "bool"}
      ],
      "internalType": "struct StakeTorus[]",
      "name": "",
      "type": "tuple[]"
    }],
    "stateMutability": "view",
    "type": "function"
  }
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== FIXING MISSING CREATE SHARES ===\n');
  
  try {
    // Load current data
    const dataPath = path.join(__dirname, '../public/data/cached-data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    if (!data.stakingData?.createEvents) {
      console.error('❌ No create events found');
      return;
    }
    
    // Find creates without shares
    const createsWithoutShares = data.stakingData.createEvents.filter(c => !c.shares);
    console.log(`Found ${createsWithoutShares.length} creates without shares data`);
    
    if (createsWithoutShares.length === 0) {
      console.log('✅ All creates already have shares data');
      return;
    }
    
    // Get unique users from creates without shares
    const uniqueUsers = new Set(createsWithoutShares.map(c => c.user));
    console.log(`Need to query ${uniqueUsers.size} unique users`);
    
    // Connect to provider
    const provider = new ethers.providers.JsonRpcProvider(RPC_PROVIDERS[0]);
    console.log('✅ Connected to', RPC_PROVIDERS[0]);
    
    const stakeContract = new ethers.Contract(CREATE_STAKE_CONTRACT, STAKE_CONTRACT_ABI, provider);
    
    // Fetch positions for each user
    console.log('Fetching positions from blockchain...');
    const userPositions = new Map();
    let userCount = 0;
    
    for (const user of uniqueUsers) {
      userCount++;
      if (userCount % 10 === 0) {
        console.log(`Progress: ${userCount}/${uniqueUsers.size} users`);
      }
      
      try {
        await sleep(150); // Rate limiting
        const positions = await stakeContract.getStakePositions(user);
        
        if (positions.length > 0) {
          userPositions.set(user, positions);
        }
      } catch (error) {
        console.warn(`Error fetching positions for ${user}:`, error.message);
      }
    }
    
    console.log(`\n✅ Fetched positions for ${userPositions.size} users`);
    
    // Match creates with positions
    let fixedCount = 0;
    data.stakingData.createEvents.forEach(create => {
      if (!create.shares) {
        const positions = userPositions.get(create.user);
        if (positions) {
          const createTime = parseInt(create.timestamp);
          
          // Find matching position (within 5 minutes and isCreate = true)
          const matchingPosition = positions.find(pos => 
            Math.abs(Number(pos.startTime) - createTime) < 300 && pos.isCreate
          );
          
          if (matchingPosition) {
            create.shares = matchingPosition.shares.toString();
            fixedCount++;
          }
        }
      }
    });
    
    console.log(`\n✅ Fixed shares for ${fixedCount} creates`);
    
    // Create backup
    const backupPath = dataPath.replace('.json', `-backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, fs.readFileSync(dataPath));
    console.log(`✅ Backup created: ${path.basename(backupPath)}`);
    
    // Save updated data
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log('✅ Updated cached-data.json');
    
    // Summary
    const finalWithShares = data.stakingData.createEvents.filter(c => c.shares).length;
    console.log('\n=== SUMMARY ===');
    console.log(`Total creates: ${data.stakingData.createEvents.length}`);
    console.log(`Creates with shares: ${finalWithShares}`);
    console.log(`Creates still missing shares: ${data.stakingData.createEvents.length - finalWithShares}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();