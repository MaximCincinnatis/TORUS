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
                  <linearGradient id="skeleton-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(139, 92, 246, 0.1)" />
                    <stop offset="50%" stopColor="rgba(139, 92, 246, 0.3)" />
                    <stop offset="100%" stopColor="rgba(139, 92, 246, 0.1)" />
                  </linearGradient>
                </defs>
                <path
                  d="M 0,70 Q 25,30 50,50 T 100,30"
                  fill="none"
                  stroke="url(#skeleton-gradient)"
                  strokeWidth="2"
                  className="skeleton-line-path"
                />
              </svg>
              {/* Data Points */}
              {Array.from({ length: 8 }).map((_, i) => (
                <div 
                  key={i}
                  className="skeleton-data-point"
                  style={{
                    left: `${(i / 7) * 100}%`,
                    top: `${50 + Math.sin(i * 0.8) * 30}%`,
                    animationDelay: `${i * 0.1}s`
                  }}
                />
              ))}
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