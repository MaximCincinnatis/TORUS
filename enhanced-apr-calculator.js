// Enhanced APR Calculator for Auto-Update Scripts
// JavaScript version of enhancedAPRCalculation.ts

const fetch = require('node-fetch');

// Use alternative endpoint or disable for now
const UNISWAP_V3_SUBGRAPH_URL = null; // Disabled due to deprecated endpoint
const POOL_ADDRESS = '0x7ff1f30f6e7eec2ff3f0d1b60739115bdf88190f';
const FEE_TIER = 3000; // 0.3% fee tier for TORUS/TitanX pool

// Cache for historical data to avoid repeated API calls
let historicalDataCache = {
  data: null,
  timestamp: null,
  ttl: 3600000 // 1 hour TTL
};

/**
 * Fetch historical pool data from Uniswap V3 subgraph
 */
async function fetchPoolHistoricalData(days = 30) {
  // Historical data temporarily disabled due to subgraph deprecation
  // Will be re-enabled when new endpoint is configured
  return [];
}

/**
 * Get cached historical data or fetch new data
 */
async function getHistoricalDataWithCache(days = 30) {
  const now = Date.now();
  
  // Return cached data if still valid
  if (historicalDataCache.data && 
      historicalDataCache.timestamp && 
      (now - historicalDataCache.timestamp) < historicalDataCache.ttl) {
    return {
      data: historicalDataCache.data,
      source: 'cache'
    };
  }
  
  // Fetch new data
  const data = await fetchPoolHistoricalData(days);
  
  // Update cache
  historicalDataCache = {
    data: data,
    timestamp: now,
    ttl: 3600000
  };
  
  return {
    data: data,
    source: 'api'
  };
}

/**
 * Calculate position's share of total pool liquidity
 */
function calculateLiquidityShare(positionLiquidity, totalPoolLiquidity) {
  try {
    const posLiq = BigInt(positionLiquidity);
    const totalLiq = BigInt(totalPoolLiquidity);
    
    if (totalLiq === BigInt(0)) return 0;
    
    // Calculate share as percentage
    const sharePercent = Number(posLiq * BigInt(10000) / totalLiq) / 100;
    return Math.min(sharePercent, 100); // Cap at 100%
  } catch (error) {
    console.error('Error calculating liquidity share:', error);
    return 0;
  }
}

/**
 * Calculate position value in USD
 */
function calculatePositionValueUSD(amount0, amount1, torusPrice = 428.23, titanXPrice = 0.00001) {
  return (amount0 * torusPrice) + (amount1 * titanXPrice);
}

/**
 * Calculate APR based on historical volume data
 */
function calculateVolumeBasedAPR(historicalData, positionLiquidity, positionValueUSD) {
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

  // Calculate position's share of liquidity
  const liquidityShare = calculateLiquidityShare(
    positionLiquidity, 
    avgTotalLiquidity.toString()
  );

  // Calculate daily fee income
  const dailyFeeIncome = avgDailyVolumeUSD * (FEE_TIER / 1000000) * (liquidityShare / 100);

  // Calculate annual fee income
  const annualFeeIncome = dailyFeeIncome * 365;

  // Calculate APR as percentage
  const apr = (annualFeeIncome / positionValueUSD) * 100;

  return Math.max(0, apr);
}

/**
 * Calculate real-time APR based on current claimable fees
 */
