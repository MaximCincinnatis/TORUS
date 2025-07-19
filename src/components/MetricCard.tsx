import React from 'react';
import './MetricCard.css';

interface MetricCardProps {
  title: React.ReactNode;
  value: string | number;
  suffix?: React.ReactNode;
  prefix?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  suffix, 
  prefix, 
  trend,
  className = ''
}) => {
  return (
    <div className={`metric-card ${className}`}>
      <div className="metric-title">{title}</div>
      <div className="metric-value">
        {prefix && <span className="metric-prefix">{prefix}</span>}
        {value}
        {suffix && <span className="metric-suffix"> {suffix}</span>}
      </div>
      {trend && (
        <div className={`metric-trend ${trend.isPositive ? 'positive' : 'negative'}`}>
          {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
        </div>
      )}
    </div>
  );
};

export default MetricCard;