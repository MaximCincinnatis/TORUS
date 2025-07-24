#!/usr/bin/env node

/**
 * Fetch accurate Day 14 TitanX payment data from blockchain
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function fetchDay14AccurateData() {
  console.log('🔍 Fetching accurate Day 14 data from blockchain...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
    const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
    
    // Load current data to get Day 14 creates
    const cachedDataPath = path.join(__dirname, '../public/data/cached-data.json');
    const cachedData = JSON.parse(fs.readFileSync(cachedDataPath, 'utf8'));
    
    // Create backup
    const backupPath = cachedDataPath.replace('.json', `-backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(cachedData, null, 2));
    console.log(`✅ Created backup: ${backupPath}\n`);
    
    const CONTRACT_START = new Date(2025, 6, 10);
    CONTRACT_START.setHours(0, 0, 0, 0);
    
    // Get Day 14 creates with 0 TitanX
    const day14Creates = cachedData.stakingData.createEvents.filter(c => {
      const startDate = new Date(c.startDate);
      const day = Math.floor((startDate - CONTRACT_START) / (24 * 60 * 60 * 1000)) + 1;
      return day === 14 && (!c.costTitanX || c.costTitanX === '0' || c.costTitanX === '0.0');
    });
    
    console.log(`Found ${day14Creates.length} Day 14 creates needing accurate data\n`);
    
    // Contract ABI for getStakePositions
    const contractABI = [
      'function getStakePositions(address user) view returns (tuple(uint256 stakeId, uint256 principal, uint256 endTime, uint256 shares, uint256 power, uint256 costETH, uint256 costTitanX, bool isCreate, bool claimedStake, bool claimedCreate, uint256 penaltyAmount)[])'
    ];
    
    const stakeContract = new ethers.Contract(CREATE_STAKE_CONTRACT, contractABI, provider);
    
    // Group by user for efficiency
    const userCreatesMap = new Map();
    day14Creates.forEach(create => {
      if (!userCreatesMap.has(create.user)) {
        userCreatesMap.set(create.user, []);
      }
      userCreatesMap.get(create.user).push(create);
    });
    
    console.log(`Processing ${userCreatesMap.size} unique users...\n`);
    
    let fixedCount = 0;
    let totalActualTitanX = 0;
    let totalActualETH = 0;
    
    // Process each user
    for (const [user, userCreates] of userCreatesMap) {
      try {
        console.log(`Fetching positions for ${user}...`);
        const positions = await stakeContract.getStakePositions(user);
        
        // Process each create for this user
        for (const create of userCreates) {
          const eventMaturityTime = Math.floor(new Date(create.maturityDate).getTime() / 1000);
          
          // Find matching position with wider window
          const matchingPosition = positions.find(pos => {
            if (!pos.isCreate) return false;
            const timeDiff = Math.abs(Number(pos.endTime) - eventMaturityTime);
            // Use 7-day window to be safe
            return timeDiff < 604800;
          });
          
          if (matchingPosition) {
            const oldTitanX = create.costTitanX || '0';
            const oldETH = create.costETH || '0';
            
            // Update with actual blockchain data
            if (matchingPosition.costETH.gt(0)) {
              create.costETH = ethers.utils.formatEther(matchingPosition.costETH);
              create.costTitanX = "0.0";
              create.rawCostETH = matchingPosition.costETH.toString();
              create.rawCostTitanX = "0";
              totalActualETH += parseFloat(create.costETH);
            } else {
              create.costETH = "0.0";
              create.costTitanX = ethers.utils.formatEther(matchingPosition.costTitanX);
              create.rawCostETH = "0";
              create.rawCostTitanX = matchingPosition.costTitanX.toString();
              totalActualTitanX += parseFloat(create.costTitanX);
            }
            
            // Update duplicate fields
            if (create.titanAmount !== undefined) {
              create.titanAmount = create.rawCostTitanX;
            }
            if (create.titanXAmount !== undefined) {
              create.titanXAmount = create.rawCostTitanX;
            }
            if (create.ethAmount !== undefined) {
              create.ethAmount = create.rawCostETH;
            }
            
            // Update shares
            create.shares = matchingPosition.shares.toString();
            
            console.log(`  ✅ Fixed create: ${(parseFloat(create.torusAmount) / 1e18).toFixed(2)} TORUS`);
            console.log(`     TitanX: ${oldTitanX} → ${create.costTitanX}`);
            console.log(`     ETH: ${oldETH} → ${create.costETH}`);
            fixedCount++;
          } else {
            console.log(`  ⚠️  No match for create: ${(parseFloat(create.torusAmount) / 1e18).toFixed(2)} TORUS`);
            // Log available positions for debugging
            const createPositions = positions.filter(p => p.isCreate);
            console.log(`     Available creates: ${createPositions.length}`);
            if (createPositions.length > 0) {
              console.log(`     Position end times:`, createPositions.map(p => 
                new Date(Number(p.endTime) * 1000).toISOString()
              ));
            }
          }
        }
        
        // Rate limit to avoid overwhelming RPC
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error(`  ❌ Error processing user ${user}:`, error.message);
      }
    }
    
    if (fixedCount > 0) {
      // Update metadata
      cachedData.lastUpdated = new Date().toISOString();
      cachedData.metadata = cachedData.metadata || {};
      cachedData.metadata.day14AccurateFix = {
        applied: new Date().toISOString(),
        fixedCount: fixedCount,
        totalTitanX: totalActualTitanX,
        totalETH: totalActualETH
      };
      
      // Save updated data
      fs.writeFileSync(cachedDataPath, JSON.stringify(cachedData, null, 2));
      
      console.log(`\n✅ Successfully fixed ${fixedCount} creates with accurate blockchain data`);
      console.log(`📊 Day 14 actual totals:`);
      console.log(`   TitanX: ${totalActualTitanX.toLocaleString()}`);
      console.log(`   ETH: ${totalActualETH.toFixed(6)}`);
      
      // Verify Day 14 totals
      const allDay14Creates = cachedData.stakingData.createEvents.filter(c => {
        const startDate = new Date(c.startDate);
        const day = Math.floor((startDate - CONTRACT_START) / (24 * 60 * 60 * 1000)) + 1;
        return day === 14;
      });
      
      const finalTitanX = allDay14Creates.reduce((sum, c) => 
        sum + parseFloat(c.costTitanX || 0), 0
      );
      
      console.log(`\n📈 Final Day 14 totals (all ${allDay14Creates.length} creates):`);
      console.log(`   Total TitanX: ${finalTitanX.toLocaleString()}`);
      
    } else {
      console.log('\n❌ No creates were fixed - positions may not be available yet');
    }
    
  } catch (error) {
    console.error('❌ Error fetching accurate data:', error);
    process.exit(1);
  }
}

// Run the fetch
fetchDay14AccurateData();