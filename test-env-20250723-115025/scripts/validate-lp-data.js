#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { DataValidator, validateData, repairData } = require('../utils/dataValidation');
const { backupLPData } = require('../utils/dataBackup');

const DATA_FILE = path.join(__dirname, '../data/cached-data.json');

/**
 * Run data validation
 */
async function runValidation(options = {}) {
  console.log('Running LP Data Validation...');
  console.log('='.repeat(50));

  try {
    // Load data
    const dataContent = await fs.readFile(DATA_FILE, 'utf8');
    const data = JSON.parse(dataContent);

    // Create validator
    const validator = new DataValidator();
    const results = validator.validateCachedData(data);

    // Generate and display report
    const report = validator.generateReport();
    console.log(report);

    // If repair mode is enabled
    if (options.repair && !results.isValid) {
      console.log('\nAttempting to repair data...');
      
      // Backup before repair
      await backupLPData(data, path.join(__dirname, '../backups'));
      
      // Repair data
      const repairResult = repairData(data);
      
      if (repairResult.repairs.length > 0) {
        console.log('\nRepairs made:');
        repairResult.repairs.forEach(repair => {
          console.log(`  ✓ ${repair}`);
        });

        // Validate repaired data
        const revalidation = validator.validateCachedData(repairResult.data);
        console.log(`\nValidation after repair: ${revalidation.isValid ? '✅ VALID' : '❌ STILL INVALID'}`);

        if (options.save && revalidation.isValid) {
          // Save repaired data
          await fs.writeFile(DATA_FILE, JSON.stringify(repairResult.data, null, 2));
          console.log('\n✅ Repaired data saved successfully');
        }
      } else {
        console.log('\nNo automatic repairs available');
      }
    }

    // Return results for programmatic use
    return {
      success: true,
      valid: results.isValid,
      errors: results.errors,
      warnings: results.warnings
    };

  } catch (error) {
    console.error('Validation failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Validate specific LP position
 */
async function validatePosition(tokenId) {
  try {
    const dataContent = await fs.readFile(DATA_FILE, 'utf8');
    const data = JSON.parse(dataContent);

    const position = data.lpPositions.find(p => p.tokenId === tokenId);
    
    if (!position) {
      console.log(`Position ${tokenId} not found`);
      return;
    }

    console.log(`\nValidating Position ${tokenId}:`);
    console.log('='.repeat(30));

    const validator = new DataValidator();
    const errors = validator.validateLPPosition(position, 0);

    if (errors.length === 0) {
      console.log('✅ Position is valid');
    } else {
      console.log('❌ Validation errors:');
      errors.forEach(err => console.log(`  - ${err}`));
    }

    // Display position details
    console.log('\nPosition Details:');
    console.log(`  Owner: ${position.owner}`);
    console.log(`  Liquidity: ${position.liquidity}`);
    console.log(`  Status: ${position.status || 'unknown'}`);
    console.log(`  Pool: ${position.pool}`);
    
    if (position.closedAt) {
      console.log(`  Closed At: ${position.closedAt}`);
      console.log(`  Closure Reason: ${position.closureReason || 'unknown'}`);
    }

  } catch (error) {
    console.error('Failed to validate position:', error.message);
  }
}

/**
 * Generate validation summary
 */
async function generateSummary() {
  try {
    const dataContent = await fs.readFile(DATA_FILE, 'utf8');
    const data = JSON.parse(dataContent);

    console.log('\nData Summary:');
    console.log('='.repeat(50));
    console.log(`Total LP Positions: ${data.lpPositions?.length || 0}`);
    console.log(`Total Stakes: ${data.stakes?.length || 0}`);
    console.log(`Total Creates: ${data.creates?.length || 0}`);
    
    if (data.lpPositions) {
      const statusCounts = {};
      data.lpPositions.forEach(pos => {
        const status = pos.status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      console.log('\nLP Positions by Status:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
    }

    console.log(`\nLast Updated: ${data.lastUpdated || 'unknown'}`);
    console.log(`Last LP Update Block: ${data.lastLPUpdate || 'unknown'}`);

  } catch (error) {
    console.error('Failed to generate summary:', error.message);
  }
}

// CLI handling
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'repair') {
    runValidation({ repair: true, save: true });
  } else if (command === 'check') {
    runValidation({ repair: false });
  } else if (command === 'position' && args[1]) {
    validatePosition(args[1]);
  } else if (command === 'summary') {
    generateSummary();
  } else {
    console.log('Usage:');
    console.log('  node validate-lp-data.js check      - Check data validity');
    console.log('  node validate-lp-data.js repair     - Check and repair data');
    console.log('  node validate-lp-data.js position <tokenId> - Validate specific position');
    console.log('  node validate-lp-data.js summary    - Generate data summary');
  }
}

module.exports = { runValidation, validatePosition };