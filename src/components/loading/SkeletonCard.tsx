import React from 'react';
import './SkeletonCard.css';

interface SkeletonCardProps {
  variant?: 'default' | 'large' | 'compact';
  showTrend?: boolean;
  delay?: number;
}

const SkeletonCard: React.FC<SkeletonCardProps> = ({ 
  variant = 'default',
  showTrend = false,
  delay = 0
}) => {
  return (
    <div 
      className={`skeleton-card skeleton-card-${variant}`}
      style={{ animationDelay: `${delay}s` }}
    >
      {/* Title with icon placeholder */}
      <div className="skeleton-title-row">
        <div className="skeleton-icon" />
        <div className="skeleton-title" />
      </div>
      
      {/* Value with prefix/suffix placeholders */}
      <div className="skeleton-value-row">
        <div className="skeleton-prefix" />
        <div className="skeleton-value" />
        <div className="skeleton-suffix" />
      </div>
      
      {/* Subtitle and trend */}
      <div className="skeleton-footer">
        <div className="skeleton-subtitle" />
        {showTrend && (
          <div className="skeleton-trend">
            <div className="skeleton-trend-icon" />
            <div className="skeleton-trend-value" />
          </div>
        )}
      </div>
      
      {/* Background pattern */}
      <div className="skeleton-pattern" />
    </div>
  );
};

export default SkeletonCard;