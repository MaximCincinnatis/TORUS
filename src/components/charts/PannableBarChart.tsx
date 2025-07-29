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
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar } from 'react-chartjs-2';
import type { ChartJSOrUndefined } from 'react-chartjs-2/dist/types';
import { gradientPlugin } from '../../utils/chartGradients';
import ChartLegend from './ChartLegend';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  gradientPlugin
);

interface PannableBarChartProps {
  title: React.ReactNode;
  labels: (string | string[])[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    yAxisID?: string;
  }[];
  height?: number;
  yAxisLabel?: string;
  xAxisLabel?: string;
  stacked?: boolean;
  showLegend?: boolean;
  formatTooltip?: (value: number, datasetIndex?: number) => string;
  formatYAxis?: (value: number) => string;
  enableScaleToggle?: boolean;
  minBarHeight?: number;
  windowSize?: number;
  showDataLabels?: boolean;
  showTotals?: boolean;
  multipleYAxes?: boolean;
  yAxis1Label?: string;
  yAxis2Label?: string;
  customLegendItems?: Array<{
    label: string;
    color: string;
    logo?: string;
  }>;
  tooltipCallbacks?: {
    afterBody?: (context: any) => string | string[];
  };
  initialStartDay?: number;
  chartType?: 'historical' | 'future'; // New prop to determine navigation behavior
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
  showDataLabels = false,
  showTotals = false,
  multipleYAxes = false,
  yAxis1Label,
  yAxis2Label,
  customLegendItems,
  tooltipCallbacks,
  initialStartDay,
  chartType = 'future', // Default to future behavior for backward compatibility
}) => {
  const chartRef = useRef<ChartJSOrUndefined<'bar'>>(null);
  const [startIndex, setStartIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartIndex, setDragStartIndex] = useState(0);
  const [currentWindowSize, setCurrentWindowSize] = useState(windowSize);
  const [isLogScale, setIsLogScale] = useState(false);

  // Update currentWindowSize when windowSize prop changes
  useEffect(() => {
    setCurrentWindowSize(windowSize);
    
    // Handle "ALL" case - different behavior for historical vs future charts
    if (windowSize === 9999) {
      if (chartType === 'historical' && initialStartDay !== undefined) {
        // Historical charts: show all data up to current protocol day
        const currentDayIndex = labels.findIndex(label => {
          const labelStr = Array.isArray(label) ? label.join(' ') : label;
          return labelStr.includes(`Day ${initialStartDay}`);
        });
        
        if (currentDayIndex >= 0) {
          // Show from day 1 to current protocol day (inclusive)
          setCurrentWindowSize(currentDayIndex + 1);
        } else {
          // Fallback to showing all available data
          setCurrentWindowSize(labels.length);
        }
        setStartIndex(0);
      } else {
        // Future charts or no initialStartDay: show only data with values
        let lastNonZeroIndex = 0;
        for (let i = datasets[0].data.length - 1; i >= 0; i--) {
          if (datasets.some(dataset => dataset.data[i] > 0)) {
            lastNonZeroIndex = i;
            break;
          }
        }
        // Set window size to show all data with values (add 1 for 0-based index)
        setCurrentWindowSize(lastNonZeroIndex + 1);
        setStartIndex(0);
      }
    } else if (initialStartDay !== undefined && windowSize !== 9999) {
      // Find the index of the initial start day
      const dayIndex = labels.findIndex(label => {
        const labelStr = Array.isArray(label) ? label.join(' ') : label;
        return labelStr.includes(`Day ${initialStartDay}`);
      });
      
      if (dayIndex >= 0) {
        if (chartType === 'historical') {
          // Historical charts: show windowSize days BEFORE current day (inclusive)
          const startIdx = Math.max(0, dayIndex - windowSize + 1);
          console.log('Historical chart setup:', {
            initialStartDay,
            dayIndex,
            windowSize,
            startIdx,
            endIdx: startIdx + windowSize - 1,
            showingDays: `${startIdx + 1} to ${startIdx + windowSize}`
          });
          setStartIndex(startIdx);
        } else {
          // Future charts: show windowSize days FROM current day (inclusive)
          setStartIndex(dayIndex);
        }
      } else {
        setStartIndex(0);
      }
    } else {
      setStartIndex(0);
    }
  }, [windowSize, initialStartDay, labels, chartType, datasets]);

  // Calculate visible data window
  const endIndex = Math.min(startIndex + currentWindowSize, labels.length);
  const visibleLabels = labels.slice(startIndex, endIndex);
  
  // Debug for burn charts
  if (chartType === 'historical' && currentWindowSize < 9999 && visibleLabels.length === 1) {
    console.log('Historical chart showing only 1 bar:', {
      startIndex,
      endIndex,
      currentWindowSize,
      labelsLength: labels.length,
      visibleLabelsLength: visibleLabels.length
    });
  }
  
  const visibleDatasets = datasets.map(dataset => ({
    ...dataset,
    data: dataset.data.slice(startIndex, endIndex).map(val => 
      isLogScale && val === 0 ? minBarHeight : val
    ),
    yAxisID: dataset.yAxisID // Explicitly preserve yAxisID
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

  const baseOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    events: isDragging ? [] : ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
    layout: {
      padding: {
        top: showDataLabels || showTotals ? 25 : 10,
      }
    },
    plugins: {
      legend: {
        display: showLegend && !customLegendItems,
        position: 'bottom' as const,
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            // Handle undefined/null values gracefully
            if (value === undefined || value === null || isNaN(value)) {
              return `${context.dataset.label}: 0`;
            }
            const formattedValue = formatTooltip ? formatTooltip(value, context.datasetIndex) : value.toLocaleString();
            return `${context.dataset.label}: ${formattedValue}`;
          },
          ...(tooltipCallbacks || {})
        },
      },
    },
    scales: multipleYAxes ? {
      x: {
        stacked,
        title: {
          display: !!xAxisLabel,
          text: xAxisLabel,
        },
        grid: {
          display: true,
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: yAxis1Label || yAxisLabel || 'Values',
        },
        grid: {
          display: true,
          color: 'rgba(255, 255, 255, 0.1)',
        },
        beginAtZero: true,
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: yAxis2Label || 'Values',
        },
        grid: {
          drawOnChartArea: false,
        },
        beginAtZero: true,
      },
    } : {
      x: {
        stacked,
        title: {
          display: !!xAxisLabel,
          text: xAxisLabel,
        },
        grid: {
          display: true,
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
      y: {
        stacked,
        type: isLogScale ? 'logarithmic' as const : 'linear' as const,
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
        grid: {
          display: true,
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
  };

  // Add datalabels configuration if needed
  const options: ChartOptions<'bar'> = (showDataLabels || showTotals) ? {
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins,
      datalabels: {
        display: function(context: any) {
          const value = context.dataset?.data?.[context.dataIndex];
          if (showTotals) {
            // Only show label on the last (top) dataset when showing totals
            return context.datasetIndex === datasets.length - 1;
          }
          return value !== null && value !== undefined && value > 0;
        },
        anchor: 'end' as const,
        align: 'top' as const,
        offset: 4,
        clip: false,
        clamp: false,
        color: '#fff',
        font: {
          size: 10,
          weight: 600,
        },
        formatter: function(value: number, context: any) {
          if (showTotals && context.datasetIndex === datasets.length - 1) {
            // Show total for the last (top) dataset
            const dataIndex = context.dataIndex;
            let total = 0;
            for (let i = 0; i < datasets.length; i++) {
              const datasetValue = context.chart.data.datasets[i].data[dataIndex];
              if (datasetValue !== null && datasetValue !== undefined && !isNaN(datasetValue)) {
                total += datasetValue;
              }
            }
            return total > 0 ? Math.round(total).toLocaleString() : '';
          } else if (showDataLabels && !showTotals) {
            // Show individual values when only showDataLabels is true
            if (value !== null && value !== undefined && value > 0) {
              return Math.round(value).toString();
            }
          }
          return '';
        },
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 4,
        padding: {
          top: 2,
          bottom: 2,
          left: 4,
          right: 4,
        },
      }
    }
  } as ChartOptions<'bar'> : baseOptions;

  const data = {
    labels: visibleLabels,
    datasets: visibleDatasets,
  };
  
  // Debug: Log data for charts with multiple y-axes
  if (multipleYAxes && visibleDatasets.length > 1) {
    console.log('Multiple Y-Axes Chart Data:', {
      datasetsCount: visibleDatasets.length,
      dataset0: { 
        label: visibleDatasets[0].label, 
        yAxisID: visibleDatasets[0].yAxisID,
        dataLength: visibleDatasets[0].data.length,
        firstValues: visibleDatasets[0].data.slice(0, 5)
      },
      dataset1: { 
        label: visibleDatasets[1].label, 
        yAxisID: visibleDatasets[1].yAxisID,
        dataLength: visibleDatasets[1].data.length,
        firstValues: visibleDatasets[1].data.slice(0, 5)
      }
    });
  }

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
          <Bar ref={chartRef} options={options} data={data} plugins={(showDataLabels || showTotals) ? [ChartDataLabels] : []} />
        </div>
      </div>
      {customLegendItems && <ChartLegend items={customLegendItems} />}
    </div>
  );
};

export default PannableBarChart;