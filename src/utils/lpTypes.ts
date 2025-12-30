/**
 * LP Position Types - Frontend-only, no RPC dependencies
 *
 * These types and functions are extracted from uniswapV3RealOwners.ts
 * to break the import chain that was triggering RPC connections on frontend.
 */

export interface SimpleLPPosition {
  tokenId: string;
  owner: string;
  liquidity: string;
  tickLower: number;
  tickUpper: number;
  torusAmount: number;  // Standard field - required
  titanxAmount: number; // Standard field - required
  inRange: boolean;
  isActive: boolean;     // Whether the position has liquidity and is active
  // Optional enhanced fields
  claimableTorus?: number;
  claimableTitanX?: number;
  estimatedAPR?: number;
  priceRange?: string;
  // Legacy fields for backward compatibility (deprecated)
  amount0?: number;
  amount1?: number;
}

// Get token info to identify which is TORUS and which is TitanX
// Hardcoded values - no RPC needed
export async function getTokenInfo() {
  // We already know from our analysis:
  // Token0 = TORUS (0xb47f575807fc5466285e1277ef8acfbb5c6686e8)
  // Token1 = TitanX (0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1)

  return {
    token0IsTorus: true,
    token0IsTitanX: false,
    token1IsTorus: false,
    token1IsTitanX: true,
    torusDecimals: 18,
    titanXDecimals: 18
  };
}
