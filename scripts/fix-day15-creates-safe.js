#!/usr/bin/env node

/**
 * Safe fix for Day 15 missing TitanX data
 * This script carefully updates only the specific creates that are missing payment data
 * without disrupting the overall data structure
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function analyzeAndFixDay15() {
  console.log('🔍 Analyzing Day 15 create payment data issue...\n');
  
  try {
    // Load current data
    const cachedDataPath = path.join(__dirname, '../public/data/cached-data.json');
    const cachedData = JSON.parse(fs.readFileSync(cachedDataPath, 'utf8'));
    
    // Backup data first
    const backupPath = cachedDataPath.replace('.json', `-backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(cachedData, null, 2));
    console.log(`✅ Created backup: ${backupPath}\n`);
    
    // Find Day 15 creates with 0 TitanX
    const CONTRACT_START = new Date(2025, 6, 10);
    CONTRACT_START.setHours(0, 0, 0, 0);
    
    const day15Creates = cachedData.stakingData.createEvents.filter(event => {
      const startDate = new Date(event.startDate);
      const day = Math.floor((startDate - CONTRACT_START) / (24 * 60 * 60 * 1000)) + 1;
      return day === 15 && (!event.costTitanX || event.costTitanX === "0" || event.costTitanX === "0.0");
    });
    
    console.log(`Found ${day15Creates.length} Day 15 creates with 0 TitanX\n`);
    
    if (day15Creates.length === 0) {
      console.log('✅ No Day 15 creates need fixing');
      return;
    }
    
    // Set up provider and contract
    const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
    const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
    
    const contractABI = [
      'function getStakePositions(address user) view returns (tuple(uint256 stakeId, uint256 principal, uint256 endTime, uint256 shares, uint256 power, uint256 costETH, uint256 costTitanX, bool isCreate, bool claimedStake, bool claimedCreate, uint256 penaltyAmount)[])'
    ];
    
    const stakeContract = new ethers.Contract(CREATE_STAKE_CONTRACT, contractABI, provider);
    
    // Process each user's positions
    const usersToCheck = [...new Set(day15Creates.map(c => c.user))];
    console.log(`Checking ${usersToCheck.length} unique users...\n`);
    
    let fixedCount = 0;
    
    for (const user of usersToCheck) {
      try {
        console.log(`Checking positions for ${user}...`);
        const positions = await stakeContract.getStakePositions(user);
        
        // Find creates for this user on Day 15
        const userDay15Creates = day15Creates.filter(c => c.user === user);
        
        for (const create of userDay15Creates) {
          const eventMaturityTime = Math.floor(new Date(create.maturityDate).getTime() / 1000);
          
          // Find matching position (with wider time window)
          const matchingPosition = positions.find(pos => 
            pos.isCreate && 
            Math.abs(Number(pos.endTime) - eventMaturityTime) < 172800 // 2 days window
          );
          
          if (matchingPosition) {
            const oldTitanX = create.costTitanX;
            const oldETH = create.costETH;
            
            // Update payment data
            if (matchingPosition.costETH.gt(0)) {
              create.costETH = ethers.utils.formatEther(matchingPosition.costETH);
              create.costTitanX = "0.0";
              create.rawCostETH = matchingPosition.costETH.toString();
              create.rawCostTitanX = "0";
            } else {
              create.costETH = "0.0";
              create.costTitanX = ethers.utils.formatEther(matchingPosition.costTitanX);
              create.rawCostETH = "0";
              create.rawCostTitanX = matchingPosition.costTitanX.toString();
            }
            
            // Also update duplicate fields if they exist
            if (create.titanAmount !== undefined) {
              create.titanAmount = create.rawCostTitanX;
            }
            if (create.ethAmount !== undefined) {
              create.ethAmount = create.rawCostETH;
            }
            
            console.log(`  ✅ Fixed create ${create.torusAmount} TORUS`);
            console.log(`     TitanX: ${oldTitanX} → ${create.costTitanX}`);
            console.log(`     ETH: ${oldETH} → ${create.costETH}`);
            fixedCount++;
          } else {
            console.log(`  ⚠️  No matching position found for create ${create.torusAmount} TORUS`);
          }
        }
        
        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`  ❌ Error processing user ${user}:`, error.message);
      }
    }
    
    if (fixedCount > 0) {
      // Update timestamp
      cachedData.lastUpdated = new Date().toISOString();
      
      // Save updated data
      fs.writeFileSync(cachedDataPath, JSON.stringify(cachedData, null, 2));
      console.log(`\n✅ Fixed ${fixedCount} creates with correct payment data`);
      
      // Verify the fix
      console.log('\n🔍 Verifying Day 15 TitanX totals...');
      const updatedDay15Creates = cachedData.stakingData.createEvents.filter(event => {
        const startDate = new Date(event.startDate);
        const day = Math.floor((startDate - CONTRACT_START) / (24 * 60 * 60 * 1000)) + 1;
        return day === 15;
      });
      
      const totalTitanX = updatedDay15Creates.reduce((sum, c) => 
        sum + parseFloat(c.costTitanX || 0), 0
      );
      
      console.log(`Total Day 15 TitanX from creates: ${totalTitanX.toLocaleString()}`);
      
    } else {
      console.log('\n❌ No creates were fixed - manual intervention may be needed');
    }
    
  } catch (error) {
    console.error('❌ Error in fix process:', error);
    process.exit(1);
  }
}

// Run the fix
analyzeAndFixDay15();