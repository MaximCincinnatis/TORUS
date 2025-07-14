// Test update button incremental fetching
import { DataCache } from './cache';

export const auditUpdateButtonLogic = async () => {
  console.log('%c🔍 AUDITING UPDATE BUTTON LOGIC 🔍', 'background: #ef4444; color: white; font-weight: bold; font-size: 18px; padding: 10px');
  
  console.log('\n=== CURRENT IMPLEMENTATION ISSUES ===');
  
  // Issue 1: Not using cache system properly
  console.log('❌ ISSUE 1: fetchStakeEvents/fetchCreateEvents call DataCache.get() WITHOUT currentBlockNumber');
  console.log('   This means block-based cache expiry NEVER triggers');
  console.log('   Cache only expires after 5 minutes, not when new blocks arrive');
  
  // Issue 2: Wrong condition for cache usage
  console.log('❌ ISSUE 2: Condition "currentBlock === lastCachedBlock" is too strict');
  console.log('   New blocks are mined every ~12 seconds, so this condition rarely true');
  console.log('   Should use cache within reasonable time window even on newer blocks');
  
  // Issue 3: Incremental logic may not work as expected
  console.log('❌ ISSUE 3: When cache expires, it does FULL fetch instead of incremental');
  console.log('   Should preserve lastCachedBlock even when cache expires');
  
  // Test current cache behavior
  console.log('\n=== TESTING CURRENT CACHE BEHAVIOR ===');
  
  // Simulate cache
  DataCache.set('test_events', ['event1', 'event2'], 100);
  DataCache.setLastBlockNumber(100);
  
  // Test 1: Get without current block (how it's currently called)
  const cached1 = DataCache.get('test_events'); // No currentBlockNumber passed
  console.log(`Test 1 - Get without currentBlockNumber: ${cached1 ? 'CACHED' : 'NULL'}`);
  
  // Test 2: Get with current block (how it should be called)
  const cached2 = DataCache.get('test_events', 105); // 5 blocks newer
  console.log(`Test 2 - Get with currentBlockNumber 105: ${cached2 ? 'CACHED' : 'NULL'}`);
  
  // Test 3: Get with much newer block after 30+ seconds
  setTimeout(() => {
    const cached3 = DataCache.get('test_events', 110);
    console.log(`Test 3 - After 30s with block 110: ${cached3 ? 'CACHED' : 'NULL'}`);
  }, 100); // Simulate time passage
  
  console.log('\n=== RECOMMENDED FIXES ===');
  console.log('✅ FIX 1: Pass currentBlockNumber to DataCache.get() calls');
  console.log('✅ FIX 2: Change cache condition to use time-based logic properly');
  console.log('✅ FIX 3: Store lastProcessedBlock separately from cache expiry');
  console.log('✅ FIX 4: Use incremental fetch even when cache expires');
  
  return {
    issuesFound: 3,
    criticalIssue: 'Update button does NOT do incremental fetching - it refetches ALL events every time cache expires'
  };
};

export const testActualUpdateButtonBehavior = () => {
  console.log('%c🧪 TESTING ACTUAL UPDATE BUTTON BEHAVIOR 🧪', 'background: #8b5cf6; color: white; font-weight: bold; font-size: 18px; padding: 10px');
  
  // Clear everything to start fresh
  DataCache.clear();
  
  console.log('\n=== INSTRUCTIONS FOR MANUAL TEST ===');
  console.log('1. Open browser console');
  console.log('2. Click "Update Data" button');
  console.log('3. Watch for console messages - should see "FULL FETCH" initially');
  console.log('4. Wait for it to complete');
  console.log('5. Immediately click "Update Data" again');
  console.log('6. Expected: Should see "INCREMENTAL FETCH" or use cache');
  console.log('7. Actual: Will likely see "FULL FETCH" again (BUG!)');
  
  console.log('\n=== WHAT TO LOOK FOR ===');
  console.log('🔍 Look for: "INCREMENTAL FETCH STAKE EVENTS" vs "FULL FETCH STAKE EVENTS"');
  console.log('🔍 Look for: "from block X to Y" - X should be lastCachedBlock + 1, not 21573450');
  console.log('🔍 Look for: Fetch time - should be much faster on second click');
};