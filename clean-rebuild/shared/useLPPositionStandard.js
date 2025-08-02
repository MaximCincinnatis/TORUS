/**
 * LP Position Standardization Hook
 * Use this in all update scripts
 */

const { standardizeLPPosition, validateLPPosition } = require('../../src/utils/lpPositionContract');

/**
 * Standardize LP positions from any data source
 * @param {Array} rawPositions - Raw position data from any source
 * @param {Object} tokenInfo - Token configuration
 * @returns {Array} Standardized positions
 */
function standardizeLPPositions(rawPositions, tokenInfo = { token0IsTorus: true }) {
  console.log(`Standardizing ${rawPositions.length} LP positions...`);
  
  const standardized = rawPositions.map(raw => {
    // Convert to standard format
    const position = standardizeLPPosition(raw);
    
    // If we still have amount0/1 but no torus/titanx amounts, map them
    if (position.torusAmount === 0 && position.titanxAmount === 0 && 
        (raw.amount0 > 0 || raw.amount1 > 0)) {
      if (tokenInfo.token0IsTorus) {
        position.torusAmount = raw.amount0 || 0;
        position.titanxAmount = raw.amount1 || 0;
      } else {
        position.torusAmount = raw.amount1 || 0;
        position.titanxAmount = raw.amount0 || 0;
      }
    }
    
    return position;
  });
  
  // Validate all positions
  let validCount = 0;
  let invalidCount = 0;
  
  standardized.forEach(pos => {
    const { isValid, errors } = validateLPPosition(pos);
    if (isValid) {
      validCount++;
    } else {
      invalidCount++;
      console.warn(`Position ${pos.tokenId} validation errors:`, errors);
    }
  });
  
  console.log(`✅ Standardized: ${validCount} valid, ${invalidCount} invalid positions`);
  
  return standardized;
}

/**
 * Safe update that preserves existing data
 * @param {Array} newPositions - New position data
 * @param {Array} existingPositions - Current positions in cache
 * @returns {Array} Merged positions
 */
function safeMergeLPPositions(newPositions, existingPositions = []) {
  const merged = [];
  const processedIds = new Set();
  
  // Process new positions
  newPositions.forEach(newPos => {
    const existing = existingPositions.find(e => e.tokenId === newPos.tokenId);
    
    if (existing) {
      // Preserve non-zero amounts if new data has zeros
      if (newPos.torusAmount === 0 && newPos.titanxAmount === 0 &&
          existing.torusAmount > 0 && existing.titanxAmount > 0) {
        console.log(`Preserving amounts for position ${newPos.tokenId}`);
        merged.push({
          ...newPos,
          torusAmount: existing.torusAmount,
          titanxAmount: existing.titanxAmount
        });
      } else {
        merged.push(newPos);
      }
    } else {
      merged.push(newPos);
    }
    
    processedIds.add(newPos.tokenId);
  });
  
  // Keep existing positions not in new data
  existingPositions.forEach(existing => {
    if (!processedIds.has(existing.tokenId)) {
      console.log(`Keeping existing position ${existing.tokenId} not in update`);
      merged.push(existing);
    }
  });
  
  return merged;
}

module.exports = {
  standardizeLPPositions,
  safeMergeLPPositions
};