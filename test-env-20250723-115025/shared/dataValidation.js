/**
 * STATUS: ACTIVE - Data validation utilities
 * PURPOSE: Simple validation checks before saving data
 * USED BY: All update scripts
 */

/**
 * Validate cached data before saving
 * @param {Object} data - The complete cached data object
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
function validateCachedData(data) {
  const errors = [];
  
  // Check basic structure
  if (!data || typeof data !== 'object') {
    errors.push('Data is not an object');
    return { isValid: false, errors };
  }
  
  // Check required fields
  if (!data.stakingData) {
    errors.push('Missing stakingData');
  }
  
  if (!data.lpPositions || !Array.isArray(data.lpPositions)) {
    errors.push('Missing or invalid lpPositions array');
  }
  
  // Check LP positions integrity
  if (data.lpPositions && Array.isArray(data.lpPositions)) {
    const zeroAmountPositions = data.lpPositions.filter(pos => 
      pos.liquidity && pos.liquidity !== '0' &&
      (!pos.torusAmount || pos.torusAmount === 0) &&
      (!pos.titanxAmount || pos.titanxAmount === 0)
    );
    
    if (zeroAmountPositions.length > data.lpPositions.length * 0.5) {
      errors.push(`Too many zero-amount positions: ${zeroAmountPositions.length}/${data.lpPositions.length}`);
    }
  }
  
  // Check reward pool data
  if (data.stakingData?.rewardPoolData) {
    const rewardData = data.stakingData.rewardPoolData;
    
    // Should have at least 88 days
    if (rewardData.length < 88) {
      errors.push(`Reward pool data incomplete: only ${rewardData.length} days (expected 88+)`);
    }
    
    // Day 1 should be ~100,000
    const day1 = rewardData.find(d => d.day === 1);
    if (day1 && (day1.rewardPool < 99000 || day1.rewardPool > 101000)) {
      errors.push(`Day 1 reward pool invalid: ${day1.rewardPool} (expected ~100,000)`);
    }
  }
  
  // Check for required arrays
  const requiredArrays = [
    'stakingData.stakeEvents',
    'stakingData.createEvents',
    'historicalData.sevenDay',
    'historicalData.thirtyDay'
  ];
  
  requiredArrays.forEach(path => {
    const value = path.split('.').reduce((obj, key) => obj?.[key], data);
    if (!Array.isArray(value)) {
      errors.push(`Missing or invalid array: ${path}`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Create backup before updating data
 * @param {string} filePath - Path to the data file
 * @returns {string} Path to backup file
 */
function createBackup(filePath) {
  const fs = require('fs');
  const path = require('path');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = filePath.replace('.json', `-backup-${timestamp}.json`);
  
  fs.copyFileSync(filePath, backupPath);
  console.log(`✅ Backup created: ${path.basename(backupPath)}`);
  
  return backupPath;
}

/**
 * Safe data update with validation and backup
 * @param {string} filePath - Path to data file
 * @param {Object} newData - New data to save
 * @returns {boolean} Success status
 */
function safeUpdateData(filePath, newData) {
  const fs = require('fs');
  
  try {
    // Validate new data
    const validation = validateCachedData(newData);
    if (!validation.isValid) {
      console.error('❌ Data validation failed:');
      validation.errors.forEach(err => console.error(`  - ${err}`));
      return false;
    }
    
    // Create backup
    const backupPath = createBackup(filePath);
    
    // Save new data
    fs.writeFileSync(filePath, JSON.stringify(newData, null, 2));
    console.log('✅ Data updated successfully');
    
    // Clean old backups (keep last 5)
    cleanOldBackups(filePath, 5);
    
    return true;
    
  } catch (error) {
    console.error('❌ Error updating data:', error.message);
    return false;
  }
}

/**
 * Clean old backup files
 */
function cleanOldBackups(filePath, keepCount = 5) {
  const fs = require('fs');
  const path = require('path');
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, '.json');
  
  try {
    const files = fs.readdirSync(dir);
    const backups = files
      .filter(f => f.startsWith(`${baseName}-backup-`) && f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (backups.length > keepCount) {
      backups.slice(keepCount).forEach(file => {
        fs.unlinkSync(path.join(dir, file));
        console.log(`🗑️  Deleted old backup: ${file}`);
      });
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

module.exports = {
  validateCachedData,
  createBackup,
  safeUpdateData,
  cleanOldBackups
};