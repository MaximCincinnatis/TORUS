#!/usr/bin/env node

/**
 * Restore Second Missing LP Position (1030051)
 */

const fs = require('fs');

function restoreSecondPosition() {
  console.log('🔧 Restoring second missing LP position (1030051)...');
  
  // Load current data
  const currentData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
  console.log(`Current positions: ${currentData.lpPositions.length}`);
  
  // Check if we already have this position
  const hasPosition = currentData.lpPositions.some(p => p.tokenId === "1030051");
  if (hasPosition) {
    console.log('✅ Position 1030051 already exists');
    return;
  }
  
  // The second missing position
  const missingPosition = {
    "tokenId": "1030051",
    "owner": "0xCe32E10b205FBf49F3bB7132f7378751Af1832b6",
    "liquidity": "8016679684822587265068841",
    "tickLower": 147400,
    "tickUpper": 159000,
    "lowerTitanxPerTorus": "2.52M",
    "upperTitanxPerTorus": "8.03M",
    "currentTitanxPerTorus": "43.60M",
    "amount0": 0,
    "amount1": 9999999999.990435,
    "claimableTorus": 0,
    "claimableTitanX": 0,
    "tokensOwed0": "0",
    "tokensOwed1": "0",
    "fee": 10000,
    "inRange": false,
    "estimatedAPR": "0.00",
    "priceRange": "2.52M - 8.03M TITANX per TORUS"
  };
  
  console.log('\n📋 Adding position:');
  console.log(`  TokenId: ${missingPosition.tokenId}`);
  console.log(`  Owner: ${missingPosition.owner}`);
  console.log(`  Liquidity: ${missingPosition.liquidity}`);
  console.log(`  Range: ${missingPosition.priceRange}`);
  
  // Add missing position
  currentData.lpPositions.push(missingPosition);
  
  // Sort by tokenId for consistency
  currentData.lpPositions.sort((a, b) => parseInt(a.tokenId) - parseInt(b.tokenId));
  
  console.log(`\n✅ Positions after restore: ${currentData.lpPositions.length}`);
  
  // Write updated data
  fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(currentData, null, 2));
  console.log('💾 Updated cached-data.json with second position');
  
  console.log('\n📊 Final complete position list:');
  currentData.lpPositions.forEach(pos => {
    console.log(`  - ${pos.tokenId}: ${pos.owner?.substring(0,10)}... (${pos.inRange ? 'in range' : 'out of range'})`);
  });
}

restoreSecondPosition();