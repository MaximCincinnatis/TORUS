import React from 'react';
import './SkeletonTable.css';

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

const SkeletonTable: React.FC<SkeletonTableProps> = ({ rows = 5, columns = 6 }) => {
  return (
    <div className="skeleton-table">
      <div className="skeleton-table-header">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={`header-${i}`} className="skeleton-table-header-cell" />
        ))}
      </div>
      <div className="skeleton-table-body">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="skeleton-table-row">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div 
                key={`cell-${rowIndex}-${colIndex}`} 
                className="skeleton-table-cell"
                style={{ animationDelay: `${(rowIndex * columns + colIndex) * 0.05}s` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkeletonTable;