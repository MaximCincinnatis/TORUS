// Constants for Uniswap V3 calculations
const Q96 = BigInt(2) ** BigInt(96);
const Q128 = BigInt(2) ** BigInt(128);

export function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick);
}

export function tickToTitanXPrice(tick: number): number {
  // Convert tick to price (how much TitanX per 1 TORUS)
  // Since token1 is TitanX and token0 is TORUS, we need to invert the price
  const price = Math.pow(1.0001, tick);
  const titanXPrice = 1 / price; // This gives us TitanX per TORUS
  
  // Handle edge cases where price becomes infinity or very close to 0
  // For very negative ticks, titanXPrice will be extremely large
  // For very positive ticks, titanXPrice will be close to 0
  if (!isFinite(titanXPrice)) {
    // Return a very large number for negative infinity case
    return 1e15; // 1 quadrillion TitanX per TORUS
  }
  
  if (titanXPrice <= 0) {
    return 1e-15; // Very small but not 0
  }
  
  return titanXPrice;
}

export function sqrtPriceX96ToPrice(sqrtPriceX96: string, token0Decimals: number, token1Decimals: number): number {
  const sqrtPrice = BigInt(sqrtPriceX96);
  const price = (sqrtPrice * sqrtPrice * BigInt(10) ** BigInt(token0Decimals)) / 
    (Q96 * Q96) / (BigInt(10) ** BigInt(token1Decimals));
  return Number(price) / Math.pow(10, token0Decimals - token1Decimals);
}

export function calculateTokenAmounts(
  liquidity: string,
  sqrtPriceX96: string,
  tickLower: number,
  tickUpper: number,
  token0Decimals: number,
  token1Decimals: number
): { amount0: number; amount1: number } {
  const liquidityBN = BigInt(liquidity);
  const sqrtPrice = BigInt(sqrtPriceX96);
  
  // Calculate sqrt prices for the tick range using BigInt-safe arithmetic
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
  
  // Convert to decimal values using BigInt arithmetic for precision
  const decimals0 = BigInt(10) ** BigInt(token0Decimals);
  const decimals1 = BigInt(10) ** BigInt(token1Decimals);
  
  const decimal0 = Number(amount0) / Number(decimals0);
  const decimal1 = Number(amount1) / Number(decimals1);
  
  return {
    amount0: decimal0,
    amount1: decimal1
  };
}

export function calculatePositionValue(
  amount0: number,
  amount1: number,
  token0PriceUSD: number,
  token1PriceUSD: number
): number {
  return amount0 * token0PriceUSD + amount1 * token1PriceUSD;
}

export function isPositionInRange(currentTick: number, tickLower: number, tickUpper: number): boolean {
  return currentTick >= tickLower && currentTick < tickUpper;
}