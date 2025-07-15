import { SimpleLPPosition } from './uniswapV3RealOwners';
import { PoolHistoricalData } from './enhancedAPRCalculation';

export interface CachedData {
  lastUpdated: string;
  version: string;
  poolData: {
    sqrtPriceX96: string;
    currentTick: number;
    token0: string;
    token1: string;
    liquidity: string;
    feeGrowthGlobal0X128: string;
    feeGrowthGlobal1X128: string;
  };
  lpPositions: SimpleLPPosition[];
  historicalData: {
    sevenDay: PoolHistoricalData[];
    thirtyDay: PoolHistoricalData[];
  };
  tokenPrices: {
    torus: {
      usd: number;
      lastUpdated: string;
    };
    titanx: {
      usd: number;
      lastUpdated: string;
    };
  };
  stakingData: {
    stakeEvents: any[];
    createEvents: any[];
    rewardPoolData: any[];
    currentProtocolDay: number;
    totalSupply: number;
    burnedSupply: number;
    lastUpdated: string;
  };
  contractData: {
    torusToken: {
      address: string;
      totalSupply: string;
      decimals: number;
    };
    titanxToken: {
      address: string;
      totalSupply: string;
      decimals: number;
    };
    uniswapPool: {
      address: string;
      feeTier: number;
    };
  };
  metadata: {
    dataSource: string;
    fallbackToRPC: boolean;
    cacheExpiryMinutes: number;
    description: string;
  };
  totals?: {
    totalETH: string;
    totalTitanX: string;
    totalStakedETH: string;
    totalCreatedETH: string;
    totalStakedTitanX: string;
    totalCreatedTitanX: string;
  };
}

/**
 * Load cached data from JSON file
 */
