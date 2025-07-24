import React from 'react';
import './SkeletonMetric.css';

const SkeletonMetric: React.FC = () => {
  return (
    <div className="skeleton-metric">
      <div className="skeleton-metric-label" />
      <div className="skeleton-metric-value" />
      <div className="skeleton-metric-trend" />
    </div>
  );
};

export default SkeletonMetric;