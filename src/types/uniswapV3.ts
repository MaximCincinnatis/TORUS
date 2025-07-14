export interface UniswapV3Position {
  id: string;
  owner: string;
  liquidity: string;
  tickLower: number;
  tickUpper: number;
  token0: {
    symbol: string;
    decimals: number;
    id: string;
  };
  token1: {
    symbol: string;
    decimals: number;
    id: string;
  };
  depositedToken0: string;
  depositedToken1: string;
  withdrawnToken0: string;
  withdrawnToken1: string;
  collectedFeesToken0: string;
  collectedFeesToken1: string;
  pool: {
    sqrtPrice: string;
    tick: number;
    token0Price: string;
    token1Price: string;
  };
}

export interface LPPositionDisplay {
  owner: string;
  titanXAmount: number;
  torusAmount: number;
  totalValueUSD: number;
  feesEarnedUSD: number;
  liquidityValue: string;
  priceRange: {
    lower: number;
    upper: number;
    inRange: boolean;
  };
}

export interface PoolData {
  id: string;
  sqrtPrice: string;
  tick: number;
  liquidity: string;
  token0Price: string;
  token1Price: string;
  totalValueLockedUSD: string;
  volumeUSD: string;
  feesUSD: string;
}