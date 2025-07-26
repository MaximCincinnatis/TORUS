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
              {/* Multiple realistic line charts */}
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="skeleton-line-svg">
                <defs>
                  <linearGradient id="skeleton-line-primary" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(139, 92, 246, 0.2)" />
                    <stop offset="30%" stopColor="rgba(139, 92, 246, 0.6)" />
                    <stop offset="70%" stopColor="rgba(139, 92, 246, 0.4)" />
                    <stop offset="100%" stopColor="rgba(139, 92, 246, 0.2)" />
                  </linearGradient>
                  <linearGradient id="skeleton-line-secondary" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(236, 72, 153, 0.15)" />
                    <stop offset="50%" stopColor="rgba(236, 72, 153, 0.4)" />
                    <stop offset="100%" stopColor="rgba(236, 72, 153, 0.15)" />
                  </linearGradient>
                  <linearGradient id="skeleton-area-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(139, 92, 246, 0.1)" />
                    <stop offset="100%" stopColor="rgba(139, 92, 246, 0.02)" />
                  </linearGradient>
                </defs>
                
                {/* Area under primary line */}
                <path
                  d="M 0,75 Q 15,45 25,55 T 45,40 Q 60,30 75,45 T 100,35 L 100,100 L 0,100 Z"
                  fill="url(#skeleton-area-fill)"
                  className="skeleton-area-path"
                />
                
                {/* Primary trend line */}
                <path
                  d="M 0,75 Q 15,45 25,55 T 45,40 Q 60,30 75,45 T 100,35"
                  fill="none"
                  stroke="url(#skeleton-line-primary)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="skeleton-line-path skeleton-line-primary"
                />
                
                {/* Secondary trend line */}
                <path
                  d="M 0,85 Q 20,60 35,70 T 65,55 Q 80,45 95,50"
                  fill="none"
                  stroke="url(#skeleton-line-secondary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="skeleton-line-path skeleton-line-secondary"
                />
              </svg>
              
              {/* Primary data points */}
              {[
                { x: 0, y: 75 }, { x: 12, y: 50 }, { x: 25, y: 55 }, { x: 35, y: 45 },
                { x: 45, y: 40 }, { x: 60, y: 30 }, { x: 75, y: 45 }, { x: 88, y: 38 }, { x: 100, y: 35 }
              ].map((point, i) => (
                <div 
                  key={`primary-${i}`}
                  className="skeleton-data-point skeleton-point-primary"
                  style={{
                    left: `${point.x}%`,
                    top: `${point.y}%`,
                    animationDelay: `${i * 0.15}s`
                  }}
                />
              ))}
              
              {/* Secondary data points */}
              {[
                { x: 0, y: 85 }, { x: 20, y: 65 }, { x: 35, y: 70 }, { x: 50, y: 60 },
                { x: 65, y: 55 }, { x: 80, y: 48 }, { x: 95, y: 50 }
              ].map((point, i) => (
                <div 
                  key={`secondary-${i}`}
                  className="skeleton-data-point skeleton-point-secondary"
                  style={{
                    left: `${point.x}%`,
                    top: `${point.y}%`,
                    animationDelay: `${i * 0.2 + 0.5}s`
                  }}
                />
              ))}
              
              {/* Trending value indicators */}
              <div className="skeleton-trend-indicators">
                <div className="skeleton-trend-up">
                  <div className="skeleton-trend-arrow"></div>
                </div>
                <div className="skeleton-trend-steady">
                  <div className="skeleton-trend-line"></div>
                </div>
              </div>
              
              {/* Value tooltips simulation */}
              <div className="skeleton-tooltip skeleton-tooltip-1"></div>
              <div className="skeleton-tooltip skeleton-tooltip-2"></div>
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