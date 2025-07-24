const fs = require('fs').promises;
const path = require('path');

/**
 * Create a backup of LP position data
 * @param {Object} data - Data to backup
 * @param {string} backupDir - Directory for backups
 * @returns {Object} Backup details
 */
async function backupLPData(data, backupDir = './backups') {
  try {
    // Ensure backup directory exists
    await fs.mkdir(backupDir, { recursive: true });

    // Create timestamp-based filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `lp-data-backup-${timestamp}.json`;
    const filepath = path.join(backupDir, filename);

    // Add metadata to backup
    const backupData = {
      metadata: {
        createdAt: new Date().toISOString(),
        version: '1.0',
        totalPositions: data.lpPositions ? data.lpPositions.length : 0,
        dataChecksum: calculateChecksum(data)
      },
      data: data
    };

    // Write backup file
    await fs.writeFile(filepath, JSON.stringify(backupData, null, 2));

    // Clean old backups
    await cleanOldBackups(backupDir);

    return {
      success: true,
      filepath,
      filename,
      timestamp: backupData.metadata.createdAt,
      checksum: backupData.metadata.dataChecksum
    };
  } catch (error) {
    console.error('Backup failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Restore data from a backup file
 * @param {string} backupPath - Path to backup file
 * @returns {Object} Restored data
 */
async function restoreFromBackup(backupPath) {
  try {
    const backupContent = await fs.readFile(backupPath, 'utf8');
    const backup = JSON.parse(backupContent);

    // Validate backup structure
    if (!backup.metadata || !backup.data) {
      throw new Error('Invalid backup file structure');
    }

    // Verify checksum
    const calculatedChecksum = calculateChecksum(backup.data);
    if (calculatedChecksum !== backup.metadata.dataChecksum) {
      console.warn('Backup checksum mismatch - data may be corrupted');
    }

    return {
      success: true,
      data: backup.data,
      metadata: backup.metadata
    };
  } catch (error) {
    console.error('Restore failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get the most recent backup
 * @param {string} backupDir - Directory containing backups
 * @returns {Object} Most recent backup info
 */
async function getMostRecentBackup(backupDir = './backups') {
  try {
    const files = await fs.readdir(backupDir);
    const backupFiles = files.filter(f => f.startsWith('lp-data-backup-') && f.endsWith('.json'));

    if (backupFiles.length === 0) {
      return null;
    }

    // Sort by filename (which includes timestamp)
    backupFiles.sort((a, b) => b.localeCompare(a));
    const mostRecent = backupFiles[0];

    const filepath = path.join(backupDir, mostRecent);
    const stats = await fs.stat(filepath);

    return {
      filename: mostRecent,
      filepath,
      size: stats.size,
      created: stats.birthtime
    };
  } catch (error) {
    console.error('Failed to get recent backup:', error);
    return null;
  }
}

/**
 * Clean old backup files, keeping only the most recent N backups
 * @param {string} backupDir - Directory containing backups
 * @param {number} keepCount - Number of backups to keep
 */
async function cleanOldBackups(backupDir, keepCount = 10) {
  try {
    const files = await fs.readdir(backupDir);
    const backupFiles = files.filter(f => f.startsWith('lp-data-backup-') && f.endsWith('.json'));

    if (backupFiles.length <= keepCount) {
      return;
    }

    // Sort by filename (newest first)
    backupFiles.sort((a, b) => b.localeCompare(a));

    // Delete old backups
    const filesToDelete = backupFiles.slice(keepCount);
    for (const file of filesToDelete) {
      await fs.unlink(path.join(backupDir, file));
    }

    console.log(`Cleaned ${filesToDelete.length} old backup files`);
  } catch (error) {
    console.error('Failed to clean old backups:', error);
  }
}

/**
 * Create a differential backup (only changes since last backup)
 * @param {Object} currentData - Current data
 * @param {Object} lastBackup - Last backup data
 * @returns {Object} Differential backup
 */
function createDifferentialBackup(currentData, lastBackup) {
  const changes = {
    added: [],
    modified: [],
    removed: []
  };

  const currentPositions = new Map(
    currentData.lpPositions.map(p => [p.tokenId, p])
  );
  const lastPositions = new Map(
    lastBackup.lpPositions.map(p => [p.tokenId, p])
  );

  // Find added and modified positions
  currentPositions.forEach((position, tokenId) => {
    const lastPosition = lastPositions.get(tokenId);
    if (!lastPosition) {
      changes.added.push(position);
    } else if (JSON.stringify(position) !== JSON.stringify(lastPosition)) {
      changes.modified.push({
        tokenId,
        changes: getPositionChanges(lastPosition, position)
      });
    }
  });

  // Find removed positions
  lastPositions.forEach((position, tokenId) => {
    if (!currentPositions.has(tokenId)) {
      changes.removed.push(tokenId);
    }
  });

  return {
    metadata: {
      createdAt: new Date().toISOString(),
      baseBackup: lastBackup.metadata.createdAt,
      changesCount: {
        added: changes.added.length,
        modified: changes.modified.length,
        removed: changes.removed.length
      }
    },
    changes
  };
}

/**
 * Calculate a simple checksum for data integrity
 * @param {Object} data - Data to checksum
 * @returns {string} Checksum
 */
function calculateChecksum(data) {
  const str = JSON.stringify(data);
  let hash = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16);
}

/**
 * Get changes between two position objects
 * @param {Object} oldPos - Old position
 * @param {Object} newPos - New position
 * @returns {Array} List of changes
 */
function getPositionChanges(oldPos, newPos) {
  const changes = [];
  const fields = ['liquidity', 'owner', 'status', 'amount0', 'amount1'];

  fields.forEach(field => {
    if (oldPos[field] !== newPos[field]) {
      changes.push({
        field,
        from: oldPos[field],
        to: newPos[field]
      });
    }
  });

  return changes;
}

/**
 * Verify backup integrity
 * @param {string} backupPath - Path to backup file
 * @returns {Object} Verification result
 */
async function verifyBackupIntegrity(backupPath) {
  try {
    const result = await restoreFromBackup(backupPath);
    
    if (!result.success) {
      return {
        valid: false,
        error: result.error
      };
    }

    const issues = [];

    // Check data structure
    if (!result.data.lpPositions || !Array.isArray(result.data.lpPositions)) {
      issues.push('Invalid lpPositions structure');
    }

    // Check position data
    if (result.data.lpPositions) {
      result.data.lpPositions.forEach((pos, index) => {
        if (!pos.tokenId) {
          issues.push(`Position at index ${index} missing tokenId`);
        }
      });
    }

    return {
      valid: issues.length === 0,
      issues,
      metadata: result.metadata
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

module.exports = {
  backupLPData,
  restoreFromBackup,
  getMostRecentBackup,
  cleanOldBackups,
  createDifferentialBackup,
  calculateChecksum,
  verifyBackupIntegrity
};