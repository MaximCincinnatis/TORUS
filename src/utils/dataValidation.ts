/**
 * Data Validation Utilities
 * 
 * Uses data contracts to validate and sanitize data
 * Prevents invalid data from corrupting the dashboard
 */

import {
  validateLPPosition,
  validateLPPositions,
  validateCachedData,
  sanitizeCachedData,
  isLPPosition,
  LPPosition,
  CachedData,
  ensureLPFieldMapping
} from '../types/data-contracts';

/**
 * Validates LP position and logs any issues
 */
export function validateAndLogLPPosition(position: any, index: number): LPPosition | null {
  try {
    // Ensure field mapping first
    const mapped = ensureLPFieldMapping(position);
    const validated = validateLPPosition(mapped);
    
    // Additional business logic validation
    if (validated.torusAmount === 0 && validated.titanxAmount === 0 && validated.liquidity !== "0") {
      console.warn(`LP Position ${validated.tokenId} has liquidity but zero amounts - may need recalculation`);
    }
    
    if (validated.claimableTorus === 0 && validated.claimableTitanX === 0 && validated.inRange) {
      console.warn(`LP Position ${validated.tokenId} is in range but has zero claimable fees`);
    }
    
    return validated;
  } catch (error) {
    console.error(`Invalid LP position at index ${index}:`, error);
    console.error('Position data:', position);
    return null;
  }
}

/**
 * Validates array of LP positions, filtering out invalid ones
 */
export function validateAndFilterLPPositions(positions: any[]): LPPosition[] {
  const validated = positions
    .map((pos, idx) => validateAndLogLPPosition(pos, idx))
    .filter((pos): pos is LPPosition => pos !== null);
  
  console.log(`Validated ${validated.length} of ${positions.length} LP positions`);
  
  if (validated.length < positions.length) {
    console.warn(`Filtered out ${positions.length - validated.length} invalid LP positions`);
  }
  
  return validated;
}

/**
 * Validates cached data before saving
 */
export function validateBeforeSave(data: any): CachedData {
  try {
    // Sanitize first to fix common issues
    const sanitized = sanitizeCachedData(data);
    
    // Additional validation
    if (sanitized.lpPositions.length === 0) {
      console.warn('Warning: No LP positions in data');
    }
    
    if (sanitized.stakingData.stakeEvents.length === 0) {
      console.warn('Warning: No stake events in data');
    }
    
    // Check TitanX burned is reasonable (should be ~130B, not 999B)
    const titanxBurned = parseFloat(sanitized.totalTitanXBurnt) / 1e18 / 1e9;
    if (titanxBurned > 500) {
      console.error(`TitanX burned amount seems too high: ${titanxBurned.toFixed(3)}B`);
      console.error('This might be showing total dead address balance instead of TORUS-specific burns');
    }
    
    return sanitized;
  } catch (error) {
    console.error('Data validation failed:', error);
    throw new Error(`Invalid data structure: ${error}`);
  }
}

/**
 * Checks if LP position data is likely corrupted
 */
export function isLPPositionCorrupted(position: LPPosition): boolean {
  // Check for common corruption patterns
  const issues = [];
  
  // Zero amounts with non-zero liquidity
  if (position.liquidity !== "0" && position.torusAmount === 0 && position.titanxAmount === 0) {
    issues.push('Zero amounts despite having liquidity');
  }
  
  // Claimable exceeds position value (impossible)
  if (position.claimableTorus > position.torusAmount * 100) {
    issues.push('Claimable TORUS exceeds reasonable bounds');
  }
  
  if (position.claimableTitanX > position.titanxAmount * 100) {
    issues.push('Claimable TitanX exceeds reasonable bounds');
  }
  
  // In range but zero APR
  if (position.inRange && parseFloat(String(position.estimatedAPR)) === 0) {
    issues.push('In range position with 0% APR');
  }
  
  if (issues.length > 0) {
    console.warn(`Position ${position.tokenId} may be corrupted:`, issues);
    return true;
  }
  
  return false;
}

