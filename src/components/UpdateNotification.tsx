import React, { useState, useEffect, useCallback } from 'react';
import './UpdateNotification.css';

interface UpdateNotificationProps {
  lastUpdated: string | null;
  onRefresh: () => void;
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({ lastUpdated, onRefresh }) => {
  const [showBanner, setShowBanner] = useState(false);
  const [timeAgo, setTimeAgo] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [hasNewData, setHasNewData] = useState(false);

  // Format time ago
  const formatTimeAgo = useCallback((timestamp: string) => {
    const now = new Date();
    const updated = new Date(timestamp);
    const diffMs = now.getTime() - updated.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffSecs < 10) return 'just now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return updated.toLocaleDateString();
  }, []);

  // Update time ago every second
  useEffect(() => {
    if (!lastUpdated) return;

    const updateTimeAgo = () => {
      setTimeAgo(formatTimeAgo(lastUpdated));
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 1000);

    return () => clearInterval(interval);
  }, [lastUpdated, formatTimeAgo]);

  // Check for updates
  const checkForUpdates = useCallback(async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    try {
      const response = await fetch('/data/cached-data.json', {
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      const serverTime = response.headers.get('last-modified');
      if (serverTime) {
        const serverTimestamp = new Date(serverTime).toISOString();
        
        if (lastUpdated && serverTimestamp > lastUpdated) {
          setHasNewData(true);
        }
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    } finally {
      setIsChecking(false);
    }
  }, [lastUpdated, isChecking]);

  // Poll for updates every 30 seconds
  useEffect(() => {
    const interval = setInterval(checkForUpdates, 30000);
    
    // Check immediately on mount
    checkForUpdates();
    
    return () => clearInterval(interval);
  }, [checkForUpdates]);

  const handleRefresh = () => {
    setHasNewData(false);
    onRefresh();
  };

  const getLiveIndicatorColor = () => {
    if (isChecking) return '#fbbf24'; // Yellow when checking
    if (!lastUpdated) return '#6b7280'; // Gray when no data
    
    const now = new Date();
    const updated = new Date(lastUpdated);
    const diffMins = (now.getTime() - updated.getTime()) / 1000 / 60;
    
    if (diffMins < 5) return '#10b981'; // Green - fresh data
    if (diffMins < 15) return '#fbbf24'; // Yellow - recent data
    return '#ef4444'; // Red - stale data
  };

  return (
    <>
      {/* Header timestamp */}
      <div className="update-status">
        <span className="update-time">
          {lastUpdated ? `Page data updated: ${timeAgo}` : 'Loading data...'}
        </span>
        <span 
          className="live-indicator" 
          style={{ backgroundColor: getLiveIndicatorColor() }}
          title={isChecking ? 'Checking for updates...' : 'Live status'}
        />
        <button 
          className={`refresh-button ${hasNewData ? 'has-new-data' : ''}`}
          onClick={handleRefresh}
          disabled={isChecking}
          title={hasNewData ? 'New data available, click to refresh' : 'Refresh data'}
        >
          <span className={`refresh-icon ${isChecking ? 'spinning' : ''}`}>
            ↻
          </span>
        </button>
      </div>
    </>
  );
};

export default UpdateNotification;