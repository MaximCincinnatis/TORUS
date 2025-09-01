// Test incremental fetching functionality
import { DataCache } from './cache';
import { fetchStakeEvents, fetchCreateEvents } from './ethersWeb3';

export const testIncrementalFetching = async () => {
  
  const startTime = Date.now();
  
  try {
    // Test 1: Clear cache and do first fetch (should be full fetch)
    DataCache.clear();
    
    const start1 = Date.now();
    const stakes1 = await fetchStakeEvents();
    const time1 = Date.now() - start1;
    
    // Check what was cached
    const lastBlock1 = DataCache.getLastBlockNumber();
    
    // Test 2: Immediate second fetch (should use cache or incremental)
    const start2 = Date.now();
    const stakes2 = await fetchStakeEvents();
    const time2 = Date.now() - start2;
    
    // Verify data integrity
    if (stakes1.length === stakes2.length) {
    } else {
    }
    
    // Test 3: Test create events
    const start3 = Date.now();
    const creates1 = await fetchCreateEvents();
    const time3 = Date.now() - start3;
    
    const start4 = Date.now();
    const creates2 = await fetchCreateEvents();
    const time4 = Date.now() - start4;
    
    // Final cache stats
    const keys = Object.keys(localStorage).filter(k => k.startsWith('torus_dashboard_'));
    keys.forEach(key => {
      try {
        const item = JSON.parse(localStorage.getItem(key) || '{}');
        const age = Date.now() - item.timestamp;
        const ageSeconds = Math.round(age / 1000);
      } catch (e) {
      }
    });
    
    const totalTime = Date.now() - startTime;
    
    return {
      success: true,
      stakesCount: stakes2.length,
      createsCount: creates2.length,
      cacheSpeedup: time1/time2,
      totalTime
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Simple function to log cache status
export const logCacheStatus = () => {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('torus_dashboard_'));
  
  const stakeEvents = DataCache.get<any[]>('stake_events');
  const createEvents = DataCache.get<any[]>('create_events');
  const lastBlock = DataCache.getLastBlockNumber();
  
};