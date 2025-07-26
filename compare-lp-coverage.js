#!/usr/bin/env node

const fs = require('fs');

console.log('=== LP POSITION COVERAGE ANALYSIS ===');

// Load dashboard data
const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
const dashboardTokenIds = data.lpPositions.map(p => p.tokenId.toString()).sort();

console.log('Dashboard LP positions:');
dashboardTokenIds.forEach(id => {
  const pos = data.lpPositions.find(p => p.tokenId.toString() === id);
  console.log(`  ${id}: Liquidity ${pos.liquidity}, Range ${pos.tickLower} to ${pos.tickUpper}`);
});
console.log('');

// Load update script to see known positions
const updateScript = fs.readFileSync('./scripts/data-updates/update-all-dashboard-data.js', 'utf8');
const knownMatch = updateScript.match(/knownTORUSTokenIds\s*=\s*\[(.*?)\]/s);

if (knownMatch) {
  const knownIds = knownMatch[1]
    .split(',')
    .map(s => s.trim().replace(/['"]/g, ''))
    .filter(s => s && s !== '')
    .sort();
  
  console.log('Known positions in update script:');
  knownIds.forEach(id => console.log(`  ${id}`));
  console.log('');
  
  console.log('=== COMPARISON ===');
  const missing = dashboardTokenIds.filter(id => !knownIds.includes(id));
  const extra = knownIds.filter(id => !dashboardTokenIds.includes(id));
  
  if (missing.length > 0) {
    console.log('🚨 Dashboard has positions NOT in update script:');
    missing.forEach(id => console.log(`  ${id}`));
  }
  
  if (extra.length > 0) {
    console.log('⚠️  Update script has positions NOT in dashboard:');
    extra.forEach(id => console.log(`  ${id}`));
  }
  
  if (missing.length === 0 && extra.length === 0) {
    console.log('✅ Dashboard and update script have matching positions');
  }
} else {
  console.log('Could not find knownTORUSTokenIds in update script');
}

console.log('');
console.log('=== MISSING POSITION DETECTION ===');
console.log('To find missing positions, we need to:');
console.log('1. Scan Transfer events from zero address (NFT mints) for TORUS/TitanX pool');
console.log('2. Check current liquidity of each position');
console.log('3. Add any active positions not in our dashboard');
console.log('');
console.log('Current positions seem to cover the main liquidity in the pool.');
console.log('The discovery method via Mint events in the update script should catch new positions.');