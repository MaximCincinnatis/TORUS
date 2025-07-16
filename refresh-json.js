#!/usr/bin/env node

/**
 * Simple JSON refresh script for TORUS Dashboard
 * Updates the cached JSON with latest blockchain data
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 TORUS Dashboard JSON Refresh');
console.log('================================');

const scripts = [
  {
    name: 'Enhanced JSON Update',
    file: 'enhance-existing-json.js',
    description: 'Updates JSON with latest token/pool data while preserving events'
  }
];

async function runScript(scriptPath, description) {
  console.log(`\n📊 Running: ${description}`);
  console.log(`📄 Script: ${scriptPath}`);
  
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath], { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${description} completed successfully`);
        resolve();
      } else {
        console.error(`❌ ${description} failed with code ${code}`);
        reject(new Error(`Script failed with code ${code}`));
      }
    });
    
    child.on('error', (err) => {
      console.error(`❌ Error running ${description}:`, err.message);
      reject(err);
    });
  });
}

async function main() {
  try {
    // Check if JSON file exists
    const jsonPath = './public/data/cached-data.json';
    if (!fs.existsSync(jsonPath)) {
      console.error('❌ cached-data.json not found. Please ensure the file exists.');
      process.exit(1);
    }
    
    // Create backup
    const backupPath = `./public/data/cached-data-backup-${Date.now()}.json`;
    fs.copyFileSync(jsonPath, backupPath);
    console.log(`📦 Backup created: ${backupPath}`);
    
    // Run enhancement script
    await runScript('enhance-existing-json.js', 'Enhanced JSON Update');
    
    // Verify the update
    const updatedData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log('\n📊 Update Summary:');
    console.log(`  - Stake events: ${updatedData.stakingData.stakeEvents.length}`);
    console.log(`  - Create events: ${updatedData.stakingData.createEvents.length}`);
    console.log(`  - Reward pool days: ${updatedData.stakingData.rewardPoolData.length}`);
    console.log(`  - Total ETH: ${updatedData.totals.totalETH}`);
    console.log(`  - Total TitanX: ${updatedData.totals.totalTitanX}`);
    console.log(`  - Token supply: ${updatedData.stakingData.totalSupply}`);
    console.log(`  - Protocol day: ${updatedData.stakingData.currentProtocolDay}`);
    console.log(`  - Last updated: ${updatedData.lastUpdated}`);
    console.log(`  - Version: ${updatedData.version}`);
    
    console.log('\n✅ JSON refresh completed successfully!');
    console.log('🌐 The dashboard should now display updated data.');
    console.log('🔄 Refresh your browser to see the changes.');
    
  } catch (error) {
    console.error('\n❌ JSON refresh failed:', error.message);
    process.exit(1);
  }
}

main();