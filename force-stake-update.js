#!/usr/bin/env node

/**
 * Forces an update of stake/create events to catch up
 */

const fs = require('fs');
const path = require('path');

// Load cached data
const dataPath = path.join(__dirname, 'public/data/cached-data.json');
const cachedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Force the lastBlock to be older to trigger update
console.log('Current stakingData.lastBlock:', cachedData.stakingData.lastBlock);
console.log('Current stakingData.metadata.currentBlock:', cachedData.stakingData.metadata?.currentBlock);

// Set it to 1000 blocks ago to force an update
const currentBlock = 23019767; // Approximate current block
const forceBlock = currentBlock - 1000;

cachedData.stakingData.lastBlock = forceBlock;
if (cachedData.stakingData.metadata) {
  cachedData.stakingData.metadata.currentBlock = forceBlock;
}

// Save the modified data
fs.writeFileSync(dataPath, JSON.stringify(cachedData, null, 2));

console.log('\nForced stakingData.lastBlock to:', forceBlock);
console.log('Now run: node smart-update-fixed.js');
console.log('\nThis will trigger a fetch of the missing ~1000 blocks of events.');