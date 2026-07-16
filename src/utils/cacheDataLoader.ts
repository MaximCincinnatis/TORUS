import { SimpleLPPosition } from './lpTypes';
import { PoolHistoricalData } from './enhancedAPRCalculation';
// In-browser RPC removed: the frontend is cache-only and the backend cron is the
// single source of truth. This drops ethers + incrementalUpdater from the bundle.

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
    totalStakedInContract?: number;
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
  totalTitanXBurnt?: string;
  titanxTotalSupply?: string;
  chartData?: {
    futureSupplyProjection?: Array<{
      day: number;
      date: string;
      totalMaxSupply: number;
      activePositions: number;
      dailyRewardPool: number;
      totalShares: number;
      breakdown: {
        fromStakes: number;
        fromCreates: number;
        fromExisting: number;
      };
    }>;
    futureSupplyProjectionLastUpdate?: {
      timestamp: string;
      protocolDay: number;
    };
  };
}

// Page-lifetime memo: the *WithCache helpers below each call loadCachedData, and
// without this the same ~3MB JSON was fetched 4+ times per page load. All callers
// share one in-flight/settled promise. Data only changes via redeploy and
// UpdateNotification's refresh does window.location.reload(), which resets module
// state — so the memo can never serve stale data past a refresh. A total failure
// (null) clears the memo so the next caller retries the source fallback chain.
let cachedDataPromise: Promise<CachedData | null> | null = null;

export function loadCachedData(): Promise<CachedData | null> {
  if (!cachedDataPromise) {
    cachedDataPromise = fetchCachedData().then(result => {
      if (result === null) {
        cachedDataPromise = null;
      }
      return result;
    });
  }
  return cachedDataPromise;
}

/**
 * Load cached data from JSON file
 */
async function fetchCachedData(): Promise<CachedData | null> {
  try {
    
    // Try multiple sources in order
    const sources = [
      { url: '/data/cached-data.json', name: 'Static File' },
      { url: 'https://raw.githubusercontent.com/MaximCincinnatis/TORUS/master/public/data/cached-data.json', name: 'GitHub Raw' },
      { url: 'https://torus-dashboard-omega.vercel.app/data/cached-data.json', name: 'Vercel Production' }
    ];
    
    let response: Response | null = null;
    let sourceUsed = '';
    
    for (const source of sources) {
      
      try {
        // Stable URL (no cache-buster) so the CDN/browser can revalidate with a
        // conditional request and return 304 when unchanged instead of re-downloading.
        response = await fetch(source.url, {
          cache: 'no-cache', // Always revalidate freshness (304 if unchanged)
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        
        if (response.ok) {
          sourceUsed = source.name;
          break;
        } else {
        }
      } catch (error) {
      }
    }
    
    if (!response || !response.ok) {
      return null;
    }
    
    // Capture the file's actual last modified time from HTTP headers
    const lastModified = response.headers.get('last-modified');
    
    const cachedData: CachedData = await response.json();
    
    // Override the JSON's lastUpdated with the actual file modification time
    if (lastModified) {
      const fileModifiedTime = new Date(lastModified).toISOString();
      cachedData.lastUpdated = fileModifiedTime;
    }
    
    // Validate cache freshness
    const lastUpdated = new Date(cachedData.lastUpdated);
    const now = new Date();
    const minutesSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60);
    
    if (minutesSinceUpdate > cachedData.metadata.cacheExpiryMinutes) {
      
      if (!cachedData.metadata.fallbackToRPC) {
        return cachedData;
      }
      
      return null;
    }
    
    
    return cachedData;
    
  } catch (error) {
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
  
  // Check if lpPositions exists and has data (handle undefined case)
  if (cachedData && cachedData.lpPositions && cachedData.lpPositions.length > 0) {
    
    // Ensure positions use standard format
    const standardizedPositions = cachedData.lpPositions.map(pos => ({
      ...pos,
      // Ensure we have the standard fields - check multiple possible field names
      torusAmount: pos.torusAmount ?? pos.amount0 ?? (pos as any).torusAmount ?? 0,
      titanxAmount: pos.titanxAmount ?? pos.amount1 ?? (pos as any).wethAmount ?? 0,
      wethAmount: (pos as any).wethAmount ?? pos.amount1 ?? 0,
      // Add liquidity if missing
      liquidity: pos.liquidity || '0',
      // Add owner if missing
      owner: pos.owner || '',
      // Add tokenId if missing
      tokenId: pos.tokenId || '',
      // Add tick values if present
      tickLower: pos.tickLower ?? 0,
      tickUpper: pos.tickUpper ?? 0,
      // Add claimable fees if present
      claimableTorus: pos.claimableTorus ?? (pos as any).claimableFees?.torus ?? 0,
      claimableTitanX: pos.claimableTitanX ?? (pos as any).claimableFees?.weth ?? 0
    }));
    
    
    return {
      positions: standardizedPositions,
      source: 'cache'
    };
  }
  
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
      return {
        data: historicalData.slice(0, days), // Return requested number of days
        source: 'cache'
      };
    }
  }
  
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
  
  const data = await fallbackFunction();
  
  return {
    data,
    source: 'rpc'
  };
}

/**
 * Get main dashboard data from cache with incremental updates
 */
export async function getMainDashboardDataWithCache(
  fallbackFunction: () => Promise<any>
): Promise<{ data: any; source: 'cache' | 'cache+incremental' | 'rpc' }> {
  const cachedData = await loadCachedData();
  
  if (cachedData && cachedData.stakingData) {
    
    // Frontend is cache-only: the backend cron is the single source of truth.
    // (In-browser RPC incremental updates removed — see note at top of file.)
    const finalData = cachedData;
    const source = 'cache' as const;
    
    // Convert string dates back to Date objects for cached data
    const stakeEvents = (finalData.stakingData.stakeEvents || []).map((event: any) => ({
      ...event,
      maturityDate: new Date(event.maturityDate)
    }));
    
    const createEvents = (finalData.stakingData.createEvents || []).map((event: any) => ({
      ...event,
      maturityDate: new Date(event.maturityDate)
    }));
    

    // Set last updated timestamp in cache
    const { DataCache } = await import('./cache');
    if (finalData.lastUpdated) {
      DataCache.setLastUpdated(finalData.lastUpdated);
    }

    return {
      data: {
        stakeEvents,
        createEvents,
        rewardPoolData: finalData.stakingData.rewardPoolData || [],
        currentProtocolDay: finalData.stakingData.currentProtocolDay || 0,
        totalSupply: finalData.stakingData.totalSupply || 0,
        burnedSupply: finalData.stakingData.burnedSupply || 0,
        totalStakedInContract: finalData.stakingData.totalStakedInContract || 0,
        totalTitanXBurnt: finalData.totalTitanXBurnt || "0",
        titanxTotalSupply: finalData.titanxTotalSupply || "0",
        totals: finalData.totals,
        chartData: finalData.chartData
      },
      source
    };
  }
  
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