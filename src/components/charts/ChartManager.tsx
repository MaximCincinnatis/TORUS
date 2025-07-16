import React from 'react';
import './ChartManager.css';

interface ChartManagerProps {
  onExpandAll: () => void;
  onCollapseAll: () => void;
  expandedCount: number;
  totalCount: number;
}

const ChartManager: React.FC<ChartManagerProps> = ({
  onExpandAll,
  onCollapseAll,
  expandedCount,
  totalCount
}) => {
  const allExpanded = expandedCount === totalCount;
  const allCollapsed = expandedCount === 0;

  return (
    <div className="chart-manager">
      <div className="chart-manager-content">
        <div className="chart-stats">
          <span className="chart-count">
            {expandedCount} of {totalCount} charts expanded
          </span>
        </div>
        
        <div className="chart-controls">
          <button
            className={`control-button ${allExpanded ? 'disabled' : ''}`}
            onClick={onExpandAll}
            disabled={allExpanded}
            aria-label="Expand all charts"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M8 3V5H5V8H3V5C3 3.89543 3.89543 3 5 3H8Z" fill="currentColor"/>
              <path d="M21 5V8H19V5H16V3H19C20.1046 3 21 3.89543 21 5Z" fill="currentColor"/>
              <path d="M19 19V16H21V19C21 20.1046 20.1046 21 19 21H16V19H19Z" fill="currentColor"/>
              <path d="M5 19H8V21H5C3.89543 21 3 20.1046 3 19V16H5V19Z" fill="currentColor"/>
              <path d="M9 9H15V15H9V9Z" fill="currentColor"/>
            </svg>
            Expand All
          </button>
          
          <button
            className={`control-button ${allCollapsed ? 'disabled' : ''}`}
            onClick={onCollapseAll}
            disabled={allCollapsed}
            aria-label="Collapse all charts"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M8 3V5H5V8H3V5C3 3.89543 3.89543 3 5 3H8Z" fill="currentColor"/>
              <path d="M21 5V8H19V5H16V3H19C20.1046 3 21 3.89543 21 5Z" fill="currentColor"/>
              <path d="M19 19V16H21V19C21 20.1046 20.1046 21 19 21H16V19H19Z" fill="currentColor"/>
              <path d="M5 19H8V21H5C3.89543 21 3 20.1046 3 19V16H5V19Z" fill="currentColor"/>
            </svg>
            Collapse All
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChartManager;