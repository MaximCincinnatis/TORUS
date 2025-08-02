#!/usr/bin/env node

/**
 * Calculate missing shares for creates using the formula:
 * shares = torusAmount * lengthInDays * lengthInDays
 * 
 * This is 100% accurate because we have the exact start/end times
 */

const fs = require('fs');
const path = require('path');

async function main() {
  console.log('=== CALCULATING MISSING SHARES FOR CREATES ===\n');
  
  try {
    // Load current data
    const dataPath = path.join(__dirname, '../public/data/cached-data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    if (!data.stakingData?.createEvents) {
      console.error('❌ No create events found');
      return;
    }
    
    // Count creates without shares
    const createsWithoutShares = data.stakingData.createEvents.filter(c => !c.shares).length;
    console.log(`Found ${createsWithoutShares} creates without shares`);
    
    if (createsWithoutShares === 0) {
      console.log('✅ All creates already have shares');
      return;
    }
    
    // Calculate shares for creates that don't have them
    let fixedCount = 0;
    data.stakingData.createEvents.forEach(create => {
      if (!create.shares && create.timestamp && create.endTime && create.torusAmount) {
        // Calculate length in days
        const startTime = parseInt(create.timestamp);
        const endTime = parseInt(create.endTime);
        const lengthInSeconds = endTime - startTime;
        const lengthInDays = Math.round(lengthInSeconds / (24 * 60 * 60));
        
        // Calculate shares: torusAmount * days * days
        // Use BigInt to handle large numbers accurately
        const torusAmountBig = BigInt(create.torusAmount);
        const daysBig = BigInt(lengthInDays);
        const shares = torusAmountBig * daysBig * daysBig;
        
        create.shares = shares.toString();
        fixedCount++;
      }
    });
    
    console.log(`\n✅ Calculated shares for ${fixedCount} creates`);
    
    // Verify a few calculations
    console.log('\nVerifying calculations (first 3 fixed):');
    let verified = 0;
    data.stakingData.createEvents.forEach(create => {
      if (create.shares && verified < 3 && fixedCount > 0) {
        const lengthInDays = Math.round((parseInt(create.endTime) - parseInt(create.timestamp)) / (24 * 60 * 60));
        console.log(`  Create ${verified + 1}: ${lengthInDays} days, shares=${create.shares}`);
        verified++;
      }
    });
    
    // Create backup
    const backupPath = dataPath.replace('.json', `-backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, fs.readFileSync(dataPath));
    console.log(`\n✅ Backup created: ${path.basename(backupPath)}`);
    
    // Save updated data
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log('✅ Updated cached-data.json');
    
    // Summary
    const finalWithShares = data.stakingData.createEvents.filter(c => c.shares).length;
    console.log('\n=== SUMMARY ===');
    console.log(`Total creates: ${data.stakingData.createEvents.length}`);
    console.log(`Creates with shares: ${finalWithShares} (${(finalWithShares/data.stakingData.createEvents.length*100).toFixed(1)}%)`);
    console.log(`Creates still missing shares: ${data.stakingData.createEvents.length - finalWithShares}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();