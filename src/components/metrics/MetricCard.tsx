import React from 'react';
import './MetricCard.css';

interface MetricCardProps {
  title: string | React.ReactNode;
  value: string | number;
  subtitle?: string;
  prefix?: string | React.ReactNode;
  suffix?: string | React.ReactNode;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, prefix, suffix }) => {
  // Determine font size class based on value length
  const valueStr = value.toString();
  let sizeClass = '';
  
  if (valueStr.length > 15) {
    sizeClass = 'very-long-number';
  } else if (valueStr.length > 10) {
    sizeClass = 'long-number';
  }
  
  return (
    <div className="metric-card">
      <h3 className="metric-title">{title}</h3>
      <div className={`metric-value ${sizeClass}`}>
        {prefix && <span className="metric-prefix">{prefix}</span>}
        {value}
        {suffix && <span className="metric-suffix">{suffix}</span>}
      </div>
      {subtitle && <div className="metric-subtitle">{subtitle}</div>}
    </div>
  );
};

export default MetricCard;