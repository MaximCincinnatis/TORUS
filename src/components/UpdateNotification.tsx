import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const checkingRef = useRef(false);

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
    if (checkingRef.current) return;
    
    checkingRef.current = true;
    setIsChecking(true);
    try {
      const response = await fetch(`/data/cached-data.json?t=${Date.now()}`, {
        cache: 'no-cache'
      });
      const data = await response.json();
      
      if (data.lastUpdated && lastUpdated && data.lastUpdated > lastUpdated) {
        setHasNewData(true);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    } finally {
      setIsChecking(false);
      checkingRef.current = false;
    }
  }, [lastUpdated]);

  // Poll for updates every 30 seconds
  useEffect(() => {
    const interval = setInterval(checkForUpdates, 30000);
    
    // Check immediately on mount
    checkForUpdates();
    
    return () => clearInterval(interval);
  }, [checkForUpdates]);

  const handleRefresh = () => {
    if (isChecking) return;
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

  // Only show when new data is available or checking
  if (!hasNewData && !isChecking) {
    return null;
  }

  return (
    <>
      {/* Header timestamp */}
      <div className="update-status">
        <div className="update-content">
          <button 
            className={`refresh-button ${hasNewData ? 'has-new-data' : ''}`}
            onClick={handleRefresh}
            disabled={isChecking}
            title={hasNewData ? 'New data available, click to refresh' : 'Data is up to date'}
          >
            <span className={`refresh-icon ${isChecking ? 'spinning' : ''}`}>
              ↻
            </span>
            {hasNewData && (
              <>
                <span className="button-text desktop-text">Update Available</span>
                <span className="button-text mobile-text">Update</span>
              </>
            )}
          </button>
          {hasNewData && lastUpdated && (
            <span className="viewing-old-data desktop-only">
              Viewing Data {timeAgo.replace(' ago', '')} Old
            </span>
          )}
        </div>
        <span 
          className="live-indicator desktop-only" 
          style={{ backgroundColor: getLiveIndicatorColor() }}
          title={isChecking ? 'Checking for updates...' : 'Live status'}
        />
      </div>
    </>
  );
};

export default UpdateNotification;