import { tickToPrice, isPositionInRange, calculatePositionValue } from './uniswapV3Math';

describe('Uniswap V3 Math Utilities', () => {
  test('tickToPrice calculates correct price', () => {
    // Test known tick values
    expect(tickToPrice(0)).toBeCloseTo(1, 5);
    expect(tickToPrice(10)).toBeCloseTo(1.001, 3);
    expect(tickToPrice(-10)).toBeCloseTo(0.999, 3);
    expect(tickToPrice(100)).toBeCloseTo(1.01005, 5);
  });

  test('isPositionInRange correctly identifies position status', () => {
    // Current tick is 173863
    const currentTick = 173863;
    
    // Position in range
    expect(isPositionInRange(currentTick, 170000, 180000)).toBe(true);
    expect(isPositionInRange(currentTick, 173863, 180000)).toBe(true);
    
    // Position out of range
    expect(isPositionInRange(currentTick, 180000, 190000)).toBe(false);
    expect(isPositionInRange(currentTick, 150000, 170000)).toBe(false);
    expect(isPositionInRange(currentTick, 173860, 173862)).toBe(false);
  });

  test('calculatePositionValue calculates total USD value', () => {
    // Test with some example values
    const amount0 = 100; // 100 TORUS
    const amount1 = 3500000; // 3.5M TitanX
    const token0PriceUSD = 1; // $1 per TORUS
    const token1PriceUSD = 0.00001; // $0.00001 per TitanX
    
    const totalValue = calculatePositionValue(amount0, amount1, token0PriceUSD, token1PriceUSD);
    expect(totalValue).toBeCloseTo(135, 1); // $100 + $35 = $135
  });
});