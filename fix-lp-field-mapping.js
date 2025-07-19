#!/usr/bin/env node

/**
 * Fix LP Position Field Mapping
 * 
 * This script ensures LP positions have the correct field names
 * that the frontend expects (torusAmount, titanxAmount)
 */

const fs = require('fs');

// Load cached data
const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));

console.log('🔧 Fixing LP Position Field Mapping...');
console.log('=====================================\n');

// Fix LP positions
if (cachedData.lpPositions) {
  let fixed = 0;
  
  cachedData.lpPositions = cachedData.lpPositions.map(position => {
    // Token0 is TORUS, Token1 is TitanX
    const updatedPosition = {
      ...position,
      torusAmount: position.amount0 || 0,
      titanxAmount: position.amount1 || 0,
      // Also ensure claimable fields exist
      claimableTorus: position.claimableTorus || 0,
      claimableTitanX: position.claimableTitanX || 0,
      claimableYield: (position.claimableTorus || 0) + (position.claimableTitanX || 0)
    };
    
    if (!position.torusAmount || !position.titanxAmount) {
      fixed++;
    }
    
    return updatedPosition;
  });
  
  // Also update in uniswapV3 section if it exists
  if (cachedData.uniswapV3?.lpPositions) {
    cachedData.uniswapV3.lpPositions = cachedData.lpPositions;
  }
  
  console.log(`✅ Fixed ${fixed} positions with missing torusAmount/titanxAmount fields`);
  console.log(`📊 Total positions: ${cachedData.lpPositions.length}`);
  
  // Show sample position
  if (cachedData.lpPositions.length > 0) {
    const sample = cachedData.lpPositions[0];
    console.log('\nSample position after fix:');
    console.log(`  torusAmount: ${sample.torusAmount}`);
    console.log(`  titanxAmount: ${sample.titanxAmount}`);
    console.log(`  claimableYield: ${sample.claimableYield}`);
  }
}

// Update timestamp
cachedData.lastUpdated = new Date().toISOString();

// Save the fixed data
fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cachedData, null, 2));

console.log('\n✅ LP field mapping fixed successfully!');
console.log('The frontend should now display the correct amounts.');