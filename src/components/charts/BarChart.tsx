import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface BarChartProps {
  title: string;
  labels: (string | string[])[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
  }[];
  height?: number;
  stacked?: boolean;
  showLegend?: boolean;
  yAxisLabel?: string;
  xAxisLabel?: string;
  formatTooltip?: (value: number) => string;
  minBarHeight?: number;
  enableScaleToggle?: boolean;
  integerOnly?: boolean; // Force Y-axis to show only integers
  showDataLabels?: boolean; // Show count labels above bars
}

const BarChart: React.FC<BarChartProps> = ({
  title,
  labels,
  datasets,
  height = 300,
  stacked = false,
  showLegend = true,
  yAxisLabel,
  xAxisLabel,
  formatTooltip,
  minBarHeight = 3,
  enableScaleToggle = false,
  integerOnly = false,
  showDataLabels = false,
}) => {
  // Calculate if log scale would be beneficial
  const allValues = datasets.flatMap(d => d.data.filter(v => v > 0));
  const hasValidData = allValues.length > 0;
  const maxValue = hasValidData ? Math.max(...allValues) : 1;
  const minValue = hasValidData ? Math.min(...allValues) : 1;
  const valueRatio = hasValidData ? maxValue / minValue : 1;
  
  // Auto-detect when log scale should be default (following best practices)
  const shouldDefaultToLog = valueRatio > 100; // More than 2 orders of magnitude
  const [useLogScale, setUseLogScale] = useState(shouldDefaultToLog);
  
  // Show toggle if enabled OR if there's a significant benefit to log scale
  const shouldShowToggle = enableScaleToggle || valueRatio > 10;
  
  // Check for zero values when using log scale
  const hasZeroValues = datasets.some(d => d.data.some(v => v === 0));
  const showLogWarning = useLogScale && hasZeroValues;
  
  // Professional chart options with consistent grid lines and formatting
  const baseOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: showDataLabels ? 25 : 10, // Extra space for data labels
      }
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      title: {
        display: false,
      },
      legend: {
        display: showLegend,
        position: 'top' as const,
        labels: {
          color: '#ccc',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#333',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        intersect: false,
        mode: 'index' as const,
        callbacks: {
          label: function(context) {
            const value = context.parsed?.y;
            if (value === undefined || value === null) return '';
            
            if (formatTooltip) {
              return formatTooltip(value);
            }
            return `Count: ${value.toLocaleString()}`;
          }
        }
      },
    },
    scales: {
      x: {
        stacked,
        grid: {
          display: false,
          color: '#333',
        },
        ticks: {
          color: '#888',
          font: {
            size: 11,
          },
          maxRotation: 45,
          minRotation: 0,
        },
        title: {
          display: !!xAxisLabel,
          text: xAxisLabel,
          color: '#888',
          font: {
            size: 12,
            weight: 500,
          },
        },
        border: {
          color: '#555',
          width: 1,
        },
      },
      y: {
        stacked,
        type: useLogScale ? ('logarithmic' as const) : ('linear' as const),
        position: 'left' as const,
        grid: {
          display: true,
          color: '#333',
          lineWidth: 0.8,
          drawOnChartArea: true,
          drawTicks: true,
        },
        border: {
          color: '#555',
          width: 1,
        },
        ticks: {
          color: '#888',
          font: {
            size: 11,
            weight: 400,
          },
          padding: 8,
          ...(integerOnly && !useLogScale && {
            stepSize: Math.max(1, Math.ceil(maxValue / 8)), // Intelligent step sizing
            precision: 0,
          }),
          callback: function(tickValue: string | number) {
            const value = typeof tickValue === 'string' ? parseFloat(tickValue) : tickValue;
            
            if (useLogScale) {
              // Professional log scale like DexScreener
              const log10 = Math.log10(value);
              const roundedLog = Math.round(log10);
              
              // Show powers of 10
              if (Math.abs(log10 - roundedLog) < 0.01) {
                if (value >= 1e6) return (value / 1e6).toFixed(0) + 'M';
                if (value >= 1e3) return (value / 1e3).toFixed(0) + 'K';
                if (value < 0.01) return value.toExponential(0);
                return value.toString();
              }
              
              // Show 2 and 5 multiples in each decade
              const normalized = value / Math.pow(10, Math.floor(log10));
              if (Math.abs(normalized - 2) < 0.1 || Math.abs(normalized - 5) < 0.1) {
                if (value >= 1e6) return (value / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
                if (value >= 1e3) return (value / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
                if (value < 1) return value.toFixed(2);
                return Math.round(value).toString();
              }
              
              return ''; // Hide other values
            }
            
            // Linear scale formatting
            if (integerOnly) {
              if (value < 0.5) return '';
              return Math.round(value).toString();
            }
            
            // Standard formatting
            if (value >= 1e9) {
              return (value / 1e9).toFixed(1) + 'B';
            } else if (value >= 1e6) {
              return (value / 1e6).toFixed(1) + 'M';
            } else if (value >= 1e3) {
              return (value / 1e3).toFixed(1) + 'K';
            } else if (value < 1 && value > 0) {
              return value.toFixed(2);
            }
            return Math.round(value).toString();
          },
        },
        title: {
          display: !!yAxisLabel,
          text: yAxisLabel + (useLogScale ? ' (Log Scale)' : ''),
          color: '#888',
          font: {
            size: 12,
            weight: 500,
          },
        },
        beginAtZero: !useLogScale,
        // Professional scaling for better visibility
        ...(integerOnly && !useLogScale && hasValidData && {
          max: Math.ceil(maxValue * 1.1), // 10% headroom for data labels
          grace: '5%', // Chart.js grace period
        }),
        // Logarithmic scale improvements - more like financial charts
        ...(useLogScale && {
          min: hasValidData ? Math.pow(10, Math.floor(Math.log10(minValue))) : 1,
          max: hasValidData ? Math.pow(10, Math.ceil(Math.log10(maxValue))) : 1000,
          // Force major/minor tick structure
          grid: {
            display: true,
            color: function(context: any) {
              const value = context.tick.value;
              const log10 = Math.log10(value);
              // Major grid lines at powers of 10
              if (Math.abs(log10 - Math.round(log10)) < 0.01) {
                return '#555'; // Darker for major lines
              }
              // Minor grid lines at 2 and 5
              const normalized = value / Math.pow(10, Math.floor(log10));
              if (Math.abs(normalized - 2) < 0.1 || Math.abs(normalized - 5) < 0.1) {
                return '#333'; // Lighter for minor lines
              }
              return 'transparent'; // Hide other grid lines
            },
            lineWidth: function(context: any) {
              const value = context.tick.value;
              const log10 = Math.log10(value);
              if (Math.abs(log10 - Math.round(log10)) < 0.01) {
                return 1; // Thicker for powers of 10
              }
              return 0.5; // Thinner for 2 and 5
            },
          },
        }),
      },
    },
  };

  // Add datalabels configuration if needed
  const options: ChartOptions<'bar'> = showDataLabels ? {
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins,
      datalabels: {
        display: function(context: any) {
          // Safely check for value - ONLY display if greater than 0
          const value = context.dataset?.data?.[context.dataIndex];
          return value !== null && value !== undefined && value > 0;
        },
        anchor: 'end' as const,
        align: 'top' as const, // Position above the bar end
        offset: 4, // Space between bar and label
        clip: false, // Ensure labels aren't clipped
        clamp: false, // Allow labels to go outside chart area if needed
        color: '#fff',
        font: {
          size: 10,
          weight: 600,
        },
        formatter: function(value: number, context: any) {
          // Only show if value is greater than 0
          if (value !== null && value !== undefined && value > 0) {
            return Math.round(value).toString();
          }
          return ''; // Return empty string to hide
        },
        backgroundColor: 'rgba(0,0,0,0.8)',
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

  // Create gradient function
  const createGradient = (ctx: CanvasRenderingContext2D, color: string) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    if (color === '#8b5cf6' || color === '#4f46e5') {
      // Purple gradient for TORUS
      gradient.addColorStop(0, '#a855f7');
      gradient.addColorStop(0.5, '#8b5cf6');
      gradient.addColorStop(1, '#6d28d9');
    } else if (color === '#fbbf24' || color === '#f59e0b') {
      // Yellow gradient for TitanX
      gradient.addColorStop(0, '#fcd34d');
      gradient.addColorStop(0.5, '#fbbf24');
      gradient.addColorStop(1, '#f59e0b');
    } else if (color === '#22c55e') {
      // Green gradient
      gradient.addColorStop(0, '#4ade80');
      gradient.addColorStop(0.5, '#22c55e');
      gradient.addColorStop(1, '#16a34a');
    } else {
      // Default gradient
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, color + '99');
    }
    return gradient;
  };

  const data = {
    labels,
    datasets: datasets.map(dataset => ({
      ...dataset,
      backgroundColor: (context: any) => {
        const chart = context.chart;
        const { ctx } = chart;
        if (!ctx) return dataset.backgroundColor || '#4f46e5';
        return createGradient(ctx, dataset.backgroundColor || '#4f46e5');
      },
      borderColor: dataset.borderColor || dataset.backgroundColor || '#4f46e5',
      borderWidth: 1,
      hoverBackgroundColor: dataset.backgroundColor ? 
        `${dataset.backgroundColor}dd` : '#4f46e5dd', // Add transparency on hover
      hoverBorderWidth: 2,
      // Only apply minimum bar length if explicitly requested
      // For count-based charts, we typically don't want minBarLength for zero values
      minBarLength: integerOnly ? 0 : Math.min(minBarHeight, height * 0.02),
    })),
  };

  // Configure plugins array based on whether we need data labels
  const plugins = showDataLabels ? [ChartDataLabels] : [];

  return (
    <div style={{ position: 'relative', background: '#1a1a1a', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
      {shouldShowToggle && (
        <div style={{ 
          position: 'absolute', 
          top: '10px', 
          right: '10px', 
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '4px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0,0,0,0.9)',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            border: '1px solid #444'
          }}>
            <label style={{ 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              color: '#ccc',
              fontWeight: '500'
            }}>
              <input
                type="checkbox"
                checked={useLogScale}
                onChange={(e) => setUseLogScale(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: '#8b5cf6' }}
              />
              Log Scale
            </label>
          </div>
          {valueRatio > 10 && (
            <div style={{ 
              fontSize: '10px', 
              color: '#888', 
              textAlign: 'right',
              maxWidth: '120px',
              lineHeight: '1.2'
            }}>
              {valueRatio > 100 ? 'Recommended for this data' : 'May help with visibility'}
            </div>
          )}
        </div>
      )}
      <div style={{ height: `${height}px` }}>
        <Bar options={options} data={data} plugins={plugins} />
      </div>
      {!shouldShowToggle && valueRatio > 100 && (
        <div style={{ 
          marginTop: '8px', 
          fontSize: '11px', 
          color: '#666', 
          textAlign: 'center',
          fontStyle: 'italic'
        }}>
          Large value differences detected. Log scale may improve visibility.
        </div>
      )}
    </div>
  );
};

export default BarChart;