// Test incremental fetching functionality
import { DataCache } from './cache';
import { fetchStakeEvents, fetchCreateEvents } from './ethersWeb3';

export const testIncrementalFetching = async () => {
  console.log('%c🧪 TESTING INCREMENTAL FETCHING 🧪', 'background: #06b6d4; color: white; font-weight: bold; font-size: 18px; padding: 10px');
  
  const startTime = Date.now();
  
  try {
    // Test 1: Clear cache and do first fetch (should be full fetch)
    console.log('\n=== TEST 1: First Fetch (Full) ===');
    DataCache.clear();
    
    const start1 = Date.now();
    const stakes1 = await fetchStakeEvents();
    const time1 = Date.now() - start1;
    console.log(`✓ First fetch: ${stakes1.length} stakes in ${time1}ms`);
    
    // Check what was cached
    const lastBlock1 = DataCache.getLastBlockNumber();
    console.log(`✓ Cached last block: ${lastBlock1}`);
    
    // Test 2: Immediate second fetch (should use cache or incremental)
    console.log('\n=== TEST 2: Second Fetch (Should be Cache/Incremental) ===');
    const start2 = Date.now();
    const stakes2 = await fetchStakeEvents();
    const time2 = Date.now() - start2;
    console.log(`✓ Second fetch: ${stakes2.length} stakes in ${time2}ms`);
    console.log(`Speedup: ${(time1/time2).toFixed(2)}x faster`);
    
    // Verify data integrity
    if (stakes1.length === stakes2.length) {
      console.log('✅ Data integrity check: PASS');
    } else {
      console.log(`❌ Data integrity check: FAIL (${stakes1.length} vs ${stakes2.length})`);
    }
    
    // Test 3: Test create events
    console.log('\n=== TEST 3: Create Events ===');
    const start3 = Date.now();
    const creates1 = await fetchCreateEvents();
    const time3 = Date.now() - start3;
    console.log(`✓ First create fetch: ${creates1.length} creates in ${time3}ms`);
    
    const start4 = Date.now();
    const creates2 = await fetchCreateEvents();
    const time4 = Date.now() - start4;
    console.log(`✓ Second create fetch: ${creates2.length} creates in ${time4}ms`);
    console.log(`Create speedup: ${(time3/time4).toFixed(2)}x faster`);
    
    // Final cache stats
    console.log('\n=== FINAL CACHE STATS ===');
    const keys = Object.keys(localStorage).filter(k => k.startsWith('torus_dashboard_'));
    console.log(`Total cached items: ${keys.length}`);
    keys.forEach(key => {
      try {
        const item = JSON.parse(localStorage.getItem(key) || '{}');
        const age = Date.now() - item.timestamp;
        const ageSeconds = Math.round(age / 1000);
        console.log(`- ${key.replace('torus_dashboard_', '')}: ${ageSeconds}s old, block ${item.blockNumber || 'N/A'}`);
      } catch (e) {
        console.log(`- ${key}: corrupt data`);
      }
    });
    
    const totalTime = Date.now() - startTime;
    console.log(`\n🏁 Test completed in ${totalTime}ms`);
    
    return {
      success: true,
      stakesCount: stakes2.length,
      createsCount: creates2.length,
      cacheSpeedup: time1/time2,
      totalTime
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Simple function to log cache status
export const logCacheStatus = () => {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('torus_dashboard_'));
  console.log(`\n📊 Cache Status: ${keys.length} items cached`);
  
  const stakeEvents = DataCache.get<any[]>('stake_events');
  const createEvents = DataCache.get<any[]>('create_events');
  const lastBlock = DataCache.getLastBlockNumber();
  
  console.log(`- Stake events: ${stakeEvents?.length || 0}`);
  console.log(`- Create events: ${createEvents?.length || 0}`);
  console.log(`- Last block: ${lastBlock || 'None'}`);
};