const { ethers } = require('ethers');
const { PositionStates } = require('./lpPositionStates');

/**
 * Validate LP position data structure and integrity
 */
class DataValidator {
  constructor() {
    this.requiredFields = {
      lpPosition: ['tokenId', 'owner', 'liquidity', 'pool'],
      stake: ['id', 'user', 'amount', 'shares', 'term', 'startTs'],
      create: ['user', 'amount', 'mintAddress', 'timestamp']
    };
    
    this.validationErrors = [];
    this.validationWarnings = [];
  }

  /**
   * Validate entire cached data structure
   */
  validateCachedData(data) {
    this.validationErrors = [];
    this.validationWarnings = [];

    // Check top-level structure
    if (!data || typeof data !== 'object') {
      this.validationErrors.push('Invalid data structure: not an object');
      return this.getResults();
    }

    // Validate LP positions
    if (data.lpPositions) {
      this.validateLPPositions(data.lpPositions);
    } else {
      this.validationWarnings.push('Missing lpPositions array');
    }

    // Validate stakes
    if (data.stakes) {
      this.validateStakes(data.stakes);
    } else {
      this.validationWarnings.push('Missing stakes array');
    }

    // Validate creates
    if (data.creates) {
      this.validateCreates(data.creates);
    } else {
      this.validationWarnings.push('Missing creates array');
    }

    // Validate metadata
    this.validateMetadata(data);

    return this.getResults();
  }

  /**
   * Validate LP positions array
   */
  validateLPPositions(positions) {
    if (!Array.isArray(positions)) {
      this.validationErrors.push('LP positions must be an array');
      return;
    }

    const tokenIdSet = new Set();
    const duplicates = [];

    positions.forEach((position, index) => {
      const posErrors = this.validateLPPosition(position, index);
      
      // Check for duplicates
      if (position.tokenId) {
        if (tokenIdSet.has(position.tokenId)) {
          duplicates.push(position.tokenId);
        }
        tokenIdSet.add(position.tokenId);
      }
    });

    if (duplicates.length > 0) {
      this.validationErrors.push(`Duplicate LP positions found: ${duplicates.join(', ')}`);
    }

    // Check for data consistency
    this.checkLPDataConsistency(positions);
  }

  /**
   * Validate individual LP position
   */
  validateLPPosition(position, index) {
    const errors = [];

    // Check required fields
    this.requiredFields.lpPosition.forEach(field => {
      if (!position[field] && position[field] !== 0) {
        errors.push(`LP position[${index}] missing required field: ${field}`);
      }
    });

    // Validate data types
    if (position.tokenId && typeof position.tokenId !== 'string') {
      errors.push(`LP position[${index}] tokenId must be a string`);
    }

    if (position.liquidity && !this.isValidBigNumber(position.liquidity)) {
      errors.push(`LP position[${index}] invalid liquidity value`);
    }

    // Validate Ethereum address
    if (position.owner && !ethers.utils.isAddress(position.owner)) {
      errors.push(`LP position[${index}] invalid owner address`);
    }

    // Validate status
    if (position.status && !Object.values(PositionStates).includes(position.status)) {
      this.validationWarnings.push(`LP position[${index}] unknown status: ${position.status}`);
    }

    // Check logical consistency
    if (position.status === PositionStates.ACTIVE && position.liquidity === '0') {
      this.validationWarnings.push(`LP position[${index}] active with zero liquidity`);
    }

    if (position.status === PositionStates.CLOSED && !position.closedAt) {
      this.validationWarnings.push(`LP position[${index}] closed without closedAt timestamp`);
    }

    errors.forEach(err => this.validationErrors.push(err));
    return errors;
  }

  /**
   * Check LP data consistency
   */
  checkLPDataConsistency(positions) {
    let activeCount = 0;
    let closedCount = 0;
    let totalLiquidity = ethers.BigNumber.from(0);

    positions.forEach(pos => {
      if (pos.status === PositionStates.ACTIVE) {
        activeCount++;
        if (pos.liquidity) {
          try {
            totalLiquidity = totalLiquidity.add(ethers.BigNumber.from(pos.liquidity));
          } catch (e) {
            this.validationErrors.push(`Invalid liquidity value in position ${pos.tokenId}`);
          }
        }
      } else if (pos.status === PositionStates.CLOSED) {
        closedCount++;
      }
    });

    // Sanity checks
    if (activeCount === 0 && positions.length > 0) {
      this.validationWarnings.push('No active LP positions found');
    }

    if (closedCount > positions.length * 0.9) {
      this.validationWarnings.push('More than 90% of positions are closed');
    }
  }

  /**
   * Validate stakes array
   */
  validateStakes(stakes) {
    if (!Array.isArray(stakes)) {
      this.validationErrors.push('Stakes must be an array');
      return;
    }

    const stakeIdSet = new Set();

    stakes.forEach((stake, index) => {
      // Check required fields
      this.requiredFields.stake.forEach(field => {
        if (!stake[field] && stake[field] !== 0) {
          this.validationErrors.push(`Stake[${index}] missing required field: ${field}`);
        }
      });

      // Check for duplicate IDs
      if (stake.id) {
        if (stakeIdSet.has(stake.id)) {
          this.validationErrors.push(`Duplicate stake ID: ${stake.id}`);
        }
        stakeIdSet.add(stake.id);
      }

      // Validate amounts
      if (stake.amount && !this.isValidBigNumber(stake.amount)) {
        this.validationErrors.push(`Stake[${index}] invalid amount`);
      }

      // Validate address
      if (stake.user && !ethers.utils.isAddress(stake.user)) {
        this.validationErrors.push(`Stake[${index}] invalid user address`);
      }
    });
  }

