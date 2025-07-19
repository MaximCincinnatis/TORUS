/**
 * Data Contracts for TORUS Dashboard
 * 
 * Type definitions and validation schemas for all data structures
 * Ensures consistency between backend updates and frontend consumption
 */

import { z } from 'zod';

// ========== Base Types ==========

/**
 * Ethereum address validation
 */
export const EthereumAddressSchema = z.string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
  .transform(addr => addr.toLowerCase());

/**
 * BigNumber string validation (for wei values)
 */
export const BigNumberStringSchema = z.string()
  .regex(/^\d+$/, 'Invalid BigNumber string');

/**
 * Numeric string that can be parsed to float
 */
export const NumericStringSchema = z.string()
  .refine(val => !isNaN(parseFloat(val)), 'Invalid numeric string');

// ========== LP Position Types ==========

/**
 * LP Position data structure
 * IMPORTANT: Frontend expects torusAmount/titanxAmount, not amount0/amount1
 */
export const LPPositionSchema = z.object({
  tokenId: z.string(),
  owner: EthereumAddressSchema,
  liquidity: BigNumberStringSchema,
  tickLower: z.number().int(),
  tickUpper: z.number().int(),
  
  // Token amounts - MUST use these field names for frontend compatibility
  torusAmount: z.number().min(0),
  titanxAmount: z.number().min(0),
  
  // Claimable fees
  claimableTorus: z.number().min(0),
  claimableTitanX: z.number().min(0),
  
  // Raw token owed values
  tokensOwed0: BigNumberStringSchema,
  tokensOwed1: BigNumberStringSchema,
  
  // Display fields
  fee: z.number().int(),
  inRange: z.boolean(),
  estimatedAPR: z.union([z.string(), z.number()]),
  priceRange: z.string(),
  
  // Price display fields
  lowerTitanxPerTorus: z.string().optional(),
  upperTitanxPerTorus: z.string().optional(),
  currentTitanxPerTorus: z.string().optional(),
  
  // Metadata
  lastUpdated: z.string().datetime().optional(),
  lastChecked: z.string().datetime().optional(),
  isNew: z.boolean().optional(),
  
  // Preserve custom fields
  manualData: z.any().optional(),
  customNotes: z.string().optional(),
  originalData: z.any().optional()
});

export type LPPosition = z.infer<typeof LPPositionSchema>;

// ========== Staking Types ==========

export const StakeEventSchema = z.object({
  user: EthereumAddressSchema,
  id: z.string(),
  principal: BigNumberStringSchema,
  shares: BigNumberStringSchema,
  duration: z.string(),
  timestamp: z.string(),
  blockNumber: z.number().int(),
  
  // Calculated fields
  stakingDays: z.number().int(),
  maturityDate: z.string().datetime(),
  startDate: z.string().datetime(),
  
  // Additional fields
  power: z.string().optional(),
  claimedCreate: z.boolean(),
  claimedStake: z.boolean(),
  costETH: z.string(),
  costTitanX: z.string(),
  rawCostETH: z.string(),
  rawCostTitanX: z.string(),
  rewards: z.string().optional(),
  penalties: z.string().optional(),
  claimedAt: z.string().optional(),
  isCreate: z.boolean().optional()
});

export type StakeEvent = z.infer<typeof StakeEventSchema>;

export const CreateEventSchema = z.object({
  user: EthereumAddressSchema,
  createId: z.string(),
  principal: BigNumberStringSchema,
  shares: BigNumberStringSchema,
  duration: z.string(),
  rewardDay: z.string(),
  timestamp: z.string(),
  referrer: EthereumAddressSchema.nullable(),
  blockNumber: z.number().int(),
  
  // Additional fields (matching stake structure)
  id: z.string(),
  stakingDays: z.number().int(),
  maturityDate: z.string().datetime(),
  startDate: z.string().datetime(),
  
  // Cost fields
  power: z.string().optional(),
  claimedCreate: z.boolean(),
  claimedStake: z.boolean().optional(),
  costETH: z.string(),
  costTitanX: z.string(),
  rawCostETH: z.string(),
  rawCostTitanX: z.string(),
  
  // For aggregation
  titanAmount: NumericStringSchema.optional()
});

export type CreateEvent = z.infer<typeof CreateEventSchema>;

// ========== Pool Data Types ==========

export const PoolDataSchema = z.object({
  sqrtPriceX96: BigNumberStringSchema,
  currentTick: z.number().int(),
  liquidity: BigNumberStringSchema.optional(),
  fee: z.number().int().optional(),
  token0: EthereumAddressSchema.optional(),
  token1: EthereumAddressSchema.optional()
});

export type PoolData = z.infer<typeof PoolDataSchema>;

// ========== Reward Pool Data ==========

export const RewardPoolEntrySchema = z.object({
  day: z.number().int().min(1),
  totalRewards: NumericStringSchema,
  totalShares: NumericStringSchema,
  rewardPerShare: z.number().min(0),
  penalties: NumericStringSchema.optional()
});

export type RewardPoolEntry = z.infer<typeof RewardPoolEntrySchema>;

// ========== Main Cached Data Structure ==========

