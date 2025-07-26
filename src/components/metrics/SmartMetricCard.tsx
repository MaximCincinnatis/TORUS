import React from 'react';
import MetricCard from './MetricCard';
import SkeletonCard from '../loading/SkeletonCard';

interface SmartMetricCardProps {
  title: string | React.ReactNode;
  value: string | number | null | undefined;
  subtitle?: string;
  prefix?: string | React.ReactNode;
  suffix?: string | React.ReactNode;
  isLoading?: boolean;
  delay?: number;
}

const SmartMetricCard: React.FC<SmartMetricCardProps> = ({ 
  title, 
  value, 
  subtitle, 
  prefix, 
  suffix, 
  isLoading = false,
  delay = 0
}) => {
  // Show skeleton if explicitly loading or if value is null/undefined
  const shouldShowSkeleton = isLoading || value === null || value === undefined || value === '';
  
  if (shouldShowSkeleton) {
    return <SkeletonCard delay={delay} showTrend={!!subtitle} />;
  }

  return (
    <MetricCard
      title={title}
      value={value}
      subtitle={subtitle}
      prefix={prefix}
      suffix={suffix}
    />
  );
};

export default SmartMetricCard;