  /**
   * Validate creates array
   */
  validateCreates(creates) {
    if (!Array.isArray(creates)) {
      this.validationErrors.push('Creates must be an array');
      return;
    }

    creates.forEach((create, index) => {
      // Check required fields
      this.requiredFields.create.forEach(field => {
        if (!create[field] && create[field] !== 0) {
          this.validationErrors.push(`Create[${index}] missing required field: ${field}`);
        }
      });

      // Validate addresses
      if (create.user && !ethers.utils.isAddress(create.user)) {
        this.validationErrors.push(`Create[${index}] invalid user address`);
      }

      if (create.mintAddress && !ethers.utils.isAddress(create.mintAddress)) {
        this.validationErrors.push(`Create[${index}] invalid mint address`);
      }
    });
  }

  /**
   * Validate metadata
   */
  validateMetadata(data) {
    // Check timestamps
    if (data.lastUpdated) {
      if (!this.isValidTimestamp(data.lastUpdated)) {
        this.validationErrors.push('Invalid lastUpdated timestamp');
      }
    }

    if (data.lastLPUpdate && typeof data.lastLPUpdate !== 'number') {
      this.validationErrors.push('lastLPUpdate must be a block number');
    }

    // Check version
    if (data.version && typeof data.version !== 'string') {
      this.validationWarnings.push('Version should be a string');
    }
  }

  /**
   * Check if value is a valid BigNumber string
   */
  isValidBigNumber(value) {
    if (typeof value !== 'string') return false;
    try {
      ethers.BigNumber.from(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if value is a valid timestamp
   */
  isValidTimestamp(value) {
    const date = new Date(value);
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Get validation results
   */
  getResults() {
    return {
      isValid: this.validationErrors.length === 0,
      errors: this.validationErrors,
      warnings: this.validationWarnings,
      summary: {
        errorCount: this.validationErrors.length,
        warningCount: this.validationWarnings.length
      }
    };
  }

  /**
   * Generate validation report
   */
  generateReport() {
    const results = this.getResults();
    const report = [
      '='.repeat(50),
      'Data Validation Report',
      '='.repeat(50),
      `Status: ${results.isValid ? '✅ VALID' : '❌ INVALID'}`,
      `Errors: ${results.summary.errorCount}`,
      `Warnings: ${results.summary.warningCount}`,
      ''
    ];

    if (results.errors.length > 0) {
      report.push('ERRORS:');
      results.errors.forEach(err => report.push(`  ❌ ${err}`));
      report.push('');
    }

    if (results.warnings.length > 0) {
      report.push('WARNINGS:');
      results.warnings.forEach(warn => report.push(`  ⚠️  ${warn}`));
      report.push('');
    }

    report.push('='.repeat(50));
    return report.join('\n');
  }
}

/**
 * Quick validation function
 */
function validateData(data) {
  const validator = new DataValidator();
  return validator.validateCachedData(data);
}

/**
 * Repair common data issues
 */
function repairData(data) {
  const repaired = JSON.parse(JSON.stringify(data)); // Deep clone
  const repairs = [];

  // Fix LP positions
  if (repaired.lpPositions && Array.isArray(repaired.lpPositions)) {
    repaired.lpPositions = repaired.lpPositions.map(pos => {
      // Convert tokenId to string
      if (pos.tokenId && typeof pos.tokenId !== 'string') {
        pos.tokenId = pos.tokenId.toString();
        repairs.push(`Converted tokenId ${pos.tokenId} to string`);
      }

      // Fix missing status
      if (!pos.status) {
        pos.status = pos.liquidity === '0' ? PositionStates.CLOSED : PositionStates.ACTIVE;
        repairs.push(`Added missing status to position ${pos.tokenId}`);
      }

      // Add missing timestamps
      if (!pos.lastUpdated) {
        pos.lastUpdated = new Date().toISOString();
        repairs.push(`Added missing lastUpdated to position ${pos.tokenId}`);
      }

      return pos;
    });

    // Remove duplicates
    const seen = new Set();
    const uniquePositions = [];
    repaired.lpPositions.forEach(pos => {
      if (!seen.has(pos.tokenId)) {
        seen.add(pos.tokenId);
        uniquePositions.push(pos);
      } else {
        repairs.push(`Removed duplicate position ${pos.tokenId}`);
      }
    });
    repaired.lpPositions = uniquePositions;
  }

  // Add missing top-level fields
  if (!repaired.lastUpdated) {
    repaired.lastUpdated = new Date().toISOString();
    repairs.push('Added missing lastUpdated timestamp');
  }

  return {
    data: repaired,
    repairs
  };
}

module.exports = {
  DataValidator,
  validateData,
  repairData
};