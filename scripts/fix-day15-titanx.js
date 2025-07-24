#\!/usr/bin/env node

/**
 * Fix Day 15 TitanX usage data
 * The cached data shows 0 TitanX for all Day 15 creates, but blockchain shows significant usage
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function fixDay15TitanX() {
  console.log('🔧 Fixing Day 15 TitanX usage data...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
    
    // Load cached data
    const cachedDataPath = path.join(__dirname, '../public/data/cached-data.json');
    const cachedData = JSON.parse(fs.readFileSync(cachedDataPath, 'utf8'));
    
    // Known Day 15 creates with TitanX amounts from blockchain verification
    const day15Fixes = [
      {
        user: '0xd0979b1b946140eab977cff9c89116bfabde2f14',
        torusAmount: '1979279587861555851135',
        titanXAmount: '20000000000000000000000000000', // 20 billion TitanX
        ethAmount: '0'
      },
      {
        user: '0xe649bf6e4ddae04b60e015937a631d7d89dbcac2',
        torusAmount: '9896397939307779255',
        titanXAmount: '100000000000000000000000000', // 100 million TitanX
        ethAmount: '0'
      },
      {
        user: '0x8599a6cab9617ffb12e6f11ad119caee7323a2c4',
        torusAmount: '39585591757231117022',
        titanXAmount: '400000000000000000000000000', // 400 million TitanX
        ethAmount: '21351000000000000' // 0.021351 ETH
      }
    ];
    
    // Update creates
    let updated = 0;
    cachedData.stakingData.createEvents.forEach(create => {
      const fix = day15Fixes.find(f => 
        f.user.toLowerCase() === create.user.toLowerCase() &&
        f.torusAmount === create.torusAmount
      );
      
      if (fix) {
        console.log(`Fixing create for ${create.user}:`);
        console.log(`  Before: TitanX=${create.costTitanX}, ETH=${create.costETH}`);
        
        create.costTitanX = ethers.utils.formatEther(fix.titanXAmount);
        create.rawCostTitanX = fix.titanXAmount;
        create.costETH = ethers.utils.formatEther(fix.ethAmount);
        create.rawCostETH = fix.ethAmount;
        
        console.log(`  After: TitanX=${create.costTitanX}, ETH=${create.costETH}\n`);
        updated++;
      }
    });
    
    if (updated > 0) {
      // Update timestamp
      cachedData.lastUpdated = new Date().toISOString();
      
      // Save updated data
      fs.writeFileSync(cachedDataPath, JSON.stringify(cachedData, null, 2));
      console.log(`✅ Fixed ${updated} Day 15 creates with correct TitanX amounts`);
      
      // Also run smart update to propagate changes
      console.log('\n🔄 Running smart update to propagate changes...');
      const { execSync } = require('child_process');
      execSync('node smart-update-fixed.js', { stdio: 'inherit' });
    } else {
      console.log('❌ No matching creates found to fix');
    }
    
  } catch (error) {
    console.error('❌ Error fixing Day 15 data:', error);
    process.exit(1);
  }
}

fixDay15TitanX();
