import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { ChartJSOrUndefined } from 'react-chartjs-2/dist/types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PannableLineChartProps {
  title: string;
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
    fill?: boolean;
    tension?: number;
    borderDash?: number[];
  }[];
  height?: number;
  showLegend?: boolean;
  yAxisLabel?: string;
  xAxisLabel?: string;
  formatTooltip?: (value: number) => string;
  formatYAxis?: (value: number) => string;
  customTooltipData?: any[];
  customTooltipCallback?: (context: any, customData: any) => string[];
  unifiedTooltip?: boolean;
  windowSize?: number; // How many data points to show at once
}

const PannableLineChart: React.FC<PannableLineChartProps> = ({
  title,
  labels,
  datasets,
  height = 300,
  showLegend = true,
  yAxisLabel,
  xAxisLabel,
  formatTooltip,
  formatYAxis,
  customTooltipData,
  customTooltipCallback,
  unifiedTooltip = false,
  windowSize = 7, // Default to 7 days
}) => {
  console.log('🎯 PannableLineChart rendering with:', {
    title,
    totalLabels: labels.length,
    windowSize,
    showControls: labels.length > windowSize
  });
  const chartRef = useRef<ChartJSOrUndefined<'line'>>(null);
  const [startIndex, setStartIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartIndex, setDragStartIndex] = useState(0);
  const [currentWindowSize, setCurrentWindowSize] = useState(windowSize);

  // Calculate visible data window
  const endIndex = Math.min(startIndex + currentWindowSize, labels.length);
  const visibleLabels = labels.slice(startIndex, endIndex);
  const visibleDatasets = datasets.map(dataset => ({
    ...dataset,
    data: dataset.data.slice(startIndex, endIndex)
  }));
  const visibleCustomData = customTooltipData?.slice(startIndex, endIndex);

  // Calculate max index for bounds checking
  const maxStartIndex = Math.max(0, labels.length - currentWindowSize);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    console.log('🖱️ Mouse down at:', e.clientX);
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartIndex(startIndex);
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartX;
    const chartWidth = e.currentTarget.offsetWidth;
    
    console.log('🖱️ Mouse move:', { deltaX, chartWidth, isDragging });
    
    // Calculate how many data points to shift based on drag distance
    const pointsPerPixel = windowSize / chartWidth;
    const indexDelta = Math.round(-deltaX * pointsPerPixel);
    
    const newStartIndex = Math.max(0, Math.min(maxStartIndex, dragStartIndex + indexDelta));
    if (newStartIndex !== startIndex) {
      console.log('🖱️ Updating index from', startIndex, 'to', newStartIndex);
      setStartIndex(newStartIndex);
    }
  };

  const handleMouseUp = useCallback(() => {
    console.log('🖱️ Mouse up');
    setIsDragging(false);
  }, []);

  const handleMouseLeave = () => {
    // Don't stop dragging on mouse leave - only on mouse up
  };

  // Global mouse move and up handlers
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - dragStartX;
      const chartElement = document.querySelector('.pannable-chart-container');
      const chartWidth = chartElement?.clientWidth || 600;
      
      // Improved drag sensitivity - map full drag width to full data range
      const dragRatio = -deltaX / chartWidth; // Negative because dragging left should go forward in time
      const totalDataPoints = labels.length;
      const maxDragDistance = totalDataPoints - windowSize;
      const indexDelta = Math.round(dragRatio * maxDragDistance);
      
      const newStartIndex = Math.max(0, Math.min(maxStartIndex, dragStartIndex + indexDelta));
      if (newStartIndex !== startIndex) {
        console.log('🖱️ Updating index from', startIndex, 'to', newStartIndex);
        setStartIndex(newStartIndex);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDragging) {
        console.log('🖱️ Global mouse up');
        setIsDragging(false);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, dragStartX, dragStartIndex, windowSize, maxStartIndex, startIndex]);

  // Touch event handlers for mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStartX(e.touches[0].clientX);
      setDragStartIndex(startIndex);
      e.preventDefault();
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging || e.touches.length !== 1) return;

    const deltaX = e.touches[0].clientX - dragStartX;
    const chartWidth = e.currentTarget.offsetWidth;
    
    const pointsPerPixel = windowSize / chartWidth;
    const indexDelta = Math.round(-deltaX * pointsPerPixel);
    
    const newStartIndex = Math.max(0, Math.min(maxStartIndex, dragStartIndex + indexDelta));
    setStartIndex(newStartIndex);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Mouse wheel zoom handler
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    const zoomSpeed = 0.1;
    const delta = e.deltaY > 0 ? 1 + zoomSpeed : 1 - zoomSpeed;
    
    // Calculate new window size with bounds
    const newWindowSize = Math.round(currentWindowSize * delta);
    const clampedWindowSize = Math.max(3, Math.min(labels.length, newWindowSize));
    
    if (clampedWindowSize !== currentWindowSize) {
      // Adjust start index to keep the center point stable
      const centerRatio = 0.5; // Keep center of view stable
      const oldCenter = startIndex + currentWindowSize * centerRatio;
      const newStartIndex = Math.round(oldCenter - clampedWindowSize * centerRatio);
      const clampedStartIndex = Math.max(0, Math.min(labels.length - clampedWindowSize, newStartIndex));
      
      setCurrentWindowSize(clampedWindowSize);
      setStartIndex(clampedStartIndex);
    }
  }, [currentWindowSize, startIndex, labels.length]);

  // Navigation buttons
  const canGoBack = startIndex > 0;
  const canGoForward = startIndex < maxStartIndex;

  const goBack = () => {
    setStartIndex(Math.max(0, startIndex - Math.floor(currentWindowSize / 2)));
  };

  const goForward = () => {
    setStartIndex(Math.min(maxStartIndex, startIndex + Math.floor(currentWindowSize / 2)));
  };

  const goToStart = () => {
    setStartIndex(0);
  };

  const goToEnd = () => {
    setStartIndex(maxStartIndex);
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    events: isDragging ? [] : ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
    plugins: {
      legend: {
        display: showLegend,
        position: 'bottom' as const,
      },
      title: {
        display: false,
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: (context) => {
            if (customTooltipCallback && visibleCustomData) {
              const customData = visibleCustomData[context.dataIndex];
              return customTooltipCallback(context, customData);
            }
            const value = context.parsed.y;
            const formattedValue = formatTooltip ? formatTooltip(value) : value.toLocaleString();
            return `${context.dataset.label}: ${formattedValue}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: !!xAxisLabel,
          text: xAxisLabel,
        },
        grid: {
          display: false,
        },
      },
      y: {
        title: {
          display: !!yAxisLabel,
          text: yAxisLabel,
        },
        ticks: {
          callback: function(tickValue: any) {
            if (formatYAxis) {
              return formatYAxis(tickValue as number);
            }
            return tickValue.toLocaleString();
          },
        },
        beginAtZero: false,
      },
    },
  };

  const data = {
    labels: visibleLabels,
    datasets: visibleDatasets,
  };

  const navButtonStyle: React.CSSProperties = {
    padding: '4px 8px',
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '4px',
    color: '#60a5fa',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
  };

  const navButtonDisabledStyle: React.CSSProperties = {
    ...navButtonStyle,
    opacity: 0.5,
    cursor: 'not-allowed',
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3 className="text-sm font-medium text-gray-300 mb-2">{title}</h3>
          {labels.length > currentWindowSize && (
            <span style={{ 
              fontSize: '11px', 
              color: '#9ca3af', 
              fontStyle: 'italic'
            }}>
              Click and drag to navigate • Scroll to zoom
            </span>
          )}
        </div>
        {labels.length > currentWindowSize && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={goToStart}
              disabled={!canGoBack}
              style={!canGoBack ? navButtonDisabledStyle : navButtonStyle}
              title="Go to start"
              onMouseEnter={(e) => {
                if (canGoBack) {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (canGoBack) {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                }
              }}
            >
              ⟨⟨
            </button>
            <button
              onClick={goBack}
              disabled={!canGoBack}
              style={!canGoBack ? navButtonDisabledStyle : navButtonStyle}
              title="Previous"
              onMouseEnter={(e) => {
                if (canGoBack) {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (canGoBack) {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                }
              }}
            >
              ⟨
            </button>
            <span style={{ color: '#9ca3af', fontSize: '12px', minWidth: '80px', textAlign: 'center' }}>
              {startIndex + 1}-{endIndex} of {labels.length}
            </span>
            <button
              onClick={goForward}
              disabled={!canGoForward}
              style={!canGoForward ? navButtonDisabledStyle : navButtonStyle}
              title="Next"
              onMouseEnter={(e) => {
                if (canGoForward) {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (canGoForward) {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                }
              }}
            >
              ⟩
            </button>
            <button
              onClick={goToEnd}
              disabled={!canGoForward}
              style={!canGoForward ? navButtonDisabledStyle : navButtonStyle}
              title="Go to end"
              onMouseEnter={(e) => {
                if (canGoForward) {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (canGoForward) {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                }
              }}
            >
              ⟩⟩
            </button>
          </div>
        )}
      </div>
      <div 
        className="pannable-chart-container"
        style={{ 
          height: `${height}px`, 
          cursor: isDragging ? 'grabbing' : 'grab',
          position: 'relative',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        <div style={{ pointerEvents: isDragging ? 'none' : 'auto' }}>
          <Line ref={chartRef} options={options} data={data} />
        </div>
      </div>
    </div>
  );
};

export default PannableLineChart;