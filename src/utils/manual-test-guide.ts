// Manual testing guide for update button incremental fetching
export const manualTestGuide = () => {
  
  
  
  
  
  
  
  return {
    testPassed: false, // Will be updated during manual testing
    message: 'Run the manual tests above to verify incremental fetching works correctly'
  };
};

// Helper to check current cache state
export const checkCacheState = () => {
  
  const keys = Object.keys(localStorage).filter(k => k.startsWith('torus_dashboard_'));
  
  keys.forEach(key => {
    try {
      const item = JSON.parse(localStorage.getItem(key) || '{}');
      const age = Date.now() - item.timestamp;
      const ageSeconds = Math.round(age / 1000);
    } catch (e) {
    }
  });
  
  return keys.length;
};