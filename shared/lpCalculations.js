/**
 * Shared LP Calculations Module
 * 
 * Single source of truth for all LP position calculations
 * Ensures consistent calculations across all update scripts
 */

const { ethers } = require('ethers');

/**
 * Calculate token amounts for a Uniswap V3 position
 * @param {Object} position - Position data from contract
 * @param {BigNumber} sqrtPriceX96 - Current pool sqrt price
 * @param {number} currentTick - Current pool tick
 * @returns {Object} { amount0, amount1 } in decimal format
 */
function calculatePositionAmounts(position, sqrtPriceX96, currentTick) {
  try {
    const liquidity = position.liquidity.toString();
    const tickLower = position.tickLower;
    const tickUpper = position.tickUpper;
    
    // Use BigInt for precision
    const liquidityBN = BigInt(liquidity);
    const sqrtPrice = BigInt(sqrtPriceX96.toString());
    const Q96 = BigInt(2) ** BigInt(96);
    
    // Calculate sqrt prices for the tick range
    const priceLower = Math.pow(1.0001, tickLower);
    const priceUpper = Math.pow(1.0001, tickUpper);
    
    // Convert to BigInt sqrt prices (multiply by 2^96 and take sqrt)
    const sqrtPriceLowerFloat = Math.sqrt(priceLower) * Math.pow(2, 96);
    const sqrtPriceUpperFloat = Math.sqrt(priceUpper) * Math.pow(2, 96);
    
    const sqrtPriceLower = BigInt(Math.floor(sqrtPriceLowerFloat));
    const sqrtPriceUpper = BigInt(Math.floor(sqrtPriceUpperFloat));
    
    let amount0 = BigInt(0);
    let amount1 = BigInt(0);
    
    // Calculate based on current price position
    if (sqrtPrice <= sqrtPriceLower) {
      // Current price is below the range, all liquidity is in token0
      amount0 = (liquidityBN * (sqrtPriceUpper - sqrtPriceLower) * Q96) / 
        (sqrtPriceUpper * sqrtPriceLower);
    } else if (sqrtPrice < sqrtPriceUpper) {
      // Current price is within the range
      amount0 = (liquidityBN * (sqrtPriceUpper - sqrtPrice) * Q96) / 
        (sqrtPriceUpper * sqrtPrice);
      amount1 = (liquidityBN * (sqrtPrice - sqrtPriceLower)) / Q96;
    } else {
      // Current price is above the range, all liquidity is in token1
      amount1 = (liquidityBN * (sqrtPriceUpper - sqrtPriceLower)) / Q96;
    }
    
    // Convert to decimal values
    const decimals0 = BigInt(10) ** BigInt(18);
    const decimals1 = BigInt(10) ** BigInt(18);
    
    const decimal0 = Number(amount0) / Number(decimals0);
    const decimal1 = Number(amount1) / Number(decimals1);
    
    return {
      amount0: decimal0,
      amount1: decimal1
    };
  } catch (error) {
    console.error('Error calculating position amounts:', error);
    return { amount0: 0, amount1: 0 };
  }
}

/**
 * Calculate claimable fees for a position
 * @param {string} tokenId - Position token ID
 * @param {string} owner - Position owner address
 * @param {Object} positionData - Position data from contract
 * @param {Object} provider - Ethers provider
 * @returns {Promise<Object>} { claimableTorus, claimableTitanX }
 */
async function calculateClaimableFees(tokenId, owner, positionData, provider) {
  const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
  
  try {
    // Try to simulate collect call for accurate fees
    const collectInterface = new ethers.utils.Interface([
      'function collect(tuple(uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max)) returns (uint256 amount0, uint256 amount1)'
    ]);
    
    const collectParams = {
      tokenId: tokenId,
      recipient: owner,
      amount0Max: '0xffffffffffffffffffffffffffffffff',
      amount1Max: '0xffffffffffffffffffffffffffffffff'
    };
    
    const collectData = collectInterface.encodeFunctionData('collect', [collectParams]);
    const result = await provider.call({
      to: NFT_POSITION_MANAGER,
      data: collectData,
      from: owner
    });
    
    const decoded = collectInterface.decodeFunctionResult('collect', result);
    return {
      claimableTorus: parseFloat(ethers.utils.formatEther(decoded.amount0)),
      claimableTitanX: parseFloat(ethers.utils.formatEther(decoded.amount1))
    };
    
  } catch (error) {
    // Fallback to tokensOwed if collect simulation fails
    console.log(`Collect simulation failed for position ${tokenId}, using tokensOwed`);
    return {
      claimableTorus: parseFloat(ethers.utils.formatEther(positionData.tokensOwed0 || '0')),
      claimableTitanX: parseFloat(ethers.utils.formatEther(positionData.tokensOwed1 || '0'))
    };
  }
}

/**
 * Map backend field names to frontend expectations
 * CRITICAL: All scripts MUST use this function for consistency
 * @param {Object} position - LP position data
 * @returns {Object} Position with proper field mapping
 */
