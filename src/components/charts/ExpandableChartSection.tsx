import React, { useRef } from 'react';
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
  // Always expanded - removed state management
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`expandable-chart-section expanded`}>
      <div className="chart-section-header">
        <div className="header-content">
          <div className="header-main">
            <div className="header-title-area">
              <h2 className="section-title">{title}</h2>
              {subtitle && <p className="section-subtitle">{subtitle}</p>}
            </div>
          </div>
        </div>
        
        <div className="header-border"></div>
      </div>

      <div className={`chart-section-content expanded`}>
        <div ref={contentRef} className={`content-inner visible`}>
          {loading ? (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default ExpandableChartSection;