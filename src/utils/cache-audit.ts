// Cache audit and test functionality
import { DataCache } from './cache';
import { fetchStakeEvents, fetchCreateEvents } from './ethersWeb3';

export const auditCacheImplementation = () => {
  
  // 1. Check current cache state
  const keys = Object.keys(localStorage).filter(k => k.startsWith('torus_dashboard_'));
  
  keys.forEach(key => {
    try {
      const item = JSON.parse(localStorage.getItem(key) || '{}');
      const age = Date.now() - item.timestamp;
      const ageMinutes = Math.round(age / 60000);
    } catch (e) {
    }
  });
  
  // 2. Check cached data
  const stakeEvents = DataCache.get<any[]>('stake_events');
  const createEvents = DataCache.get<any[]>('create_events');
  const lastBlock = DataCache.getLastBlockNumber();
  
  
  // 3. Analyze current implementation issues
  
  
  return {
    currentStakeEvents: stakeEvents?.length || 0,
    currentCreateEvents: createEvents?.length || 0,
    lastCachedBlock: lastBlock,
    cacheAge: keys.length > 0 ? Math.min(...keys.map(k => {
      try {
        const item = JSON.parse(localStorage.getItem(k) || '{}');
        return Date.now() - item.timestamp;
      } catch {
        return Infinity;
      }
    })) : null
  };
};

export const testCacheBehavior = async () => {
  
  // Clear cache to start fresh
  DataCache.clear();
  
  // Test 1: First fetch (should fetch from blockchain)
  const start1 = Date.now();
  const stakes1 = await fetchStakeEvents();
  const time1 = Date.now() - start1;
  
  // Test 2: Second fetch (should use cache)
  const start2 = Date.now();
  const stakes2 = await fetchStakeEvents();
  const time2 = Date.now() - start2;
  
  // Test 3: Check cache contents
  const cacheData = DataCache.get<any[]>('stake_events');
  const lastBlock = DataCache.getLastBlockNumber();
  
  return {
    firstFetchTime: time1,
    secondFetchTime: time2,
    speedupRatio: time1/time2,
    eventsCount: stakes1.length,
    cacheWorking: time2 < 100 // Cache should be nearly instant
  };
};