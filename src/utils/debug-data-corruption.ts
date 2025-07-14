// Debug data corruption in incremental fetching
import { DataCache } from './cache';

export const debugDataCorruption = () => {
  console.log('%c🚨 DEBUGGING DATA CORRUPTION 🚨', 'background: #dc2626; color: white; font-weight: bold; font-size: 18px; padding: 10px');
  
  console.log('\n=== IDENTIFIED ISSUE ===');
  console.log('❌ PROBLEM: When doing incremental fetch:');
  console.log('   1. We combine cached events + new events = allEvents');
  console.log('   2. We fetch stake positions for ALL users in allEvents');
  console.log('   3. We re-process titanX matching for ALL events (cached + new)');
  console.log('   4. This corrupts the titanX data for cached events!');
  
  console.log('\n=== WHY THIS CAUSES WRONG DATA ===');
  console.log('❌ Example scenario:');
  console.log('   - Cache has 100 create events with correct titanX data');
  console.log('   - New fetch finds 1 new create event');
  console.log('   - We combine: 100 cached + 1 new = 101 events');
  console.log('   - We fetch positions for ALL 101 events\' users');
  console.log('   - We re-match titanX for ALL 101 events');
  console.log('   - But contract positions may have changed!');
  console.log('   - Result: Wrong titanX values for previously correct cached events');
  
  console.log('\n=== SPECIFIC BUG SYMPTOMS ===');
  console.log('🐛 "1 total create" = Only processing new events, losing cached data');
  console.log('🐛 "1.5T TitanX used" = Astronomical wrong values from re-processing');
  console.log('🐛 Wrong averages = Based on corrupted titanX calculations');
  
  console.log('\n=== REQUIRED FIXES ===');
  console.log('✅ FIX 1: Only process titanX for NEW events when doing incremental');
  console.log('✅ FIX 2: Preserve existing titanX data from cached events');
  console.log('✅ FIX 3: Only combine final processed results, not re-process everything');
  console.log('✅ FIX 4: Store processed events in cache, not raw events');
  
  return {
    bugType: 'Data Corruption in Incremental Fetch',
    severity: 'Critical',
    impact: 'Wrong metrics displayed to users',
    root_cause: 'Re-processing cached events during incremental fetch'
  };
};

export const checkCurrentData = () => {
  const stakeEvents = DataCache.get<any[]>('stake_events');
  const createEvents = DataCache.get<any[]>('create_events');
  
  console.log('\n🔍 CURRENT CACHED DATA:');
  console.log(`Stake events: ${stakeEvents?.length || 0}`);
  console.log(`Create events: ${createEvents?.length || 0}`);
  
  if (createEvents && createEvents.length > 0) {
    console.log('\nFirst few create events:');
    createEvents.slice(0, 3).forEach((event, i) => {
      console.log(`  ${i + 1}. titanAmount: ${event.titanAmount}, torusAmount: ${event.torusAmount}`);
    });
    
    // Check for astronomical values (indicating corruption)
    const totalTitanX = createEvents.reduce((sum, event) => {
      const amount = parseFloat(event.titanAmount || '0') / 1e18;
      return sum + amount;
    }, 0);
    
    console.log(`\nTotal TitanX: ${totalTitanX.toLocaleString()}`);
    if (totalTitanX > 1e12) {
      console.log('🚨 ASTRONOMICAL VALUE DETECTED - DATA IS CORRUPTED!');
    }
  }
};