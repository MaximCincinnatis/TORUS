#!/usr/bin/env node

const fs = require('fs');

console.log('🔍 Validating LP position amounts...\n');

const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));

console.log('LP Positions Summary:');
console.log('===================');

let totalTorus = 0;
let totalTitanX = 0;

cacheData.lpPositions.forEach(pos => {
  console.log(`\nPosition ${pos.tokenId}:`);
  console.log(`  Owner: ${pos.owner}`);
  console.log(`  TORUS: ${pos.amount0.toLocaleString()}`);
  console.log(`  TitanX: ${pos.amount1.toLocaleString()}`);
  console.log(`  Claimable TitanX: ${pos.claimableTitanX.toLocaleString()}`);
  console.log(`  Range: ${pos.priceRange}`);
  console.log(`  In Range: ${pos.inRange}`);
  
  totalTorus += pos.amount0;
  totalTitanX += pos.amount1;
});

console.log('\n===================');
console.log('Total Liquidity:');
console.log(`  TORUS: ${totalTorus.toLocaleString()}`);
console.log(`  TitanX: ${totalTitanX.toLocaleString()}`);

// Position 1029195 should dominate
const mainPosition = cacheData.lpPositions.find(p => p.tokenId === '1029195');
if (mainPosition) {
  const torusPercent = (mainPosition.amount0 / totalTorus * 100).toFixed(1);
  const titanXPercent = (mainPosition.amount1 / totalTitanX * 100).toFixed(1);
  
  console.log(`\nPosition 1029195 represents:`);
  console.log(`  ${torusPercent}% of total TORUS`);
  console.log(`  ${titanXPercent}% of total TitanX`);
}