export async function loadCachedData(): Promise<CachedData | null> {
  try {
    console.log('📦 Loading cached data from JSON...');
    console.log('📂 Fetching from: /data/cached-data.json');
    
    const response = await fetch('/data/cached-data.json', {
      cache: 'no-cache', // Always get fresh data
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
    
    if (!response.ok) {
      console.warn(`⚠️ Cached data file not found: ${response.status} ${response.statusText}`);
      console.warn('Will use RPC fallback');
      return null;
    }
    
    const cachedData: CachedData = await response.json();
    console.log('📄 JSON loaded successfully, size:', JSON.stringify(cachedData).length, 'chars');
    console.log('📊 Raw cache contains:', {
      stakes: cachedData.stakingData?.stakeEvents?.length || 0,
      creates: cachedData.stakingData?.createEvents?.length || 0,
      lpPositions: cachedData.lpPositions?.length || 0
    });
    
    // Validate cache freshness
    const lastUpdated = new Date(cachedData.lastUpdated);
    const now = new Date();
    const minutesSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60);
    
    if (minutesSinceUpdate > cachedData.metadata.cacheExpiryMinutes) {
      console.warn(`⏰ Cached data is ${minutesSinceUpdate.toFixed(1)} minutes old (expiry: ${cachedData.metadata.cacheExpiryMinutes} min)`);
      
      if (!cachedData.metadata.fallbackToRPC) {
        console.log('🔒 Using expired cache (fallback disabled)');
        return cachedData;
      }
      
      console.log('🔄 Cache expired, will use RPC fallback');
      return null;
    }
    
    console.log(`✅ Loaded fresh cached data (${minutesSinceUpdate.toFixed(1)} minutes old)`);
    console.log(`📊 Cache contains: ${cachedData.lpPositions.length} LP positions, ${cachedData.historicalData.sevenDay.length} historical days`);
    
    return cachedData;
    
  } catch (error) {
    console.error('❌ Error loading cached data:', error);
    return null;
  }
}

/**
 * Check if cached data is available and fresh
 */
export async function isCacheAvailable(): Promise<boolean> {
  const cachedData = await loadCachedData();
  return cachedData !== null;
}

/**
 * Get LP positions from cache or fallback to RPC
 */
export async function getLPPositionsWithCache(
  fallbackFunction: () => Promise<SimpleLPPosition[]>
): Promise<{ positions: SimpleLPPosition[]; source: 'cache' | 'rpc' }> {
  const cachedData = await loadCachedData();
  
  if (cachedData && cachedData.lpPositions.length > 0) {
    console.log('🚀 Using cached LP positions');
    return {
      positions: cachedData.lpPositions,
      source: 'cache'
    };
  }
  
  console.log('🔄 Falling back to RPC for LP positions');
  const positions = await fallbackFunction();
  
  return {
    positions,
    source: 'rpc'
  };
}

/**
 * Get historical data from cache or fallback to subgraph
 */
export async function getHistoricalDataWithCache(
  days: number,
  fallbackFunction: (days: number) => Promise<PoolHistoricalData[]>
): Promise<{ data: PoolHistoricalData[]; source: 'cache' | 'subgraph' }> {
  const cachedData = await loadCachedData();
  
  if (cachedData) {
    const historicalData = days <= 7 ? cachedData.historicalData.sevenDay : cachedData.historicalData.thirtyDay;
    
    if (historicalData.length > 0) {
      console.log(`🚀 Using cached historical data (${days} days)`);
      return {
        data: historicalData.slice(0, days), // Return requested number of days
        source: 'cache'
      };
    }
  }
  
  console.log(`🔄 Falling back to subgraph for historical data (${days} days)`);
  const data = await fallbackFunction(days);
  
  return {
    data,
    source: 'subgraph'
  };
}

/**
 * Get pool data from cache or fallback to RPC
 */
export async function getPoolDataWithCache(
  fallbackFunction: () => Promise<any>
): Promise<{ data: any; source: 'cache' | 'rpc' }> {
  const cachedData = await loadCachedData();
  
  if (cachedData && cachedData.poolData) {
    console.log('🚀 Using cached pool data');
    return {
      data: {
        sqrtPriceX96: cachedData.poolData.sqrtPriceX96,
        currentTick: cachedData.poolData.currentTick,
        token0: cachedData.poolData.token0,
        token1: cachedData.poolData.token1
      },
      source: 'cache'
    };
  }
  
  console.log('🔄 Falling back to RPC for pool data');
  const data = await fallbackFunction();
  
  return {
    data,
    source: 'rpc'
  };
}

/**
 * Get main dashboard data from cache or fallback to RPC
 */
export async function getMainDashboardDataWithCache(
  fallbackFunction: () => Promise<any>
): Promise<{ data: any; source: 'cache' | 'rpc' }> {
  const cachedData = await loadCachedData();
  
  if (cachedData && cachedData.stakingData) {
    console.log('🚀 Using cached main dashboard data');
    console.log('📦 Cache contains:', {
      stakeEvents: cachedData.stakingData.stakeEvents?.length || 0,
      createEvents: cachedData.stakingData.createEvents?.length || 0,
      rewardPoolData: cachedData.stakingData.rewardPoolData?.length || 0,
      currentProtocolDay: cachedData.stakingData.currentProtocolDay,
      totalSupply: cachedData.stakingData.totalSupply,
      burnedSupply: cachedData.stakingData.burnedSupply
    });
    
    // Convert string dates back to Date objects for cached data
    const stakeEvents = (cachedData.stakingData.stakeEvents || []).map((event: any) => ({
      ...event,
      maturityDate: new Date(event.maturityDate)
    }));
    
    const createEvents = (cachedData.stakingData.createEvents || []).map((event: any) => ({
      ...event,
      maturityDate: new Date(event.maturityDate)
    }));
    
    console.log('✅ Converted dates for cache:', {
      stakeEvents: stakeEvents.length,
      createEvents: createEvents.length,
      sampleStakeDate: stakeEvents[0]?.maturityDate,
      sampleCreateDate: createEvents[0]?.maturityDate
    });

    return {
      data: {
        stakeEvents,
        createEvents,
        rewardPoolData: cachedData.stakingData.rewardPoolData || [],
        currentProtocolDay: cachedData.stakingData.currentProtocolDay || 0,
        totalSupply: cachedData.stakingData.totalSupply || 0,
        burnedSupply: cachedData.stakingData.burnedSupply || 0,
        totals: cachedData.totals
      },
      source: 'cache'
    };
  }
  
  console.log('🔄 Falling back to RPC for main dashboard data');
  const data = await fallbackFunction();
  
  return {
    data,
    source: 'rpc'
  };
}

/**
 * Get cache status for display
 */
export async function getCacheStatus(): Promise<{
  available: boolean;
  lastUpdated: string | null;
  minutesOld: number | null;
  source: string;
  positionCount: number;
  dataPoints: number;
}> {
  const cachedData = await loadCachedData();
  
  if (!cachedData) {
    return {
      available: false,
      lastUpdated: null,
      minutesOld: null,
      source: 'RPC',
      positionCount: 0,
      dataPoints: 0
    };
  }
  
  const lastUpdated = new Date(cachedData.lastUpdated);
  const minutesOld = (new Date().getTime() - lastUpdated.getTime()) / (1000 * 60);
  
  return {
    available: true,
    lastUpdated: cachedData.lastUpdated,
    minutesOld,
    source: cachedData.metadata.dataSource,
    positionCount: cachedData.lpPositions.length,
    dataPoints: cachedData.historicalData.sevenDay.length
  };
}