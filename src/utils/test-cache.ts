// Simple cache test
import { DataCache } from './cache';

export const testCache = () => {
  console.log('🧪 Testing Cache Implementation...');
  
  // Test 1: Basic set/get
  console.log('\n1. Basic set/get test:');
  DataCache.set('test_key', { test: 'data', value: 123 });
  const retrieved = DataCache.get('test_key');
  console.log('Set:', { test: 'data', value: 123 });
  console.log('Get:', retrieved);
  console.log('✅ Basic test:', retrieved ? 'PASS' : 'FAIL');
  
  // Test 2: Block-aware caching
  console.log('\n2. Block-aware caching test:');
  DataCache.set('block_test', ['event1', 'event2'], 100);
  const blockData = DataCache.get('block_test', 102); // 2 blocks newer
  console.log('Block data (2 blocks newer):', blockData);
  console.log('✅ Block test:', blockData ? 'PASS (cached)' : 'FAIL (expired)');
  
  // Test 3: Expiry test (simulate)
  console.log('\n3. Cache expiry simulation:');
  // Manually set old timestamp
  const oldItem = {
    data: ['old', 'data'],
    timestamp: Date.now() - (6 * 60 * 1000), // 6 minutes ago
    blockNumber: 100
  };
  localStorage.setItem('torus_dashboard_expired_test', JSON.stringify(oldItem));
  const expiredData = DataCache.get('expired_test');
  console.log('Expired data:', expiredData);
  console.log('✅ Expiry test:', !expiredData ? 'PASS (expired correctly)' : 'FAIL (should be null)');
  
  // Test 4: Error handling
  console.log('\n4. Error handling test:');
  localStorage.setItem('torus_dashboard_corrupt_test', 'invalid json');
  const corruptData = DataCache.get('corrupt_test');
  console.log('Corrupt data handling:', corruptData);
  console.log('✅ Error handling:', corruptData === null ? 'PASS' : 'FAIL');
  
  // Test 5: Clear cache
  console.log('\n5. Cache clear test:');
  DataCache.set('clear_test', 'data');
  console.log('Before clear:', DataCache.get('clear_test'));
  DataCache.clear();
  console.log('After clear:', DataCache.get('clear_test'));
  console.log('✅ Clear test:', !DataCache.get('clear_test') ? 'PASS' : 'FAIL');
  
  console.log('\n🏁 Cache test complete!');
};

export const logCacheStats = () => {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('torus_dashboard_'));
  console.log('\n📊 Cache Statistics:');
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
};