#!/usr/bin/env node

/**
 * Manual patch for Day 14 (July 23, 2025) missing TitanX data
 * Temporary fix while we investigate the full issue
 */

const fs = require('fs');
const path = require('path');

function patchDay14Data() {
  console.log('📝 Applying manual patch for Day 14 TitanX data...\n');
  
  try {
    // Load current data
    const cachedDataPath = path.join(__dirname, '../public/data/cached-data.json');
    const cachedData = JSON.parse(fs.readFileSync(cachedDataPath, 'utf8'));
    
    // Create backup
    const backupPath = cachedDataPath.replace('.json', `-backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(cachedData, null, 2));
    console.log(`✅ Created backup: ${backupPath}\n`);
    
    // For Day 14, we'll apply estimated values based on TORUS amounts
    // Typical ratio from other days: ~1 TORUS = 10M TitanX
    const CONTRACT_START = new Date(2025, 6, 10);
    CONTRACT_START.setHours(0, 0, 0, 0);
    
    const day14Creates = cachedData.stakingData.createEvents.filter(c => {
      const startDate = new Date(c.startDate);
      const day = Math.floor((startDate - CONTRACT_START) / (24 * 60 * 60 * 1000)) + 1;
      return day === 14 && (!c.costTitanX || c.costTitanX === '0' || c.costTitanX === '0.0');
    });
    
    console.log(`Found ${day14Creates.length} Day 14 creates with 0 TitanX\n`);
    
    let patchedCount = 0;
    let totalEstimatedTitanX = 0;
    
    // Apply estimated TitanX based on TORUS amount
    day14Creates.forEach(create => {
      const torusAmount = parseFloat(create.torusAmount) / 1e18;
      // Use conservative estimate: 1 TORUS ≈ 10M TitanX
      const estimatedTitanX = torusAmount * 10000000;
      
      console.log(`Patching create for ${create.user.slice(0, 10)}...`);
      console.log(`  TORUS: ${torusAmount.toFixed(2)}`);
      console.log(`  Estimated TitanX: ${estimatedTitanX.toLocaleString()}`);
      
      create.costTitanX = estimatedTitanX.toFixed(2);
      create.rawCostTitanX = (estimatedTitanX * 1e18).toString();
      
      // Update duplicate fields
      if (create.titanAmount !== undefined) {
        create.titanAmount = create.rawCostTitanX;
      }
      if (create.titanXAmount !== undefined) {
        create.titanXAmount = create.rawCostTitanX;
      }
      
      totalEstimatedTitanX += estimatedTitanX;
      patchedCount++;
    });
    
    if (patchedCount > 0) {
      // Update metadata
      cachedData.lastUpdated = new Date().toISOString();
      cachedData.metadata = cachedData.metadata || {};
      cachedData.metadata.day14ManualPatch = {
        applied: new Date().toISOString(),
        reason: 'Day 14 creates missing TitanX payment data - applied estimates',
        patchedCount: patchedCount,
        note: 'Estimated at 10M TitanX per TORUS based on typical ratios'
      };
      
      // Save updated data
      fs.writeFileSync(cachedDataPath, JSON.stringify(cachedData, null, 2));
      
      console.log(`\n✅ Successfully patched ${patchedCount} creates`);
      console.log(`📊 Total estimated TitanX for Day 14: ${totalEstimatedTitanX.toLocaleString()}\n`);
      
      console.log('⚠️  Note: These are ESTIMATES based on typical TORUS:TitanX ratios');
      console.log('    Actual values may differ. Full blockchain verification needed.\n');
    }
    
  } catch (error) {
    console.error('❌ Error applying patch:', error);
    process.exit(1);
  }
}

// Run the patch
patchDay14Data();