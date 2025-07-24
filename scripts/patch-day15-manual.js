#!/usr/bin/env node

/**
 * Manual patch for Day 15 (July 24, 2025) missing TitanX data
 * Based on verified blockchain data
 * 
 * This is a one-time patch for historical data while we fix the update scripts
 */

const fs = require('fs');
const path = require('path');

function patchDay15Data() {
  console.log('📝 Applying manual patch for Day 15 TitanX data...\n');
  
  try {
    // Load current data
    const cachedDataPath = path.join(__dirname, '../public/data/cached-data.json');
    const cachedData = JSON.parse(fs.readFileSync(cachedDataPath, 'utf8'));
    
    // Create backup
    const backupPath = cachedDataPath.replace('.json', `-backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(cachedData, null, 2));
    console.log(`✅ Created backup: ${backupPath}\n`);
    
    // Manual patches based on blockchain verification
    const patches = [
      {
        user: '0xd0979b1b946140eab977cff9c89116bfabde2f14',
        torusAmount: '1979279587861555851135',
        titanXAmount: '20000000000', // 20 billion TitanX (simplified for display)
        titanXFormatted: '20000000000.0',
        ethAmount: '0',
        ethFormatted: '0.0'
      },
      {
        user: '0xe649bf6e4ddae04b60e015937a631d7d89dbcac2',
        torusAmount: '9896397939307779255',
        titanXAmount: '100000000', // 100 million TitanX
        titanXFormatted: '100000000.0',
        ethAmount: '0',
        ethFormatted: '0.0'
      },
      {
        user: '0x8599a6cab9617ffb12e6f11ad119caee7323a2c4',
        torusAmount: '39585591757231117022',
        titanXAmount: '400000000', // 400 million TitanX
        titanXFormatted: '400000000.0',
        ethAmount: '21351000000000000',
        ethFormatted: '0.021351'
      }
    ];
    
    let patchedCount = 0;
    
    // Apply patches
    cachedData.stakingData.createEvents.forEach(create => {
      const patch = patches.find(p => 
        p.user.toLowerCase() === create.user.toLowerCase() &&
        p.torusAmount === create.torusAmount
      );
      
      if (patch) {
        console.log(`Patching create for ${create.user}:`);
        console.log(`  TORUS: ${(parseFloat(create.torusAmount) / 1e18).toFixed(2)}`);
        console.log(`  Before: TitanX=${create.costTitanX}, ETH=${create.costETH}`);
        
        // Update all relevant fields
        create.costTitanX = patch.titanXFormatted;
        create.rawCostTitanX = patch.titanXAmount + '000000000000000000'; // Add 18 decimals
        create.costETH = patch.ethFormatted;
        create.rawCostETH = patch.ethAmount;
        
        // Update duplicate fields
        if (create.titanAmount !== undefined) {
          create.titanAmount = create.rawCostTitanX;
        }
        if (create.titanXAmount !== undefined) {
          create.titanXAmount = create.rawCostTitanX;
        }
        if (create.ethAmount !== undefined) {
          create.ethAmount = patch.ethAmount;
        }
        
        console.log(`  After: TitanX=${create.costTitanX}, ETH=${create.costETH}\n`);
        patchedCount++;
      }
    });
    
    if (patchedCount > 0) {
      // Update metadata
      cachedData.lastUpdated = new Date().toISOString();
      cachedData.metadata = cachedData.metadata || {};
      cachedData.metadata.day15ManualPatch = {
        applied: new Date().toISOString(),
        reason: 'Day 15 creates missing TitanX payment data',
        patchedCount: patchedCount
      };
      
      // Save updated data
      fs.writeFileSync(cachedDataPath, JSON.stringify(cachedData, null, 2));
      
      console.log(`✅ Successfully patched ${patchedCount} creates`);
      console.log('📊 Patch summary:');
      console.log('  - User ...bde2f14: 20 billion TitanX');
      console.log('  - User ...dbcac2: 100 million TitanX');
      console.log('  - User ...23a2c4: 400 million TitanX + 0.021 ETH\n');
      
      // Verify totals
      const CONTRACT_START = new Date(2025, 6, 10);
      CONTRACT_START.setHours(0, 0, 0, 0);
      
      const day15Creates = cachedData.stakingData.createEvents.filter(event => {
        const startDate = new Date(event.startDate);
        const day = Math.floor((startDate - CONTRACT_START) / (24 * 60 * 60 * 1000)) + 1;
        return day === 15;
      });
      
      const totalTitanX = day15Creates.reduce((sum, c) => 
        sum + parseFloat(c.costTitanX || 0), 0
      );
      
      console.log(`📈 Day 15 totals after patch:`);
      console.log(`  Total creates: ${day15Creates.length}`);
      console.log(`  Total TitanX: ${totalTitanX.toLocaleString()}\n`);
      
    } else {
      console.log('❌ No matching creates found to patch');
    }
    
  } catch (error) {
    console.error('❌ Error applying patch:', error);
    process.exit(1);
  }
}

// Run the patch
patchDay15Data();