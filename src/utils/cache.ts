interface CacheItem<T> {
  data: T;
  timestamp: number;
  blockNumber?: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const BLOCK_CACHE_DURATION = 30 * 1000; // 30 seconds for block-dependent data

export class DataCache {
  private static getKey(key: string): string {
    return `torus_dashboard_${key}`;
  }

  static set<T>(key: string, data: T, blockNumber?: number): void {
    const cacheItem: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      blockNumber
    };
    
    try {
      localStorage.setItem(this.getKey(key), JSON.stringify(cacheItem));
    } catch (error) {
      console.warn('Failed to cache data:', error);
    }
  }

  static get<T>(key: string, currentBlockNumber?: number): T | null {
    try {
      const cached = localStorage.getItem(this.getKey(key));
      if (!cached) return null;

      const cacheItem: CacheItem<T> = JSON.parse(cached);
      const now = Date.now();
      
      // Check if cache is expired
      const isTimeExpired = now - cacheItem.timestamp > CACHE_DURATION;
      
      // For block-dependent data, also check if we're on a newer block
      const isBlockStale = currentBlockNumber && cacheItem.blockNumber && 
        (currentBlockNumber > cacheItem.blockNumber) && 
        (now - cacheItem.timestamp > BLOCK_CACHE_DURATION);
      
      if (isTimeExpired || isBlockStale) {
        this.remove(key);
        return null;
      }

      return cacheItem.data;
    } catch (error) {
      console.warn('Failed to read cache:', error);
      return null;
    }
  }

  static remove(key: string): void {
    try {
      localStorage.removeItem(this.getKey(key));
    } catch (error) {
      console.warn('Failed to remove cache:', error);
    }
  }

  static clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('torus_dashboard_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  static getLastBlockNumber(): number | null {
    const cached = this.get<number>('last_block_number');
    return cached;
  }

  static setLastBlockNumber(blockNumber: number): void {
    this.set('last_block_number', blockNumber);
  }

  static clearAllData(): void {
    try {
      // Clear all cached data but preserve settings if any
      this.remove('stake_events');
      this.remove('create_events');
      this.remove('last_block_number');
      console.log('🗑️ Cleared all cached blockchain data');
    } catch (error) {
      console.warn('Failed to clear cached data:', error);
    }
  }
}