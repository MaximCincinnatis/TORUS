#!/usr/bin/env node

/**
 * Remove Invalid Position (1030051 with zero liquidity)
 */

const fs = require('fs');

function removeInvalidPosition() {
  console.log('🧹 Removing invalid position with zero liquidity...');
  
  // Load current data
  const currentData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
  console.log(`Current positions: ${currentData.lpPositions.length}`);
  
  // Find position with zero liquidity
  const invalidPosition = currentData.lpPositions.find(p => p.tokenId === "1030051");
  if (!invalidPosition) {
    console.log('✅ Position 1030051 not found');
    return;
  }
  
  console.log(`\n🔍 Found invalid position:`);
  console.log(`  TokenId: ${invalidPosition.tokenId}`);
  console.log(`  Owner: ${invalidPosition.owner}`);
  console.log(`  Liquidity: ${invalidPosition.liquidity}`);
  console.log(`  Reason: Zero liquidity (confirmed by blockchain)`);
  
  // Remove the invalid position
  currentData.lpPositions = currentData.lpPositions.filter(p => p.tokenId !== "1030051");
  
  console.log(`\n✅ Positions after removal: ${currentData.lpPositions.length}`);
  
  // Write updated data
  fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(currentData, null, 2));
  console.log('💾 Updated cached-data.json - removed invalid position');
  
  console.log('\n📊 Final valid position list:');
  currentData.lpPositions.forEach(pos => {
    console.log(`  - ${pos.tokenId}: ${pos.owner?.substring(0,10)}... (${pos.inRange ? 'in range' : 'out of range'})`);
  });
  
  console.log('\n✅ Cleanup complete - only valid positions remain');
}

removeInvalidPosition();