function calculateRealTimeAPR(claimableTorus, claimableTitanX, positionValueUSD, daysSinceLastCollection = 7, torusPrice = 428.23, titanXPrice = 0.00001) {
  if (positionValueUSD <= 0 || daysSinceLastCollection <= 0) {
    return 0;
  }

  // Convert claimable amounts to USD
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
async function calculateEnhancedAPR(position, claimableTorus = 0, claimableTitanX = 0) {
  try {
    console.log(`🧮 Calculating enhanced APR for position ${position.tokenId}`);

    // Get historical data
    const historicalResult = await getHistoricalDataWithCache(30);
    const historicalData = historicalResult.data;
    
    console.log(`📊 Historical data: ${historicalData.length} points (${historicalResult.source})`);

    // Calculate position value in USD
    const positionValueUSD = calculatePositionValueUSD(
      position.amount0 || 0,
      position.amount1 || 0
    );

    console.log(`💰 Position value: $${positionValueUSD.toFixed(4)} USD`);

    let volumeBasedAPR = 0;
    let realTimeAPR = 0;

    // Calculate volume-based APR
    if (historicalData.length > 0 && position.liquidity) {
      volumeBasedAPR = calculateVolumeBasedAPR(
        historicalData,
        position.liquidity,
        positionValueUSD
      );
      console.log(`📈 Volume-based APR: ${volumeBasedAPR.toFixed(2)}%`);
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
    const aprs = [volumeBasedAPR, realTimeAPR].filter(apr => apr > 0);
    const averageAPR = aprs.length > 0 ? aprs.reduce((sum, apr) => sum + apr, 0) / aprs.length : 0;

    // Determine confidence
    let confidence = 'low';
    if (historicalData.length >= 20 && aprs.length >= 2) {
      confidence = 'high';
    } else if (historicalData.length >= 7 && aprs.length >= 1) {
      confidence = 'medium';
    }

    console.log(`✅ Enhanced APR: ${averageAPR.toFixed(2)}% (${confidence} confidence)`);

    // Check if position is out of range and has both amount0 and amount1 at 0
    // This is a better indicator than inRange flag which might not be updated
    if (position.amount0 === 0 && position.amount1 > 0) {
      console.log(`📌 Position appears to be out of range (no TORUS) - setting APR to 0%`);
      return {
        volumeBasedAPR: 0,
        realTimeAPR: 0,
        averageAPR: 0,
        confidence: 'high',
        dataPoints: historicalData.length
      };
    }

    return {
      volumeBasedAPR,
      realTimeAPR,
      averageAPR,
      confidence,
      dataPoints: historicalData.length
    };

  } catch (error) {
    console.error('❌ Error calculating enhanced APR:', error);
    
    // Fallback to simple calculation
    const fallbackAPR = calculateSimpleAPR(position, claimableTorus, claimableTitanX);
    
    return {
      volumeBasedAPR: fallbackAPR,
      realTimeAPR: fallbackAPR,
      averageAPR: fallbackAPR,
      confidence: 'low',
      dataPoints: 0
    };
  }
}

/**
 * Simple APR calculation (fallback)
 */
function calculateSimpleAPR(position, claimableTorus, claimableTitanX) {
  const currentTick = 175734; // Should be passed from pool data
  const inRange = position.tickLower <= currentTick && currentTick <= position.tickUpper;
  const titanxPerTorus = Math.pow(1.0001, currentTick);
  const positionValueTORUS = (position.amount0 || 0) + ((position.amount1 || 0) / titanxPerTorus);
  const totalClaimableTORUS = claimableTorus + (claimableTitanX / titanxPerTorus);
  
  let estimatedAPR = 0;
  if (positionValueTORUS > 0) {
    const weeklyYieldRate = totalClaimableTORUS / positionValueTORUS;
    estimatedAPR = weeklyYieldRate * 52 * 100;
    
    if (!inRange) {
      estimatedAPR = Math.min(estimatedAPR * 0.1, 5);
    }
    
    // Apply range factor
    const tickRange = position.tickUpper - position.tickLower;
    const rangeFactor = Math.max(0.5, Math.min(2.0, 500000 / tickRange));
    estimatedAPR = estimatedAPR * rangeFactor;
    
    // Cap at reasonable bounds
    estimatedAPR = Math.max(0, Math.min(estimatedAPR, 300));
  }
  
  return estimatedAPR;
}

module.exports = {
  calculateEnhancedAPR,
  calculateSimpleAPR,
  fetchPoolHistoricalData,
  getHistoricalDataWithCache
};