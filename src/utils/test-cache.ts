// Simple cache test
import { DataCache } from './cache';

export const testCache = () => {
  
  // Test 1: Basic set/get
  DataCache.set('test_key', { test: 'data', value: 123 });
  const retrieved = DataCache.get('test_key');
  
  // Test 2: Block-aware caching
  DataCache.set('block_test', ['event1', 'event2'], 100);
  const blockData = DataCache.get('block_test', 102); // 2 blocks newer
  
  // Test 3: Expiry test (simulate)
  // Manually set old timestamp
  const oldItem = {
    data: ['old', 'data'],
    timestamp: Date.now() - (6 * 60 * 1000), // 6 minutes ago
    blockNumber: 100
  };
  localStorage.setItem('torus_dashboard_expired_test', JSON.stringify(oldItem));
  const expiredData = DataCache.get('expired_test');
  
  // Test 4: Error handling
  localStorage.setItem('torus_dashboard_corrupt_test', 'invalid json');
  const corruptData = DataCache.get('corrupt_test');
  
  // Test 5: Clear cache
  DataCache.set('clear_test', 'data');
  DataCache.clear();
  
};

export const logCacheStats = () => {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('torus_dashboard_'));
  
  keys.forEach(key => {
    try {
      const item = JSON.parse(localStorage.getItem(key) || '{}');
      const age = Date.now() - item.timestamp;
      const ageMinutes = Math.round(age / 60000);
    } catch (e) {
    }
  });
};