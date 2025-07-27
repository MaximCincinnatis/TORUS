import React from 'react';
import './SkeletonChart.css';

interface SkeletonChartProps {
  type?: 'line' | 'bar' | 'area';
  showAxes?: boolean;
  showLegend?: boolean;
}

const SkeletonChart: React.FC<SkeletonChartProps> = ({ 
  type = 'line', 
  showAxes = true,
  showLegend = false 
}) => {
  return (
    <div className="skeleton-chart-modern">
      {/* Header Section */}
      <div className="skeleton-chart-header">
        <div className="skeleton-chart-controls">
          <div className="skeleton-date-range">
            <div className="skeleton-button" />
            <div className="skeleton-button" />
            <div className="skeleton-button" />
            <div className="skeleton-button" />
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="skeleton-chart-container">
        {/* Y-Axis Labels */}
        {showAxes && (
          <div className="skeleton-y-axis">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton-axis-label" />
            ))}
          </div>
        )}

        {/* Main Chart Area */}
        <div className="skeleton-chart-area">
          {/* Grid Lines */}
          <div className="skeleton-grid">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton-grid-line-horizontal" />
            ))}
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton-grid-line-vertical" />
            ))}
          </div>

          {/* Chart Content */}
          {type === 'bar' && (
            <div className="skeleton-bars-container">
              {Array.from({ length: 12 }).map((_, i) => (
                <div 
                  key={i} 
                  className="skeleton-bar-group"
                >
                  <div 
                    className="skeleton-bar" 
                    style={{ 
                      height: `${Math.sin(i * 0.5) * 30 + 50}%`,
                      animationDelay: `${i * 0.1}s`
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {type === 'line' && (
            <div className="skeleton-line-container">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="skeleton-line-svg">
                <defs>
                  {/* Ultra-refined gradients for institutional quality */}
                  <linearGradient id="skeleton-line-primary" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(100, 116, 139, 0.15)" />
                    <stop offset="50%" stopColor="rgba(100, 116, 139, 0.35)" />
                    <stop offset="100%" stopColor="rgba(100, 116, 139, 0.15)" />
                  </linearGradient>
                  <linearGradient id="skeleton-area-subtle" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(100, 116, 139, 0.03)" />
                    <stop offset="100%" stopColor="rgba(100, 116, 139, 0.008)" />
                  </linearGradient>
                  <linearGradient id="skeleton-shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="transparent" />
                    <stop offset="45%" stopColor="rgba(148, 163, 184, 0.08)" />
                    <stop offset="55%" stopColor="rgba(148, 163, 184, 0.12)" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>
                
                {/* Subtle area fill - barely visible */}
                <path
                  d="M 0,78 L 12,65 L 25,58 L 38,52 L 50,48 L 62,45 L 75,42 L 88,40 L 100,38 L 100,100 L 0,100 Z"
                  fill="url(#skeleton-area-subtle)"
                  className="skeleton-area-institutional"
                />
                
                {/* Single, clean trend line */}
                <path
                  d="M 0,78 L 12,65 L 25,58 L 38,52 L 50,48 L 62,45 L 75,42 L 88,40 L 100,38"
                  fill="none"
                  stroke="url(#skeleton-line-primary)"
                  strokeWidth="1.5"
                  strokeLinecap="butt"
                  className="skeleton-line-institutional"
                />
                
                {/* Minimal data points - only key nodes */}
                {[
                  { x: 25, y: 58 }, { x: 50, y: 48 }, { x: 75, y: 42 }
                ].map((point, i) => (
                  <circle
                    key={`point-${i}`}
                    cx={point.x}
                    cy={point.y}
                    r="1.5"
                    fill="rgba(100, 116, 139, 0.4)"
                    className="skeleton-point-minimal"
                    style={{ animationDelay: `${i * 0.8}s` }}
                  />
                ))}
                
                {/* Shimmer overlay for sophisticated loading effect */}
                <rect
                  x="0"
                  y="0"
                  width="100"
                  height="100"
                  fill="url(#skeleton-shimmer)"
                  className="skeleton-shimmer-overlay"
                />
              </svg>
              
              {/* Minimal value indicators - top right corner */}
              <div className="skeleton-value-display">
                <div className="skeleton-value-primary"></div>
                <div className="skeleton-value-change"></div>
              </div>
            </div>
          )}

          {type === 'area' && (
            <div className="skeleton-area-container">
              <div className="skeleton-area-shape" />
            </div>
          )}
        </div>

        {/* X-Axis Labels */}
        {showAxes && (
          <div className="skeleton-x-axis">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton-axis-label" />
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="skeleton-legend">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton-legend-item">
              <div className="skeleton-legend-color" />
              <div className="skeleton-legend-label" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SkeletonChart;