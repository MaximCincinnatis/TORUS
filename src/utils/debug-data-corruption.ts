// Debug data corruption in incremental fetching
import { DataCache } from './cache';

export const debugDataCorruption = () => {
  
  
  
  
  
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
  
  
  if (createEvents && createEvents.length > 0) {
    createEvents.slice(0, 3).forEach((event, i) => {
    });
    
    // Check for astronomical values (indicating corruption)
    const totalTitanX = createEvents.reduce((sum, event) => {
      const amount = parseFloat(event.titanAmount || '0') / 1e18;
      return sum + amount;
    }, 0);
    
    if (totalTitanX > 1e12) {
    }
  }
};