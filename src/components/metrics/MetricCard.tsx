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
  // Determine font size class based on TOTAL content length (value + suffix)
  // This ensures the entire content fits within the card without clipping
  const valueStr = value.toString();

  // Calculate suffix length: strings use actual length, React nodes estimate ~6 chars
  const suffixLength = suffix ? (typeof suffix === 'string' ? suffix.length : 6) : 0;
  const totalLength = valueStr.length + suffixLength;

  let sizeClass = '';

  if (totalLength > 20) {
    sizeClass = 'extremely-long-number';
  } else if (totalLength > 15) {
    sizeClass = 'very-long-number';
  } else if (totalLength > 10) {
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