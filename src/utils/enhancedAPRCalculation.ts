import { SimpleLPPosition } from './uniswapV3RealOwners';
import { getHistoricalDataWithCache } from './cacheDataLoader';

const UNISWAP_V3_SUBGRAPH_URL = 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3';
const POOL_ADDRESS = '0x7ff1f30f6e7eec2ff3f0d1b60739115bdf88190f';
const FEE_TIER = 3000; // 0.3% fee tier for TORUS/TitanX pool

export interface PoolHistoricalData {
  date: string;
  volumeUSD: string;
  volumeToken0: string;
  volumeToken1: string;
  feesUSD: string;
  tvlUSD: string;
  liquidity: string;
  txCount: string;
}

export interface APRCalculationResult {
  sevenDayAPR: number;
  thirtyDayAPR: number;
  realTimeAPR: number;
  averageAPR: number;
  confidence: 'high' | 'medium' | 'low';
  dataPoints: number;
}

/**
 * Fetch historical pool data from Uniswap V3 subgraph
 */
export async function fetchPoolHistoricalData(days: number = 30): Promise<PoolHistoricalData[]> {
  const query = `
    query GetPoolHistoricalData($poolAddress: String!, $days: Int!) {
      poolDayDatas(
        first: $days,
        orderBy: date,
        orderDirection: desc,
        where: { pool: $poolAddress }
      ) {
        date
        volumeUSD
        volumeToken0
        volumeToken1
        feesUSD
        tvlUSD
        liquidity
        txCount
      }
    }
  `;

  try {
    const response = await fetch(UNISWAP_V3_SUBGRAPH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          poolAddress: POOL_ADDRESS.toLowerCase(),
          days,
        },
      }),
    });

    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return [];
    }

    return data.data?.poolDayDatas || [];
  } catch (error) {
    console.error('Error fetching pool historical data:', error);
    return [];
  }
}

/**
 * Calculate position's share of total pool liquidity
 */
export function calculateLiquidityShare(
  positionLiquidity: string, 
  totalPoolLiquidity: string
): number {
  try {
    const posLiq = BigInt(positionLiquidity);
    const totalLiq = BigInt(totalPoolLiquidity);
    
    if (totalLiq === BigInt(0)) return 0;
    
    // Calculate share as percentage (multiply by 10000 for precision, then divide by 100)
    const sharePercent = Number(posLiq * BigInt(10000) / totalLiq) / 100;
    return Math.min(sharePercent, 100); // Cap at 100%
  } catch (error) {
    console.error('Error calculating liquidity share:', error);
    return 0;
  }
}

/**
 * Calculate position value in USD (simplified)
 */
export function calculatePositionValueUSD(
  amount0: number,
  amount1: number,
  torusPrice: number = 0.00005, // Estimated TORUS price in USD
  titanXPrice: number = 0.000000001 // Estimated TitanX price in USD
): number {
  return (amount0 * torusPrice) + (amount1 * titanXPrice);
}

/**
 * Calculate APR based on historical volume data
 */
export function calculateVolumeBasedAPR(
  historicalData: PoolHistoricalData[],
  positionLiquidity: string,
  positionValueUSD: number,
  days: number
): number {
  if (historicalData.length === 0 || positionValueUSD <= 0) {
    return 0;
  }

  // Calculate average daily volume
  const totalVolumeUSD = historicalData.reduce((sum, day) => {
    return sum + parseFloat(day.volumeUSD || '0');
  }, 0);
  
  const avgDailyVolumeUSD = totalVolumeUSD / Math.max(historicalData.length, 1);

  // Calculate average liquidity
  const totalLiquidity = historicalData.reduce((sum, day) => {
    return sum + parseFloat(day.liquidity || '0');
  }, 0);
  
  const avgTotalLiquidity = totalLiquidity / Math.max(historicalData.length, 1);

  // Calculate position's average share of liquidity
  const liquidityShare = calculateLiquidityShare(
    positionLiquidity, 
    avgTotalLiquidity.toString()
  );

  // Calculate daily fee income
  // Fee income = daily volume * fee tier percentage * liquidity share
  const dailyFeeIncome = avgDailyVolumeUSD * (FEE_TIER / 1000000) * (liquidityShare / 100);

  // Calculate annual fee income
  const annualFeeIncome = dailyFeeIncome * 365;

  // Calculate APR as percentage
  const apr = (annualFeeIncome / positionValueUSD) * 100;

  return Math.max(0, apr); // Ensure non-negative
}

/**
 * Calculate real-time APR based on current claimable fees
 */
