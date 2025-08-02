/**
 * Stake Events Recovery Script
 * 
 * Purpose: Recover 134 stake events that failed to decode due to incorrect ABI
 * 
 * The issue: The ABI had stakeIndex marked as indexed when it's not
 * This script loads the checkpoint data and decodes events with the correct ABI
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Correct ABI - only user is indexed, not stakeIndex
const CORRECT_STAKE_ABI = ['event Staked(address indexed user, uint256 stakeIndex, uint256 principal, uint256 stakingDays, uint256 shares)'];

// Contract addresses
const CONTRACTS = {
  TITANX: '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1',
  CREATE_STAKE: '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507'
};

// Protocol day calculation
function getProtocolDay(timestamp) {
  const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
  const msPerDay = 24 * 60 * 60 * 1000;
  const dateObj = new Date(timestamp * 1000);
  const daysDiff = Math.floor((dateObj.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1;
  return Math.max(1, daysDiff);
}

async function recoverStakeEvents() {
  console.log('🔧 Stake Events Recovery Script');
  console.log('================================');
  
  try {
    // Step 1: Load checkpoint file
    console.log('\n📂 Loading checkpoint file...');
    const checkpointPath = path.join(__dirname, '..', 'checkpoint-full-update.json');
    
    if (!fs.existsSync(checkpointPath)) {
      throw new Error('Checkpoint file not found! Please ensure checkpoint-full-update.json exists.');
    }
    
    const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
    
    // Check if we have events data
    if (!checkpoint.eventsProgress || !checkpoint.eventsProgress.stakes) {
      throw new Error('No stake events found in checkpoint!');
    }
    
    const stakeEvents = checkpoint.eventsProgress.stakes;
    console.log(`✅ Found ${stakeEvents.length} stake events in checkpoint`);
    
    // Step 2: Load existing cached data
    console.log('\n📄 Loading cached-data.json...');
    const cachedDataPath = path.join(__dirname, '..', 'public', 'data', 'cached-data.json');
    const cachedData = JSON.parse(fs.readFileSync(cachedDataPath, 'utf8'));
    
    // Create backup
    const backupPath = path.join(__dirname, '..', 'public', 'data', `cached-data-backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(cachedData, null, 2));
    console.log(`✅ Created backup: ${path.basename(backupPath)}`);
    
    // Initialize stake events array if it doesn't exist
    if (!cachedData.stakingData) {
      cachedData.stakingData = {};
    }
    cachedData.stakingData.stakeEvents = [];
    
    // Step 3: Load block timestamps from checkpoint
    console.log('\n⏰ Loading block timestamps...');
    const blockTimestamps = new Map();
    
    // The checkpoint stores timestamps differently, let's check the structure
    if (checkpoint.blockTimestamps) {
      // If stored as array of [blockNumber, timestamp] pairs
      if (Array.isArray(checkpoint.blockTimestamps)) {
        checkpoint.blockTimestamps.forEach(([block, timestamp]) => {
          blockTimestamps.set(block, timestamp);
        });
      } else {
        // If stored as object
        Object.entries(checkpoint.blockTimestamps).forEach(([block, timestamp]) => {
          blockTimestamps.set(parseInt(block), timestamp);
        });
      }
    }
    
    console.log(`✅ Loaded ${blockTimestamps.size} block timestamps`);
    
    // Step 4: Process stake events
    console.log('\n🔄 Processing stake events...');
    const iface = new ethers.utils.Interface(CORRECT_STAKE_ABI);
    let successCount = 0;
    let failCount = 0;
    
    for (const event of stakeEvents) {
      try {
        let decodedArgs;
        
        // Try to decode the event
        if (event.args) {
          // Event already has args (might be incorrectly decoded)
          decodedArgs = event.args;
        } else if (event.data && event.topics) {
          // Decode from raw data
          const decoded = iface.parseLog({ 
            data: event.data, 
            topics: event.topics 
          });
          decodedArgs = decoded.args;
        } else {
          console.log(`⚠️  Skipping event without data: ${event.transactionHash}`);
          failCount++;
          continue;
        }
        
        // Get timestamp
        const timestamp = blockTimestamps.get(event.blockNumber) || 
                        (event.timestamp ? parseInt(event.timestamp) : 0);
        
        if (!timestamp) {
          console.log(`⚠️  No timestamp for block ${event.blockNumber}`);
          failCount++;
          continue;
        }
        
        // Create stake data object
        const stakeData = {
          user: decodedArgs.user.toLowerCase(),
          stakeIndex: decodedArgs.stakeIndex.toString(),
          principal: decodedArgs.principal.toString(),
          stakingDays: decodedArgs.stakingDays.toString(),
          shares: decodedArgs.shares.toString(),
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          timestamp: timestamp.toString(),
          protocolDay: getProtocolDay(timestamp),
          // Additional fields for consistency with creates
          titanAmount: decodedArgs.principal.toString(),
          rawCostTitanX: decodedArgs.principal.toString(),
          costTitanX: ethers.utils.formatEther(decodedArgs.principal),
          costETH: "0.0",
          rawCostETH: "0"
        };
        
        cachedData.stakingData.stakeEvents.push(stakeData);
        successCount++;
        
        if (successCount % 10 === 0) {
          console.log(`  📊 Processed ${successCount}/${stakeEvents.length} stakes`);
        }
        
      } catch (error) {
        console.log(`⚠️  Failed to process stake event: ${error.message}`);
        failCount++;
      }
    }
    
    console.log('\n📊 Processing Complete:');
    console.log(`  ✅ Successfully decoded: ${successCount} stake events`);
    console.log(`  ❌ Failed to decode: ${failCount} stake events`);
    
    // Step 5: Sort events by timestamp
    cachedData.stakingData.stakeEvents.sort((a, b) => 
      parseInt(a.timestamp) - parseInt(b.timestamp)
    );
    
    // Step 6: Update metadata
    cachedData.lastUpdated = new Date().toISOString();
    if (!cachedData.metadata) {
      cachedData.metadata = {};
    }
    cachedData.metadata.stakesRecovered = true;
    cachedData.metadata.stakesRecoveryDate = new Date().toISOString();
    cachedData.metadata.totalStakes = cachedData.stakingData.stakeEvents.length;
    
    // Step 7: Save updated data
    console.log('\n💾 Saving updated cached-data.json...');
    fs.writeFileSync(cachedDataPath, JSON.stringify(cachedData, null, 2));
    console.log('✅ Successfully saved updated data!');
    
    // Step 8: Summary
    console.log('\n📈 Summary:');
    console.log(`  Total stake events recovered: ${cachedData.stakingData.stakeEvents.length}`);
    
    // Show sample of recovered data
    if (cachedData.stakingData.stakeEvents.length > 0) {
      console.log('\n  Sample stake event:');
      const sample = cachedData.stakingData.stakeEvents[0];
      console.log(`    User: ${sample.user}`);
      console.log(`    Stake Index: ${sample.stakeIndex}`);
      console.log(`    Principal: ${sample.costTitanX} TitanX`);
      console.log(`    Staking Days: ${sample.stakingDays}`);
      console.log(`    Shares: ${ethers.utils.commify(sample.shares)}`);
      console.log(`    Protocol Day: ${sample.protocolDay}`);
    }
    
    console.log('\n✅ Stake events recovery completed successfully!');
    console.log('🎉 Dashboard should now show all stake history from July 10th');
    
  } catch (error) {
    console.error('\n❌ Recovery failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the recovery
recoverStakeEvents();