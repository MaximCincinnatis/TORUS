import { SimpleLPPosition } from './uniswapV3RealOwners';
import { PoolHistoricalData } from './enhancedAPRCalculation';
import { getIncrementalUpdates, mergeIncrementalUpdates, shouldUpdateIncrementally } from './incrementalUpdater';
import { ethers } from 'ethers';
import { RpcRateLimit } from './rpcRateLimit';

// Working RPC endpoints (all public, no API keys)
const WORKING_RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://rpc.payload.de',
  'https://eth-mainnet.public.blastapi.io',
  'https://rpc.flashbots.net',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth'
];

let currentRpcIndex = 0;

async function getWorkingProviderWithRotation(): Promise<ethers.providers.JsonRpcProvider> {
  const maxRetries = WORKING_RPC_ENDPOINTS.length;
  
  for (let i = 0; i < maxRetries; i++) {
    const rpcUrl = WORKING_RPC_ENDPOINTS[currentRpcIndex];
    
    try {
      console.log(`🔄 Trying RPC provider: ${rpcUrl}`);
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      
      // Quick test with timeout to avoid 429 errors
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 3000);
      });
      
      await RpcRateLimit.execute(async () => {
        return Promise.race([
          provider.getBlockNumber(),
          timeoutPromise
        ]);
      }, `Cache loader RPC test for ${rpcUrl}`);
      
      console.log(`✅ Connected to RPC provider: ${rpcUrl}`);
      return provider;
      
    } catch (error) {
      console.log(`❌ RPC provider ${rpcUrl} failed:`, error instanceof Error ? error.message : 'Unknown error');
      
      // Auto-rotate to next provider
      currentRpcIndex = (currentRpcIndex + 1) % WORKING_RPC_ENDPOINTS.length;
      
      // Add delay before trying next provider to avoid rapid requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error('All RPC providers failed');
}

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
  totalTitanXBurnt?: string;
  titanxTotalSupply?: string;
}

/**
 * Load cached data from JSON file
 */
export async function loadCachedData(): Promise<CachedData | null> {
  try {
    console.log('📦 Loading cached data from JSON...');
    
    // Try multiple sources in order
    const sources = [
      { url: '/data/cached-data.json', name: 'Static File' },
      { url: 'https://raw.githubusercontent.com/MaximCincinnatis/TORUS/master/torus-dashboard/public/data/cached-data.json', name: 'GitHub Raw' },
      { url: 'https://torus-dashboard-omega.vercel.app/data/cached-data.json', name: 'Vercel Production' }
    ];
    
    let response: Response | null = null;
    let sourceUsed = '';
    
    for (const source of sources) {
      console.log(`📂 Trying to fetch from ${source.name}: ${source.url}`);
      
      try {
        response = await fetch(`${source.url}?t=${Date.now()}`, {
          cache: 'no-cache', // Always get fresh data
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        
        if (response.ok) {
          sourceUsed = source.name;
          console.log(`✅ Successfully loaded from ${source.name}`);
          break;
        } else {
          console.warn(`⚠️ ${source.name} failed: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.warn(`⚠️ ${source.name} error:`, error);
      }
    }
    
    if (!response || !response.ok) {
      console.warn('❌ All data sources failed, will use RPC fallback');
      return null;
    }
    
    // Capture the file's actual last modified time from HTTP headers
    const lastModified = response.headers.get('last-modified');
    console.log('🕐 File last modified header:', lastModified);
    
    const cachedData: CachedData = await response.json();
    
    // Override the JSON's lastUpdated with the actual file modification time
    if (lastModified) {
      const fileModifiedTime = new Date(lastModified).toISOString();
      console.log('📅 Using file modification time:', fileModifiedTime, 'instead of JSON lastUpdated:', cachedData.lastUpdated);
      cachedData.lastUpdated = fileModifiedTime;
    }
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
    
    console.log(`✅ Loaded fresh cached data from ${sourceUsed} (${minutesSinceUpdate.toFixed(1)} minutes old)`);
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
 * Get main dashboard data from cache with incremental updates
 */
export async function getMainDashboardDataWithCache(
  fallbackFunction: () => Promise<any>
): Promise<{ data: any; source: 'cache' | 'cache+incremental' | 'rpc' }> {
  const cachedData = await loadCachedData();
  
  if (cachedData && cachedData.stakingData) {
    console.log('🚀 Using cached main dashboard data');
    console.log('📦 Cache contains:', {
      stakeEvents: cachedData.stakingData.stakeEvents?.length || 0,
      createEvents: cachedData.stakingData.createEvents?.length || 0,
      rewardPoolData: cachedData.stakingData.rewardPoolData?.length || 0,
      currentProtocolDay: cachedData.stakingData.currentProtocolDay,
      totalSupply: cachedData.stakingData.totalSupply,
      burnedSupply: cachedData.stakingData.burnedSupply,
      totalTitanXBurnt: cachedData.totalTitanXBurnt,
      titanxTotalSupply: cachedData.titanxTotalSupply
    });
    
    // Check if incremental updates are available
    let finalData = cachedData;
    let source: 'cache' | 'cache+incremental' = 'cache';
    
    try {
      // Try to get incremental updates using working RPC providers with auto-rotation
      const provider = await getWorkingProviderWithRotation();
      
      const shouldUpdate = await shouldUpdateIncrementally(cachedData, provider);
      
      if (shouldUpdate) {
        console.log('🔄 Getting incremental updates...');
        const updates = await getIncrementalUpdates(cachedData, provider);
        
        if (updates.updated) {
          finalData = mergeIncrementalUpdates(cachedData, updates);
          source = 'cache+incremental';
          console.log('✅ Applied incremental updates');
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not get incremental updates, using cached data:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    // Convert string dates back to Date objects for cached data
    const stakeEvents = (finalData.stakingData.stakeEvents || []).map((event: any) => ({
      ...event,
      maturityDate: new Date(event.maturityDate)
    }));
    
    const createEvents = (finalData.stakingData.createEvents || []).map((event: any) => ({
      ...event,
      maturityDate: new Date(event.maturityDate)
    }));
    
    console.log('✅ Converted dates for cache:', {
      stakeEvents: stakeEvents.length,
      createEvents: createEvents.length,
      sampleStakeDate: stakeEvents[0]?.maturityDate,
      sampleCreateDate: createEvents[0]?.maturityDate
    });

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
        totalTitanXBurnt: finalData.totalTitanXBurnt || "0",
        titanxTotalSupply: finalData.titanxTotalSupply || "0",
        totals: finalData.totals
      },
      source
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