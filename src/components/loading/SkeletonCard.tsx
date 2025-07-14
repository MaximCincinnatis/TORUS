import React from 'react';
import './SkeletonCard.css';

const SkeletonCard: React.FC = () => {
  return (
    <div className="skeleton-card">
      <div className="skeleton-title" />
      <div className="skeleton-value" />
      <div className="skeleton-subtitle" />
    </div>
  );
};

export default SkeletonCard;