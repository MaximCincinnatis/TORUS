#!/usr/bin/env node

/**
 * LP Amount Validation Script
 * Prevents zero amounts from being written to JSON
 */

const fs = require('fs');
const path = require('path');

function validateLPAmounts(positions) {
  const issues = [];
  let zeroAmountCount = 0;
  let bothZeroCount = 0;
  
  positions.forEach((position, index) => {
    // Check for suspicious zero amounts
    if (position.torusAmount === 0 && position.titanxAmount === 0) {
      if (position.liquidity && position.liquidity !== '0') {
        issues.push({
          tokenId: position.tokenId,
          issue: 'Both amounts are 0 but position has liquidity',
          liquidity: position.liquidity
        });
        bothZeroCount++;
      }
    } else if (position.torusAmount === 0 || position.titanxAmount === 0) {
      zeroAmountCount++;
      // This might be legitimate (out of range), but log it
    }
    
    // Check for missing amount fields
    if (position.torusAmount === undefined && position.amount0 === undefined) {
      issues.push({
        tokenId: position.tokenId,
        issue: 'Missing torusAmount and amount0 fields'
      });
    }
    
    if (position.titanxAmount === undefined && position.amount1 === undefined) {
      issues.push({
        tokenId: position.tokenId,
        issue: 'Missing titanxAmount and amount1 fields'
      });
    }
  });
  
  return {
    totalPositions: positions.length,
    zeroAmountCount,
    bothZeroCount,
    issues,
    isValid: issues.length === 0 && bothZeroCount === 0
  };
}

// Function to check before writing to JSON
function safeUpdateLPPositions(newPositions, existingPositions) {
  const validation = validateLPAmounts(newPositions);
  
  if (!validation.isValid) {
    console.error('⚠️  LP Amount Validation Failed!');
    console.log(`Total positions: ${validation.totalPositions}`);
    console.log(`Positions with one zero amount: ${validation.zeroAmountCount} (might be out of range)`);
    console.log(`Positions with BOTH zero amounts: ${validation.bothZeroCount} (SUSPICIOUS!)`);
    
    if (validation.issues.length > 0) {
      console.log('\nIssues found:');
      validation.issues.forEach(issue => {
        console.log(`- Token ${issue.tokenId}: ${issue.issue}`);
      });
    }
    
    // If more than 50% have both amounts as 0, something is wrong
    const zeroPercentage = (validation.bothZeroCount / validation.totalPositions) * 100;
    if (zeroPercentage > 50) {
      console.error(`\n❌ REJECTED: ${zeroPercentage.toFixed(1)}% of positions have both amounts as 0!`);
      console.error('This likely indicates a calculation error. Not updating.');
      return existingPositions; // Return existing data instead
    }
  }
  
  // Merge with existing data, preserving non-zero amounts
  const merged = newPositions.map(newPos => {
    const existing = existingPositions.find(e => e.tokenId === newPos.tokenId);
    if (existing) {
      // If new calculation has 0 but existing has values, keep existing
      if (newPos.torusAmount === 0 && newPos.titanxAmount === 0 && 
          existing.torusAmount > 0 && existing.titanxAmount > 0) {
        console.log(`Preserving amounts for position ${newPos.tokenId}`);
        return {
          ...newPos,
          torusAmount: existing.torusAmount,
          titanxAmount: existing.titanxAmount
        };
      }
    }
    return newPos;
  });
  
  console.log('✅ LP positions validated and merged successfully');
  return merged;
}

// If run directly, validate the current cached data
if (require.main === module) {
  const cachedDataPath = path.join(__dirname, '../public/data/cached-data.json');
  
  try {
    const data = JSON.parse(fs.readFileSync(cachedDataPath, 'utf8'));
    const validation = validateLPAmounts(data.lpPositions || []);
    
    console.log('=== Current LP Position Validation ===');
    console.log(`Total positions: ${validation.totalPositions}`);
    console.log(`Valid: ${validation.isValid ? '✅ YES' : '❌ NO'}`);
    console.log(`Positions with one zero amount: ${validation.zeroAmountCount}`);
    console.log(`Positions with BOTH zero amounts: ${validation.bothZeroCount}`);
    
    if (validation.issues.length > 0) {
      console.log('\nIssues:');
      validation.issues.slice(0, 10).forEach(issue => {
        console.log(`- ${JSON.stringify(issue)}`);
      });
    }
  } catch (error) {
    console.error('Error reading cached data:', error);
  }
}

module.exports = { validateLPAmounts, safeUpdateLPPositions };