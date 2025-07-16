// Fix cached data metadata for incremental updates
const fs = require('fs');

console.log('🔧 FIXING CACHE METADATA FOR INCREMENTAL UPDATES...');

// Load cached data
const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));

// Get the correct block information from main metadata
const currentBlock = cachedData.metadata.currentBlock;
const deploymentBlock = cachedData.metadata.deploymentBlock;
const blocksScanned = cachedData.metadata.blocksScanned;

console.log(`📊 Found block info:`);
console.log(`  Current block: ${currentBlock}`);
console.log(`  Deployment block: ${deploymentBlock}`);
console.log(`  Blocks scanned: ${blocksScanned}`);

// Update stakingData metadata with correct block info
cachedData.stakingData.metadata.currentBlock = currentBlock;
cachedData.stakingData.metadata.deploymentBlock = deploymentBlock;
cachedData.stakingData.metadata.blocksScanned = blocksScanned;
cachedData.stakingData.metadata.lastFullUpdate = cachedData.lastUpdated;
cachedData.stakingData.metadata.incrementalUpdatesEnabled = true;
cachedData.stakingData.metadata.minBlocksForUpdate = 10;

// Also add the block info at the root level for easier access
cachedData.stakingData.lastBlock = currentBlock;

cachedData.lastUpdated = new Date().toISOString();

// Save updated data
fs.writeFileSync('public/data/cached-data.json', JSON.stringify(cachedData, null, 2));

console.log('✅ Fixed cache metadata');
console.log(`📊 Current block: ${currentBlock}`);
console.log(`📊 Deployment block: ${deploymentBlock}`);
console.log(`📊 Blocks scanned: ${blocksScanned}`);
console.log(`📊 Incremental updates enabled: ${cachedData.stakingData.metadata.incrementalUpdatesEnabled}`);

console.log('\n🔄 Frontend will now use cached JSON and update incrementally from block', currentBlock);
console.log('📊 When 10+ new blocks are available, incremental updates will be applied automatically');