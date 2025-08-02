#!/usr/bin/env node

/**
 * Add missing historicalData structure to cached-data.json
 */

const fs = require('fs');
const path = require('path');

async function main() {
  console.log('=== ADDING MISSING HISTORICAL DATA STRUCTURE ===\n');
  
  try {
    // Load current data
    const dataPath = path.join(__dirname, '../public/data/cached-data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Check if historicalData is missing
    if (!data.historicalData) {
      console.log('historicalData is missing, adding empty structure...');
      
      // Add the expected structure
      data.historicalData = {
        sevenDay: [],
        thirtyDay: []
      };
      
      // Create backup
      const backupPath = dataPath.replace('.json', `-backup-${Date.now()}.json`);
      fs.writeFileSync(backupPath, fs.readFileSync(dataPath));
      console.log(`✅ Backup created: ${path.basename(backupPath)}`);
      
      // Save updated data
      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
      console.log('✅ Added historicalData structure');
    } else {
      console.log('✅ historicalData already exists');
    }
    
    // Also check other expected fields
    console.log('\nChecking other expected fields:');
    console.log('  - poolData:', 'poolData' in data ? '✅' : '❌ MISSING');
    console.log('  - tokenPrices:', 'tokenPrices' in data ? '✅' : '❌ MISSING');
    console.log('  - metadata:', 'metadata' in data ? '✅' : '❌ MISSING');
    console.log('  - version:', 'version' in data ? '✅' : '❌ MISSING');
    
    // Add any other missing expected fields
    let updated = false;
    
    if (!data.poolData) {
      data.poolData = {
        sqrtPriceX96: "0",
        currentTick: 0,
        token0: "",
        token1: "",
        liquidity: "0",
        feeGrowthGlobal0X128: "0",
        feeGrowthGlobal1X128: "0"
      };
      updated = true;
      console.log('  Added poolData structure');
    }
    
    if (!data.tokenPrices) {
      data.tokenPrices = {
        torus: {
          usd: 0,
          lastUpdated: new Date().toISOString()
        },
        titanx: {
          usd: 0,
          lastUpdated: new Date().toISOString()
        }
      };
      updated = true;
      console.log('  Added tokenPrices structure');
    }
    
    if (!data.version) {
      data.version = "1.0.0";
      updated = true;
      console.log('  Added version');
    }
    
    if (updated) {
      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
      console.log('\n✅ Updated cached-data.json with all missing fields');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();