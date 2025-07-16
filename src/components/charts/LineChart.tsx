import React from 'react';
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

interface LineChartProps {
  title: string;
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
    fill?: boolean;
    tension?: number;
  }[];
  height?: number;
  showLegend?: boolean;
  yAxisLabel?: string;
  xAxisLabel?: string;
  formatTooltip?: (value: number) => string;
  formatYAxis?: (value: number) => string;
}

const LineChart: React.FC<LineChartProps> = ({
  title,
  labels,
  datasets,
  height = 400,
  showLegend = true,
  yAxisLabel,
  xAxisLabel,
  formatTooltip,
  formatYAxis,
}) => {
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    backgroundColor: 'transparent',
    animation: {
      duration: 1500,
      easing: 'easeInOutQuart',
    },
    animations: {
      tension: {
        duration: 1000,
        easing: 'linear',
        from: 1,
        to: 0,
        loop: false
      },
      y: {
        duration: 1200,
        easing: 'easeOutQuart',
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
          color: '#94a3b8',
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 10,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#fff',
        bodyColor: '#94a3b8',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || '';
            const value = formatTooltip ? formatTooltip(context.parsed.y) : context.parsed.y.toLocaleString();
            return `${label}: ${value}`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: !!xAxisLabel,
          text: xAxisLabel,
          color: '#94a3b8',
          font: {
            size: 12,
          },
        },
        grid: {
          display: true,
          color: 'rgba(148, 163, 184, 0.1)',
        },
        ticks: {
          color: '#64748b',
          maxRotation: 45,
          minRotation: 45,
          font: {
            size: 11,
          },
        },
      },
      y: {
        display: true,
        beginAtZero: false,
        grace: '10%',
        title: {
          display: !!yAxisLabel,
          text: yAxisLabel,
          color: '#94a3b8',
          font: {
            size: 12,
          },
        },
        grid: {
          display: true,
          color: 'rgba(148, 163, 184, 0.1)',
        },
        ticks: {
          color: '#64748b',
          font: {
            size: 11,
          },
          callback: function(value) {
            if (formatYAxis) {
              return formatYAxis(value as number);
            }
            return value.toLocaleString();
          },
        },
      },
    },
  };

  const data = {
    labels,
    datasets: datasets.map(dataset => ({
      ...dataset,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointBackgroundColor: dataset.borderColor,
      pointBorderColor: '#1e293b',
      pointBorderWidth: 2,
      tension: dataset.tension || 0.4,
    })),
  };

  return (
    <div style={{ height: `${height}px`, position: 'relative' }}>
      <Line options={options} data={data} />
    </div>
  );
};

export default LineChart;