/**
 * Merges LP positions while preserving data integrity
 */
export function mergeLPPositionsWithValidation(
  existing: LPPosition[],
  updates: any[]
): LPPosition[] {
  // Validate both arrays
  const validExisting = validateAndFilterLPPositions(existing);
  const validUpdates = validateAndFilterLPPositions(updates);
  
  // Create map for merging
  const positionMap = new Map<string, LPPosition>();
  
  // Add existing positions
  validExisting.forEach(pos => {
    if (!isLPPositionCorrupted(pos)) {
      positionMap.set(pos.tokenId, pos);
    }
  });
  
  // Merge updates
  validUpdates.forEach(update => {
    const existing = positionMap.get(update.tokenId);
    
    // If update has zero amounts but existing has values, keep existing
    if (existing && 
        update.torusAmount === 0 && 
        update.titanxAmount === 0 && 
        existing.torusAmount > 0) {
      console.log(`Preserving existing amounts for position ${update.tokenId}`);
      return;
    }
    
    // Otherwise use the update
    if (!isLPPositionCorrupted(update)) {
      positionMap.set(update.tokenId, update);
    }
  });
  
  const merged = Array.from(positionMap.values());
  console.log(`Merged to ${merged.length} valid LP positions`);
  
  return merged;
}

/**
 * Validates reward pool data
 */
export function validateRewardPoolData(data: any[]): boolean {
  if (!Array.isArray(data)) {
    console.error('Reward pool data is not an array');
    return false;
  }
  
  // Check for required days
  const days = data.map(entry => entry.day);
  const missingDays = [];
  
  for (let day = 1; day <= 88; day++) {
    if (!days.includes(day)) {
      missingDays.push(day);
    }
  }
  
  if (missingDays.length > 0) {
    console.warn(`Missing reward pool data for days: ${missingDays.join(', ')}`);
  }
  
  return true;
}

/**
 * Creates a data integrity report
 */
export function createDataIntegrityReport(data: CachedData): {
  valid: boolean;
  issues: string[];
  warnings: string[];
  stats: Record<string, number>;
} {
  const issues: string[] = [];
  const warnings: string[] = [];
  const stats: Record<string, number> = {};
  
  // Collect stats
  stats.lpPositions = data.lpPositions.length;
  stats.stakeEvents = data.stakingData.stakeEvents.length;
  stats.createEvents = data.stakingData.createEvents.length;
  stats.rewardPoolDays = data.stakingData.rewardPoolData.length;
  stats.currentDay = data.stakingData.currentProtocolDay;
  
  // Check LP positions
  const corruptedPositions = data.lpPositions.filter(isLPPositionCorrupted);
  if (corruptedPositions.length > 0) {
    issues.push(`${corruptedPositions.length} potentially corrupted LP positions`);
  }
  
  const zeroValuePositions = data.lpPositions.filter(
    p => p.torusAmount === 0 && p.titanxAmount === 0 && p.liquidity !== "0"
  );
  if (zeroValuePositions.length > 0) {
    warnings.push(`${zeroValuePositions.length} positions with zero token amounts`);
  }
  
  // Check TitanX burned
  const titanxBurned = parseFloat(data.totalTitanXBurnt) / 1e18 / 1e9;
  if (titanxBurned > 500) {
    issues.push(`TitanX burned amount too high: ${titanxBurned.toFixed(3)}B (expected ~130B)`);
  }
  stats.titanxBurnedBillions = parseFloat(titanxBurned.toFixed(3));
  
  // Check reward pool data
  if (data.stakingData.rewardPoolData.length < 88) {
    warnings.push(`Only ${data.stakingData.rewardPoolData.length} days of reward pool data (expected 88)`);
  }
  
  return {
    valid: issues.length === 0,
    issues,
    warnings,
    stats
  };
}