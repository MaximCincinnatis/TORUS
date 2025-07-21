/**
 * World-Class LP Position Data Contract
 * Single source of truth for LP position data
 */

import { z } from 'zod';

// Define the canonical data structure
export const LPPositionSchema = z.object({
  tokenId: z.string(),
  owner: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  
  // Canonical field names - ONLY these are used
  torusAmount: z.number().min(0),
  titanxAmount: z.number().min(0),
  
  tickLower: z.number(),
  tickUpper: z.number(),
  liquidity: z.string(),
  
  inRange: z.boolean(),
  claimableYield: z.number().optional(),
  estimatedAPR: z.number().optional(),
  priceRange: z.string().optional(),
  
  // Metadata
  lastUpdated: z.string().datetime(),
  updateSource: z.enum(['blockchain', 'cache', 'manual']),
});

export type LPPosition = z.infer<typeof LPPositionSchema>;

// Validation with detailed errors
export function validateLPPosition(data: unknown): LPPosition {
  return LPPositionSchema.parse(data);
}

// Safe parsing with error details
export function safeParseLPPosition(data: unknown): 
  { success: true; data: LPPosition } | 
  { success: false; error: string } {
  const result = LPPositionSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { 
    success: false, 
    error: result.error.errors.map(e => `${e.path}: ${e.message}`).join(', ')
  };
}

// Business rule validations
export function validateBusinessRules(position: LPPosition): string[] {
  const errors: string[] = [];
  
  // Both amounts can't be 0 if position has liquidity
  if (position.torusAmount === 0 && position.titanxAmount === 0) {
    if (position.liquidity !== '0') {
      errors.push('Position has liquidity but both amounts are 0');
    }
  }
  
  // Tick validation
  if (position.tickLower >= position.tickUpper) {
    errors.push('Invalid tick range: tickLower must be less than tickUpper');
  }
  
  return errors;
}