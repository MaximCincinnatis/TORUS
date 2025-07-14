import React from 'react';
import './SkeletonChart.css';

const SkeletonChart: React.FC = () => {
  return (
    <div className="skeleton-chart">
      <div className="skeleton-chart-header">
        <div className="skeleton-chart-title" />
      </div>
      <div className="skeleton-chart-body">
        <div className="skeleton-chart-bars">
          {Array.from({ length: 20 }).map((_, i) => (
            <div 
              key={i} 
              className="skeleton-chart-bar" 
              style={{ 
                height: `${Math.random() * 60 + 20}%`,
                animationDelay: `${i * 0.05}s`
              }}
            />
          ))}
        </div>
        <div className="skeleton-chart-axis" />
      </div>
    </div>
  );
};

export default SkeletonChart;