export const CachedDataSchema = z.object({
  // Staking data
  stakingData: z.object({
    stakeEvents: z.array(StakeEventSchema),
    createEvents: z.array(CreateEventSchema),
    rewardPoolData: z.array(RewardPoolEntrySchema),
    currentProtocolDay: z.number().int().min(1),
    totalSupply: z.number().min(0),
    burnedSupply: z.number().min(0).optional(),
    metadata: z.object({
      currentBlock: z.number().int(),
      dailySupplySnapshot: z.object({
        day: z.number().int(),
        totalSupply: z.number(),
        burnedSupply: z.number(),
        timestamp: z.string().datetime()
      }).optional(),
      needsManualUpdate: z.boolean().optional(),
      reason: z.string().optional()
    }).optional(),
    lastBlock: z.number().int().optional()
  }),
  
  // LP Positions
  lpPositions: z.array(LPPositionSchema),
  
  // Uniswap V3 data
  uniswapV3: z.object({
    poolAddress: EthereumAddressSchema,
    torusAddress: EthereumAddressSchema,
    titanxAddress: EthereumAddressSchema,
    poolData: PoolDataSchema,
    ratio: z.object({
      titanxPerTorus: NumericStringSchema,
      torusPerTitanx: NumericStringSchema
    }),
    lpPositions: z.array(LPPositionSchema).optional()
  }).optional(),
  
  // Pool data (legacy/duplicate)
  poolData: PoolDataSchema.optional(),
  
  // Supply data
  totalSupply: z.number().min(0),
  
  // TitanX data - IMPORTANT: This is TORUS-specific burned amount
  totalTitanXBurnt: BigNumberStringSchema,
  titanxTotalSupply: BigNumberStringSchema,
  
  // Token prices
  tokenPrices: z.object({
    torus: z.object({
      usd: z.number().min(0),
      lastUpdated: z.string().datetime()
    }).optional(),
    titanx: z.object({
      usd: z.number().min(0),
      lastUpdated: z.string().datetime()
    }).optional()
  }).optional(),
  
  // Metadata
  lastUpdated: z.string().datetime(),
  lastFetch: z.string().datetime().optional(),
  version: z.string().optional(),
  metadata: z.any().optional()
});

export type CachedData = z.infer<typeof CachedDataSchema>;

// ========== Validation Functions ==========

/**
 * Validates LP position data and ensures required fields
 */
export function validateLPPosition(data: unknown): LPPosition {
  // First check if we need to map amount0/amount1 to torusAmount/titanxAmount
  const rawData = data as any;
  if (rawData && typeof rawData === 'object') {
    // Map fields if needed
    if ('amount0' in rawData && !('torusAmount' in rawData)) {
      rawData.torusAmount = rawData.amount0;
    }
    if ('amount1' in rawData && !('titanxAmount' in rawData)) {
      rawData.titanxAmount = rawData.amount1;
    }
  }
  
  return LPPositionSchema.parse(rawData);
}

/**
 * Validates array of LP positions
 */
export function validateLPPositions(positions: unknown[]): LPPosition[] {
  return positions.map(validateLPPosition);
}

/**
 * Validates entire cached data structure
 */
export function validateCachedData(data: unknown): CachedData {
  return CachedDataSchema.parse(data);
}

/**
 * Partial validation - only validates the parts that exist
 */
export function validatePartialCachedData(data: unknown): Partial<CachedData> {
  return CachedDataSchema.partial().parse(data);
}

// ========== Helper Functions ==========

/**
 * Ensures LP position has correct field names for frontend
 */
export function ensureLPFieldMapping(position: any): any {
  return {
    ...position,
    torusAmount: position.torusAmount ?? position.amount0 ?? 0,
    titanxAmount: position.titanxAmount ?? position.amount1 ?? 0
  };
}

/**
 * Validates and fixes common data issues
 */
export function sanitizeCachedData(data: any): CachedData {
  // Fix LP positions field mapping
  if (data.lpPositions && Array.isArray(data.lpPositions)) {
    data.lpPositions = data.lpPositions.map(ensureLPFieldMapping);
  }
  
  if (data.uniswapV3?.lpPositions && Array.isArray(data.uniswapV3.lpPositions)) {
    data.uniswapV3.lpPositions = data.uniswapV3.lpPositions.map(ensureLPFieldMapping);
  }
  
  // Ensure required fields have defaults
  data.lastUpdated = data.lastUpdated || new Date().toISOString();
  data.totalSupply = data.totalSupply || 0;
  data.totalTitanXBurnt = data.totalTitanXBurnt || "0";
  data.titanxTotalSupply = data.titanxTotalSupply || "0";
  
  return validateCachedData(data);
}

// ========== Type Guards ==========

export function isLPPosition(data: unknown): data is LPPosition {
  try {
    validateLPPosition(data);
    return true;
  } catch {
    return false;
  }
}

export function isStakeEvent(data: unknown): data is StakeEvent {
  try {
    StakeEventSchema.parse(data);
    return true;
  } catch {
    return false;
  }
}

export function isCreateEvent(data: unknown): data is CreateEvent {
  try {
    CreateEventSchema.parse(data);
    return true;
  } catch {
    return false;
  }
}