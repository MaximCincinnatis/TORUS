#!/usr/bin/env node

/**
 * Restore Missing LP Position
 * Adds back the missing position 1029195 that was lost in previous updates
 */

const fs = require('fs');

function restoreMissingPosition() {
  console.log('🔧 Restoring missing LP position...');
  
  // Load current data
  const currentData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
  console.log(`Current positions: ${currentData.lpPositions.length}`);
  
  // Load backup with complete data
  const backupData = JSON.parse(fs.readFileSync('./public/data/backups/cached-data-2025-07-15T23-38-41.061Z.json', 'utf8'));
  console.log(`Backup positions: ${backupData.lpPositions.length}`);
  
  // Find missing positions
  const currentIds = new Set(currentData.lpPositions.map(p => p.tokenId));
  const missingPositions = backupData.lpPositions.filter(p => !currentIds.has(p.tokenId));
  
  console.log('\n🔍 Missing positions found:');
  missingPositions.forEach(pos => {
    console.log(`  - ${pos.tokenId}: ${pos.owner?.substring(0,10)}... (${pos.liquidity})`);
  });
  
  if (missingPositions.length === 0) {
    console.log('✅ No missing positions to restore');
    return;
  }
  
  // The missing position we need to verify and restore
  const missingPosition = {
    "tokenId": "1029195",
    "owner": "0xAa390a37006E22b5775A34f2147F81eBD6a63641",
    "liquidity": "63319703819228855842700268",
    "tickLower": -887200,
    "tickUpper": 887200,
    "lowerTitanxPerTorus": "0.00M",
    "upperTitanxPerTorus": "Infinity",
    "currentTitanxPerTorus": "43.60M",
    "amount0": 10334.907926991636,
    "amount1": 387945874320.1349,
    "claimableTorus": 13.635395823244082,
    "claimableTitanX": 1272085328.5929174,
    "tokensOwed0": "0",
    "tokensOwed1": "0",
    "fee": 10000,
    "inRange": true,
    "estimatedAPR": "6.88",
    "priceRange": "Full Range"
  };
  
  console.log('\n📋 Position to restore:');
  console.log(`  TokenId: ${missingPosition.tokenId}`);
  console.log(`  Owner: ${missingPosition.owner}`);
  console.log(`  Liquidity: ${missingPosition.liquidity}`);
  console.log(`  Range: ${missingPosition.priceRange}`);
  
  // Add missing position back
  currentData.lpPositions.push(missingPosition);
  
  // Sort by tokenId for consistency
  currentData.lpPositions.sort((a, b) => parseInt(a.tokenId) - parseInt(b.tokenId));
  
  console.log(`\n✅ Positions after restore: ${currentData.lpPositions.length}`);
  
  // Create backup before update
  const backupFile = `./public/data/backups/cached-data-before-position-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(backupFile, JSON.stringify(JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8')), null, 2));
  console.log(`📁 Backup created: ${backupFile}`);
  
  // Write updated data
  fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(currentData, null, 2));
  console.log('💾 Updated cached-data.json with restored position');
  
  console.log('\n📊 Final position list:');
  currentData.lpPositions.forEach(pos => {
    console.log(`  - ${pos.tokenId}: ${pos.owner?.substring(0,10)}... (${pos.inRange ? 'in range' : 'out of range'})`);
  });
}

restoreMissingPosition();