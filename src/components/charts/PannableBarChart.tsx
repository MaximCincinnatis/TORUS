import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  LogarithmicScale,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { ChartJSOrUndefined } from 'react-chartjs-2/dist/types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface PannableBarChartProps {
  title: string;
  labels: (string | string[])[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
  }[];
  height?: number;
  yAxisLabel?: string;
  xAxisLabel?: string;
  stacked?: boolean;
  showLegend?: boolean;
  formatTooltip?: (value: number) => string;
  formatYAxis?: (value: number) => string;
  enableScaleToggle?: boolean;
  minBarHeight?: number;
  windowSize?: number;
}

const PannableBarChart: React.FC<PannableBarChartProps> = ({
  title,
  labels,
  datasets,
  height = 300,
  yAxisLabel,
  xAxisLabel,
  stacked = false,
  showLegend = false,
  formatTooltip,
  formatYAxis,
  enableScaleToggle = false,
  minBarHeight = 1,
  windowSize = 30,
}) => {
  const chartRef = useRef<ChartJSOrUndefined<'bar'>>(null);
  const [startIndex, setStartIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartIndex, setDragStartIndex] = useState(0);
  const [currentWindowSize, setCurrentWindowSize] = useState(windowSize);
  const [isLogScale, setIsLogScale] = useState(false);

  // Calculate visible data window
  const endIndex = Math.min(startIndex + currentWindowSize, labels.length);
  const visibleLabels = labels.slice(startIndex, endIndex);
  const visibleDatasets = datasets.map(dataset => ({
    ...dataset,
    data: dataset.data.slice(startIndex, endIndex).map(val => 
      isLogScale && val === 0 ? minBarHeight : val
    )
  }));

  // Calculate max index for bounds checking
  const maxStartIndex = Math.max(0, labels.length - currentWindowSize);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartIndex(startIndex);
    e.preventDefault();
    e.stopPropagation();
  };

  // Global mouse move and up handlers
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - dragStartX;
      const chartElement = document.querySelector('.pannable-bar-chart-container');
      const chartWidth = chartElement?.clientWidth || 600;
      
      // Calculate drag movement - simpler approach
      const pixelsPerDataPoint = chartWidth / currentWindowSize;
      const dataPointsMoved = Math.round(deltaX / pixelsPerDataPoint);
      
      const newStartIndex = Math.max(0, Math.min(maxStartIndex, dragStartIndex - dataPointsMoved));
      if (newStartIndex !== startIndex) {
        setStartIndex(newStartIndex);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDragging) {
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
  }, [isDragging, dragStartX, dragStartIndex, currentWindowSize, maxStartIndex, startIndex, labels.length]);

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
      const centerRatio = 0.5;
      const oldCenter = startIndex + currentWindowSize * centerRatio;
      const newStartIndex = Math.round(oldCenter - clampedWindowSize * centerRatio);
      const clampedStartIndex = Math.max(0, Math.min(labels.length - clampedWindowSize, newStartIndex));
      
      setCurrentWindowSize(clampedWindowSize);
      setStartIndex(clampedStartIndex);
    }
  }, [currentWindowSize, startIndex, labels.length]);

  // Navigation functions
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

  const options: ChartOptions<'bar'> = {
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
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            const formattedValue = formatTooltip ? formatTooltip(value) : value.toLocaleString();
            return `${context.dataset.label}: ${formattedValue}`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked,
        title: {
          display: !!xAxisLabel,
          text: xAxisLabel,
        },
        grid: {
          display: false,
        },
      },
      y: {
        stacked,
        type: isLogScale ? 'logarithmic' : 'linear',
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
        beginAtZero: !isLogScale,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {enableScaleToggle && (
            <button
              onClick={() => setIsLogScale(!isLogScale)}
              style={{
                ...navButtonStyle,
                backgroundColor: isLogScale ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
              }}
              title="Toggle logarithmic scale"
            >
              {isLogScale ? 'Log' : 'Linear'}
            </button>
          )}
          {labels.length > currentWindowSize && (
            <>
              <button
                onClick={goToStart}
                disabled={!canGoBack}
                style={!canGoBack ? navButtonDisabledStyle : navButtonStyle}
                title="Go to start"
              >
                ⟨⟨
              </button>
              <button
                onClick={goBack}
                disabled={!canGoBack}
                style={!canGoBack ? navButtonDisabledStyle : navButtonStyle}
                title="Previous"
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
              >
                ⟩
              </button>
              <button
                onClick={goToEnd}
                disabled={!canGoForward}
                style={!canGoForward ? navButtonDisabledStyle : navButtonStyle}
                title="Go to end"
              >
                ⟩⟩
              </button>
            </>
          )}
        </div>
      </div>
      <div 
        className="pannable-bar-chart-container"
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
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => {}}
        onWheel={handleWheel}
      >
        <div style={{ pointerEvents: isDragging ? 'none' : 'auto', height: '100%' }}>
          <Bar ref={chartRef} options={options} data={data} />
        </div>
      </div>
    </div>
  );
};

export default PannableBarChart;