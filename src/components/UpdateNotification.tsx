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
  const [serverLastUpdated, setServerLastUpdated] = useState<string | null>(null);

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
        setServerLastUpdated(serverTimestamp);
        
        if (lastUpdated && serverTimestamp > lastUpdated) {
          setShowBanner(true);
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

  // Auto-hide banner after 30 seconds
  useEffect(() => {
    if (showBanner) {
      const timer = setTimeout(() => {
        setShowBanner(false);
      }, 30000);
      
      return () => clearTimeout(timer);
    }
  }, [showBanner]);

  const handleRefresh = () => {
    setShowBanner(false);
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
          {lastUpdated ? `Updated ${timeAgo}` : 'Loading...'}
        </span>
        <span 
          className="live-indicator" 
          style={{ backgroundColor: getLiveIndicatorColor() }}
          title={isChecking ? 'Checking for updates...' : 'Live status'}
        />
        <button 
          className="refresh-button" 
          onClick={handleRefresh}
          disabled={isChecking}
          title="Refresh data"
        >
          <svg 
            className={`refresh-icon ${isChecking ? 'spinning' : ''}`} 
            width="14" 
            height="14" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.49 9A9 9 0 0 0 5.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 0 1 3.51 15" />
          </svg>
        </button>
      </div>

      {/* Update banner */}
      <div className={`update-banner ${showBanner ? 'show' : ''}`}>
        <div className="update-banner-content">
          <span className="update-icon">⚡</span>
          <span className="update-message">New data available</span>
          <button className="update-action" onClick={handleRefresh}>
            Refresh now
          </button>
          <button className="update-dismiss" onClick={() => setShowBanner(false)}>
            ×
          </button>
        </div>
      </div>
    </>
  );
};

export default UpdateNotification;