function mapFieldNames(position) {
  const claimableTotal = (position.claimableTorus || 0) + (position.claimableTitanX || 0);
  
  return {
    ...position,
    // Map backend fields to frontend expectations
    torusAmount: position.amount0 || 0,
    titanxAmount: position.amount1 || 0,
    // Ensure claimable fields exist
    claimableYield: position.claimableYield !== undefined ? position.claimableYield : claimableTotal,
    // Preserve all other fields
  };
}

/**
 * Calculate price from sqrtPriceX96
 * @param {string|BigNumber} sqrtPriceX96 - Square root price in X96 format
 * @returns {number} Price of token1 per token0
 */
function calculatePrice(sqrtPriceX96) {
  const Q96 = ethers.BigNumber.from(2).pow(96);
  const sqrtPrice = ethers.BigNumber.from(sqrtPriceX96);
  const price = sqrtPrice.mul(sqrtPrice).mul(ethers.utils.parseEther('1')).div(Q96).div(Q96);
  return parseFloat(ethers.utils.formatEther(price));
}

/**
 * Calculate sqrt price at a specific tick
 * @param {number} tick - The tick value
 * @returns {string} sqrtPriceX96 as string
 */
function getSqrtPriceAtTick(tick) {
  const price = Math.pow(1.0001, tick);
  const sqrtPrice = Math.sqrt(price);
  const Q96 = Math.pow(2, 96);
  return Math.floor(sqrtPrice * Q96).toString();
}

/**
 * Format price for display
 * @param {number} price - Raw price value
 * @returns {string} Formatted price with appropriate units
 */
function formatPrice(price) {
  if (price >= 1e9) return (price / 1e9).toFixed(2) + 'B';
  if (price >= 1e6) return (price / 1e6).toFixed(2) + 'M';
  if (price >= 1e3) return (price / 1e3).toFixed(2) + 'K';
  return price.toFixed(2);
}

/**
 * Check if position is in range
 * @param {number} currentTick - Current pool tick
 * @param {number} tickLower - Position's lower tick
 * @param {number} tickUpper - Position's upper tick
 * @returns {boolean} True if position is in range
 */
function isPositionInRange(currentTick, tickLower, tickUpper) {
  return currentTick >= tickLower && currentTick < tickUpper;
}

/**
 * Merge LP positions preserving existing data
 * @param {Array} existingPositions - Current positions
 * @param {Array} newPositions - New/updated positions
 * @returns {Array} Merged positions array
 */
function mergeLPPositions(existingPositions, newPositions) {
  const positionMap = new Map();
  
  // Add existing positions
  if (existingPositions && Array.isArray(existingPositions)) {
    existingPositions.forEach(pos => {
      if (pos.tokenId) {
        positionMap.set(pos.tokenId, pos);
      }
    });
  }
  
  // Overlay new positions (will update if exists)
  if (newPositions && Array.isArray(newPositions)) {
    newPositions.forEach(pos => {
      if (pos.tokenId) {
        // Preserve certain fields from existing position if available
        const existing = positionMap.get(pos.tokenId);
        if (existing) {
          // Preserve manual fields that shouldn't be overwritten
          pos.manualNotes = existing.manualNotes;
          pos.customLabel = existing.customLabel;
        }
        // Apply field mapping
        positionMap.set(pos.tokenId, mapFieldNames(pos));
      }
    });
  }
  
  return Array.from(positionMap.values());
}

/**
 * Validate LP position data
 * @param {Object} position - Position to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateLPPosition(position) {
  const errors = [];
  
  // Required fields
  const required = ['tokenId', 'owner', 'liquidity', 'tickLower', 'tickUpper'];
  for (const field of required) {
    if (!position[field] && position[field] !== 0) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Type validations
  if (position.amount0 !== undefined && typeof position.amount0 !== 'number') {
    errors.push('amount0 must be a number');
  }
  if (position.amount1 !== undefined && typeof position.amount1 !== 'number') {
    errors.push('amount1 must be a number');
  }
  
  // Field mapping validation
  if (position.amount0 !== undefined && position.torusAmount === undefined) {
    errors.push('Missing torusAmount field mapping');
  }
  if (position.amount1 !== undefined && position.titanxAmount === undefined) {
    errors.push('Missing titanxAmount field mapping');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Normalize amount values handling different formats
 * @param {any} value - Value to normalize (string, bigint, number)
 * @returns {number} Normalized decimal value
 */
function normalizeAmount(value) {
  if (value === null || value === undefined) return 0;
  
  if (typeof value === 'bigint') {
    return Number(value) / 1e18;
  }
  
  if (typeof value === 'string') {
    // Handle hex strings
    if (value.startsWith('0x')) {
      return parseInt(value, 16) / 1e18;
    }
    return parseFloat(value) || 0;
  }
  
  if (typeof value === 'object' && value._hex) {
    // ethers.BigNumber format
    return parseFloat(ethers.utils.formatEther(value));
  }
  
  return Number(value) || 0;
}

module.exports = {
  calculatePositionAmounts,
  calculateClaimableFees,
  mapFieldNames,
  calculatePrice,
  getSqrtPriceAtTick,
  formatPrice,
  isPositionInRange,
  mergeLPPositions,
  validateLPPosition,
  normalizeAmount
};