export function calculateRealTimeAPR(
  claimableTorus: number,
  claimableTitanX: number,
  positionValueUSD: number,
  daysSinceLastCollection: number = 7 // Default assumption
): number {
  if (positionValueUSD <= 0 || daysSinceLastCollection <= 0) {
    return 0;
  }

  // Convert claimable amounts to USD
  const torusPrice = 0.00005; // Estimated
  const titanXPrice = 0.000000001; // Estimated
  
  const claimableUSD = (claimableTorus * torusPrice) + (claimableTitanX * titanXPrice);

  // Calculate daily yield rate
  const dailyYieldRate = claimableUSD / positionValueUSD / daysSinceLastCollection;

  // Annualize to get APR
  const apr = dailyYieldRate * 365 * 100;

  return Math.max(0, apr);
}

/**
 * Enhanced APR calculation with multiple methods
 */
export async function calculateEnhancedAPR(
  position: SimpleLPPosition,
  claimableTorus: number = 0,
  claimableTitanX: number = 0
): Promise<APRCalculationResult> {
  try {
    console.log(`🧮 Calculating enhanced APR for position ${position.tokenId}`);

    // Fetch historical data with cache fallback
    const [sevenDayResult, thirtyDayResult] = await Promise.all([
      getHistoricalDataWithCache(7, fetchPoolHistoricalData),
      getHistoricalDataWithCache(30, fetchPoolHistoricalData)
    ]);
    
    const sevenDayData = sevenDayResult.data;
    const thirtyDayData = thirtyDayResult.data;
    
    console.log(`📊 Historical data sources: 7d=${sevenDayResult.source}, 30d=${thirtyDayResult.source}`);

    console.log(`📊 Historical data: 7-day (${sevenDayData.length} points), 30-day (${thirtyDayData.length} points)`);

    // Calculate position value in USD
    const positionValueUSD = calculatePositionValueUSD(
      position.amount0,
      position.amount1
    );

    console.log(`💰 Position value: $${positionValueUSD.toFixed(4)} USD`);

    let sevenDayAPR = 0;
    let thirtyDayAPR = 0;
    let realTimeAPR = 0;

    // Calculate volume-based APRs
    if (sevenDayData.length > 0) {
      sevenDayAPR = calculateVolumeBasedAPR(
        sevenDayData,
        position.liquidity,
        positionValueUSD,
        7
      );
      console.log(`📈 7-day volume-based APR: ${sevenDayAPR.toFixed(2)}%`);
    }

    if (thirtyDayData.length > 0) {
      thirtyDayAPR = calculateVolumeBasedAPR(
        thirtyDayData,
        position.liquidity,
        positionValueUSD,
        30
      );
      console.log(`📈 30-day volume-based APR: ${thirtyDayAPR.toFixed(2)}%`);
    }

    // Calculate real-time APR from claimable fees
    if (claimableTorus > 0 || claimableTitanX > 0) {
      realTimeAPR = calculateRealTimeAPR(
        claimableTorus,
        claimableTitanX,
        positionValueUSD
      );
      console.log(`⚡ Real-time APR: ${realTimeAPR.toFixed(2)}%`);
    }

    // Calculate weighted average APR
    const aprs = [sevenDayAPR, thirtyDayAPR, realTimeAPR].filter(apr => apr > 0);
    const averageAPR = aprs.length > 0 ? aprs.reduce((sum, apr) => sum + apr, 0) / aprs.length : 0;

    // Determine confidence based on available data
    let confidence: 'high' | 'medium' | 'low' = 'low';
    const totalDataPoints = sevenDayData.length + thirtyDayData.length;
    
    if (totalDataPoints >= 30 && aprs.length >= 2) {
      confidence = 'high';
    } else if (totalDataPoints >= 7 && aprs.length >= 1) {
      confidence = 'medium';
    }

    console.log(`✅ Enhanced APR calculation complete - Average: ${averageAPR.toFixed(2)}% (${confidence} confidence)`);

    return {
      sevenDayAPR,
      thirtyDayAPR,
      realTimeAPR,
      averageAPR,
      confidence,
      dataPoints: totalDataPoints
    };

  } catch (error) {
    console.error('❌ Error calculating enhanced APR:', error);
    
    // Fallback to simple calculation
    const fallbackAPR = position.estimatedAPR || 0;
    
    return {
      sevenDayAPR: fallbackAPR,
      thirtyDayAPR: fallbackAPR,
      realTimeAPR: fallbackAPR,
      averageAPR: fallbackAPR,
      confidence: 'low',
      dataPoints: 0
    };
  }
}

/**
 * Get APR display string with confidence indicator
 */
export function formatAPRDisplay(aprResult: APRCalculationResult): string {
  const { averageAPR, confidence } = aprResult;
  
  if (averageAPR === 0) {
    return 'N/A';
  }

  const confidenceSymbol = confidence === 'high' ? '🟢' : confidence === 'medium' ? '🟡' : '🔴';
  
  return `${averageAPR.toFixed(1)}% ${confidenceSymbol}`;
}