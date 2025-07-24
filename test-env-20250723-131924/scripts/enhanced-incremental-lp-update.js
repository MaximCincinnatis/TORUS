#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs').promises;
const path = require('path');
const EnhancedLPUpdater = require('../utils/enhancedLPUpdater');
const { calculatePositionStats } = require('../utils/lpPositionStates');
const { backupLPData, getMostRecentBackup } = require('../utils/dataBackup');

// Configuration
const RPC_URL = process.env.ETH_RPC_URL || 'https://eth.llamarpc.com';
const POSITION_MANAGER_ADDRESS = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
const DATA_FILE = path.join(__dirname, '../data/cached-data.json');
const BACKUP_DIR = path.join(__dirname, '../backups');

/**
 * Main update function
 */
async function runEnhancedLPUpdate() {
  console.log('Starting Enhanced LP Position Update...');
  console.log('='.repeat(50));

  try {
    // Load current data
    const currentData = await loadCurrentData();
    console.log(`Loaded ${currentData.lpPositions.length} existing positions`);

    // Initialize provider and updater
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const updater = new EnhancedLPUpdater(provider, POSITION_MANAGER_ADDRESS, POOL_ADDRESS);

    // Run the update
    const updateResult = await updater.updateAllPositions(currentData, {
      createBackup: true,
      scanBlocks: 1000
    });

    if (!updateResult.success) {
      throw new Error(`Update failed: ${updateResult.error}`);
    }

    // Log results
    logUpdateResults(updateResult.results);

    // Log state transitions
    if (updateResult.stateTransitions.length > 0) {
      console.log('\nState Transitions:');
      updateResult.stateTransitions.forEach(transition => {
        console.log(`  ${transition.tokenId}: ${transition.previousStatus} → ${transition.newStatus}`);
      });
    }

    // Calculate and log statistics
    const stats = calculatePositionStats(updateResult.data.lpPositions);
    logPositionStats(stats);

    // Save updated data
    await saveUpdatedData(updateResult.data);

    // Verify the save
    await verifyDataIntegrity(updateResult.data);

    console.log('\n✅ Enhanced LP update completed successfully!');

    return {
      success: true,
      stats: updateResult.results
    };

  } catch (error) {
    console.error('\n❌ Enhanced LP update failed:', error);
    
    // Attempt recovery from backup
    console.log('\nAttempting to recover from backup...');
    const recovered = await attemptRecovery();
    
    if (recovered) {
      console.log('✅ Successfully recovered from backup');
    } else {
      console.log('❌ Recovery failed - manual intervention required');
    }

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Load current data with validation
 */
async function loadCurrentData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(data);

    // Validate structure
    if (!parsed.lpPositions || !Array.isArray(parsed.lpPositions)) {
      throw new Error('Invalid data structure');
    }

    return parsed;
  } catch (error) {
    console.error('Failed to load current data:', error.message);
    
    // Try to load from backup
    const backup = await getMostRecentBackup(BACKUP_DIR);
    if (backup) {
      console.log('Loading from backup:', backup.filename);
      const backupData = await fs.readFile(backup.filepath, 'utf8');
      const parsed = JSON.parse(backupData);
      return parsed.data || parsed;
    }

    // Return empty structure
    return { lpPositions: [] };
  }
}

/**
 * Save updated data with validation
 */
async function saveUpdatedData(data) {
  // Create data directory if it doesn't exist
  const dataDir = path.dirname(DATA_FILE);
  await fs.mkdir(dataDir, { recursive: true });

  // Add metadata
  const dataWithMeta = {
    ...data,
    lastUpdated: new Date().toISOString(),
    version: '2.0' // Enhanced version
  };

  // Write to temporary file first
  const tempFile = `${DATA_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(dataWithMeta, null, 2));

  // Rename to final file (atomic operation)
  await fs.rename(tempFile, DATA_FILE);

  console.log(`\n✅ Saved ${data.lpPositions.length} positions to ${DATA_FILE}`);
}

/**
 * Verify data integrity after save
 */
async function verifyDataIntegrity(originalData) {
  const savedData = await loadCurrentData();
  
  if (savedData.lpPositions.length !== originalData.lpPositions.length) {
    throw new Error('Data integrity check failed: position count mismatch');
  }

  console.log('✅ Data integrity verified');
}

/**
 * Attempt recovery from backup
 */
async function attemptRecovery() {
  try {
    const backup = await getMostRecentBackup(BACKUP_DIR);
    if (!backup) {
      return false;
    }

    const backupData = await fs.readFile(backup.filepath, 'utf8');
    const parsed = JSON.parse(backupData);
    const data = parsed.data || parsed;

    await saveUpdatedData(data);
    return true;
  } catch (error) {
    console.error('Recovery failed:', error.message);
    return false;
  }
}

/**
 * Log update results
 */
function logUpdateResults(results) {
  console.log('\nUpdate Results:');
  console.log(`  Updated: ${results.updated} positions`);
  console.log(`  New: ${results.new} positions`);
  console.log(`  Closed: ${results.closed} positions`);
  console.log(`  Transferred: ${results.transferred} positions`);
  
  if (results.errors.length > 0) {
    console.log(`  Errors: ${results.errors.length}`);
    results.errors.slice(0, 5).forEach(err => {
      console.log(`    - ${err}`);
    });
  }
}

/**
 * Log position statistics
 */
function logPositionStats(stats) {
  console.log('\nPosition Statistics:');
  console.log(`  Total Positions: ${stats.total}`);
  console.log('  By Status:');
  
  Object.entries(stats.byStatus).forEach(([status, count]) => {
    console.log(`    ${status}: ${count}`);
  });

  if (stats.recentlyClosed > 0) {
    console.log(`  Recently Closed (7d): ${stats.recentlyClosed}`);
  }
  if (stats.recentlyCreated > 0) {
    console.log(`  Recently Created (7d): ${stats.recentlyCreated}`);
  }
}

// Run if called directly
if (require.main === module) {
  runEnhancedLPUpdate()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = runEnhancedLPUpdate;