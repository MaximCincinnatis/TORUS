/**
 * Simple LP Position Contract
 * One file, one truth, easy to understand
 */

// The ONLY valid LP position shape
const LP_POSITION_FIELDS = {
  tokenId: 'string',
  owner: 'string',
  torusAmount: 'number',
  titanxAmount: 'number',
  liquidity: 'string',
  tickLower: 'number',
  tickUpper: 'number',
  inRange: 'boolean'
};

// Convert any LP data to our standard format
function standardizeLPPosition(rawData) {
  // Handle different field names from various sources
  return {
    tokenId: rawData.tokenId || rawData.id,
    owner: rawData.owner,
    torusAmount: rawData.torusAmount ?? rawData.amount0 ?? 0,
    titanxAmount: rawData.titanxAmount ?? rawData.amount1 ?? 0,
    liquidity: rawData.liquidity || '0',
    tickLower: rawData.tickLower,
    tickUpper: rawData.tickUpper,
    inRange: rawData.inRange ?? false
  };
}

// Simple validation
function validateLPPosition(position) {
  const errors = [];
  
  // Check required fields
  for (const [field, type] of Object.entries(LP_POSITION_FIELDS)) {
    if (position[field] === undefined) {
      errors.push(`Missing ${field}`);
    } else if (typeof position[field] !== type) {
      errors.push(`${field} should be ${type}`);
    }
  }
  
  // Validate address format (simple check)
  if (position.owner && !/^0x[a-fA-F0-9]{40}$/.test(position.owner)) {
    errors.push('Invalid owner address format');
  }
  
  // Business rule: Can't have 0 amounts with liquidity
  if (position.liquidity !== '0' && 
      position.torusAmount === 0 && 
      position.titanxAmount === 0) {
    errors.push('Has liquidity but no token amounts');
  }
  
  return { isValid: errors.length === 0, errors };
}

// Use everywhere in the codebase
module.exports = {
  LP_POSITION_FIELDS,
  standardizeLPPosition,
  validateLPPosition
};