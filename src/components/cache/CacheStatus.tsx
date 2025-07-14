import React, { useEffect, useState } from 'react';
import { getCacheStatus } from '../../utils/cacheDataLoader';
import './CacheStatus.css';

interface CacheStatusInfo {
  available: boolean;
  lastUpdated: string | null;
  minutesOld: number | null;
  source: string;
  positionCount: number;
  dataPoints: number;
}

const CacheStatus: React.FC = () => {
  const [cacheInfo, setCacheInfo] = useState<CacheStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCacheStatus();
    // Refresh cache status every 30 seconds
    const interval = setInterval(loadCacheStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadCacheStatus = async () => {
    try {
      const status = await getCacheStatus();
      setCacheInfo(status);
    } catch (error) {
      console.error('Error loading cache status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (!cacheInfo) {
    return null;
  }

  const getStatusIcon = () => {
    if (!cacheInfo.available) return '🔄';
    if (cacheInfo.minutesOld !== null && cacheInfo.minutesOld < 5) return '🟢';
    if (cacheInfo.minutesOld !== null && cacheInfo.minutesOld < 15) return '🟡';
    return '🔴';
  };

  const getStatusText = () => {
    if (!cacheInfo.available) return 'Live RPC';
    if (cacheInfo.minutesOld !== null) {
      const minutes = Math.floor(cacheInfo.minutesOld);
      const seconds = Math.floor((cacheInfo.minutesOld - minutes) * 60);
      return `Cached (${minutes}m ${seconds}s ago)`;
    }
    return 'Cached';
  };

  return (
    <div className="cache-status">
      <div className="cache-status-indicator">
        <span className="cache-icon">{getStatusIcon()}</span>
        <span className="cache-text">{getStatusText()}</span>
      </div>
      
      {cacheInfo.available && (
        <div className="cache-details">
          <span className="cache-detail">
            {cacheInfo.positionCount} positions, {cacheInfo.dataPoints} data points
          </span>
        </div>
      )}
    </div>
  );
};

export default CacheStatus;