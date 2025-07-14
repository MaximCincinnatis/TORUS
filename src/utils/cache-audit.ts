// Cache audit and test functionality
import { DataCache } from './cache';
import { fetchStakeEvents, fetchCreateEvents } from './ethersWeb3';

export const auditCacheImplementation = () => {
  console.log('%c🔍 CACHE IMPLEMENTATION AUDIT 🔍', 'background: #ff6b35; color: white; font-weight: bold; font-size: 18px; padding: 10px');
  
  // 1. Check current cache state
  console.log('\n=== CURRENT CACHE STATE ===');
  const keys = Object.keys(localStorage).filter(k => k.startsWith('torus_dashboard_'));
  console.log(`Total cached items: ${keys.length}`);
  
  keys.forEach(key => {
    try {
      const item = JSON.parse(localStorage.getItem(key) || '{}');
      const age = Date.now() - item.timestamp;
      const ageMinutes = Math.round(age / 60000);
      console.log(`- ${key.replace('torus_dashboard_', '')}: ${ageMinutes}min old, block ${item.blockNumber || 'N/A'}`);
    } catch (e) {
      console.log(`- ${key}: corrupt data`);
    }
  });
  
  // 2. Check cached data
  const stakeEvents = DataCache.get<any[]>('stake_events');
  const createEvents = DataCache.get<any[]>('create_events');
  const lastBlock = DataCache.getLastBlockNumber();
  
  console.log('\n=== CACHED DATA ===');
  console.log(`Stake events: ${stakeEvents ? stakeEvents.length : 0}`);
  console.log(`Create events: ${createEvents ? createEvents.length : 0}`);
  console.log(`Last cached block: ${lastBlock || 'None'}`);
  
  // 3. Analyze current implementation issues
  console.log('\n=== IMPLEMENTATION ANALYSIS ===');
  console.log('❌ ISSUE 1: Always fetches from deployment block (21573450)');
  console.log('❌ ISSUE 2: No true incremental fetching - refetches ALL events');
  console.log('❌ ISSUE 3: Cache only prevents fetching, doesn\'t enable incremental updates');
  console.log('❌ ISSUE 4: Inefficient for large event histories');
  
  console.log('\n=== RECOMMENDED IMPROVEMENTS ===');
  console.log('✅ FIX 1: Use lastCachedBlock as starting point for new fetches');
  console.log('✅ FIX 2: Merge new events with cached events');
  console.log('✅ FIX 3: Only fetch from lastCachedBlock + 1 to currentBlock');
  console.log('✅ FIX 4: Handle edge cases (no cache, corrupted cache, etc.)');
  
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
  console.log('%c🧪 TESTING CACHE BEHAVIOR 🧪', 'background: #8b5cf6; color: white; font-weight: bold; font-size: 18px; padding: 10px');
  
  // Clear cache to start fresh
  console.log('\nClearing cache for test...');
  DataCache.clear();
  
  // Test 1: First fetch (should fetch from blockchain)
  console.log('\n=== TEST 1: First Fetch ===');
  const start1 = Date.now();
  const stakes1 = await fetchStakeEvents();
  const time1 = Date.now() - start1;
  console.log(`✓ First fetch: ${stakes1.length} stakes in ${time1}ms`);
  
  // Test 2: Second fetch (should use cache)
  console.log('\n=== TEST 2: Second Fetch (Should Use Cache) ===');
  const start2 = Date.now();
  const stakes2 = await fetchStakeEvents();
  const time2 = Date.now() - start2;
  console.log(`✓ Second fetch: ${stakes2.length} stakes in ${time2}ms`);
  console.log(`Cache speedup: ${time1/time2}x faster`);
  
  // Test 3: Check cache contents
  const cacheData = DataCache.get<any[]>('stake_events');
  const lastBlock = DataCache.getLastBlockNumber();
  console.log(`✓ Cache contains: ${cacheData?.length} events, last block: ${lastBlock}`);
  
  return {
    firstFetchTime: time1,
    secondFetchTime: time2,
    speedupRatio: time1/time2,
    eventsCount: stakes1.length,
    cacheWorking: time2 < 100 // Cache should be nearly instant
  };
};