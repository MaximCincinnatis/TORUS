#!/usr/bin/env node

/**
 * Forces a complete update to fill the gap
 */

const fs = require('fs');
const path = require('path');

// Load cached data
const dataPath = path.join(__dirname, 'public/data/cached-data.json');
const cachedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Set lastBlock to just before the gap (block 23005193)
const beforeGap = 23005193;

console.log('Current stakingData.lastBlock:', cachedData.stakingData.lastBlock);
console.log('Setting to block before gap:', beforeGap);

cachedData.stakingData.lastBlock = beforeGap;
if (cachedData.stakingData.metadata) {
  cachedData.stakingData.metadata.currentBlock = beforeGap;
}

// Save the modified data
fs.writeFileSync(dataPath, JSON.stringify(cachedData, null, 2));

console.log('\nForced stakingData.lastBlock to:', beforeGap);
console.log('Now run: node smart-update-fixed.js');
console.log('\nThis will fetch the missing 13,727 blocks (may take a minute).');