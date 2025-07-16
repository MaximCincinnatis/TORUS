import React, { useState, useRef, useEffect } from 'react';
import './ExpandableChartSection.css';

interface ExpandableChartSectionProps {
  id: string;
  title: React.ReactNode;
  subtitle?: string;
  keyMetrics?: Array<{
    label: string;
    value: string | number;
    change?: string;
    trend?: 'up' | 'down' | 'neutral';
  }>;
  miniChart?: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  loading?: boolean;
  onToggle?: (expanded: boolean) => void;
}

const ExpandableChartSection: React.FC<ExpandableChartSectionProps> = ({
  id,
  title,
  subtitle,
  keyMetrics = [],
  miniChart,
  children,
  defaultExpanded = false,
  loading = false,
  onToggle
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showContent, setShowContent] = useState(defaultExpanded);
  const [isAnimating, setIsAnimating] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Sync with parent state changes (for expand all/collapse all)
  useEffect(() => {
    if (defaultExpanded !== isExpanded && !isAnimating) {
      setIsExpanded(defaultExpanded);
      setShowContent(defaultExpanded);
    }
  }, [defaultExpanded, isExpanded, isAnimating]);

  const handleToggle = () => {
    if (isAnimating) return; // Prevent multiple clicks during animation
    
    setIsAnimating(true);
    
    if (!isExpanded) {
      // Expanding: Show content first, then animate
      setShowContent(true);
      setIsExpanded(true);
      onToggle?.(true);
      
      // Reset animation state after transition
      setTimeout(() => setIsAnimating(false), 400);
    } else {
      // Collapsing: Animate first, then hide content
      setIsExpanded(false);
      onToggle?.(false);
      
      // Hide content after animation completes
      setTimeout(() => {
        setShowContent(false);
        setIsAnimating(false);
      }, 400);
    }
  };

  const getTrendIcon = (trend?: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return (
          <svg className="trend-icon trend-up" width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M7 14L12 9L17 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'down':
        return (
          <svg className="trend-icon trend-down" width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M17 10L12 15L7 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`expandable-chart-section ${isExpanded ? 'expanded' : 'collapsed'} ${isAnimating ? 'animating' : ''}`}>
      <div className="chart-section-header" onClick={handleToggle}>
        <div className="header-content">
          <div className="header-main">
            <div className="header-title-area">
              <h2 className="section-title">{title}</h2>
              {subtitle && <p className="section-subtitle">{subtitle}</p>}
            </div>
            
            <div className="header-controls">
              <button 
                className={`expand-button ${isExpanded ? 'expanded' : ''}`}
                aria-label={isExpanded ? 'Collapse chart' : 'Expand chart'}
                aria-expanded={isExpanded}
              >
                <svg 
                  className="expand-icon" 
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none"
                >
                  <path 
                    d="M6 9L12 15L18 9" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
          
          {!isExpanded && (
            <div className="header-preview">
              {keyMetrics.length > 0 && (
                <div className="key-metrics">
                  {keyMetrics.slice(0, 4).map((metric, index) => (
                    <div key={index} className="metric-item">
                      <span className="metric-label">{metric.label}</span>
                      <div className="metric-value-container">
                        <span className="metric-value">{metric.value}</span>
                        {metric.change && (
                          <span className={`metric-change ${metric.trend || 'neutral'}`}>
                            {getTrendIcon(metric.trend)}
                            {metric.change}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {miniChart && (
                <div className="mini-chart-container">
                  {miniChart}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="header-border"></div>
      </div>

      <div 
        className={`chart-section-content ${isExpanded ? 'expanded' : 'collapsed'} ${isAnimating ? 'animating' : ''}`}
      >
        <div ref={contentRef} className={`content-inner ${showContent ? 'visible' : 'hidden'}`}>
          {showContent && (
            loading ? (
              <div className="chart-loading-container">
                <div className="chart-skeleton">
                  <div className="skeleton-header"></div>
                  <div className="skeleton-chart"></div>
                </div>
              </div>
            ) : (
              <div className="chart-content-wrapper">
                {children}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default ExpandableChartSection;