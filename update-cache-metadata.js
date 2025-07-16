// Update cached data with metadata for incremental updates
const fs = require('fs');

console.log('🔧 UPDATING CACHE METADATA FOR INCREMENTAL UPDATES...');

// Load cached data
const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));

// Add metadata if it doesn't exist
if (!cachedData.stakingData.metadata) {
  cachedData.stakingData.metadata = {};
}

// Set current block from the cached data's deployment info
// The cached data shows it scanned to block 22925419
const currentBlock = cachedData.stakingData.deploymentBlock + cachedData.stakingData.blocksScanned;

cachedData.stakingData.metadata.currentBlock = currentBlock;
cachedData.stakingData.metadata.lastFullUpdate = cachedData.lastUpdated;
cachedData.stakingData.metadata.incrementalUpdatesEnabled = true;
cachedData.stakingData.metadata.minBlocksForUpdate = 10;

// Also add the block info at the root level for easier access
cachedData.stakingData.lastBlock = currentBlock;

cachedData.lastUpdated = new Date().toISOString();

// Save updated data
fs.writeFileSync('public/data/cached-data.json', JSON.stringify(cachedData, null, 2));

console.log('✅ Updated cache metadata');
console.log(`📊 Current block: ${currentBlock}`);
console.log(`📊 Deployment block: ${cachedData.stakingData.deploymentBlock}`);
console.log(`📊 Blocks scanned: ${cachedData.stakingData.blocksScanned}`);
console.log(`📊 Incremental updates enabled: ${cachedData.stakingData.metadata.incrementalUpdatesEnabled}`);

console.log('\n🔄 Frontend will now use cached JSON and update incrementally from block', currentBlock);
console.log('📊 When 10+ new blocks are available, incremental updates will be applied automatically');