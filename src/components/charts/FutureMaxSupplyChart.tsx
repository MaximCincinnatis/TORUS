import React, { useMemo } from 'react';
import LineChart from './LineChart';
import {
  calculateFutureMaxSupply,
  convertToPositions,
  RewardPoolData
} from '../../utils/maxSupplyProjection';

interface FutureMaxSupplyChartProps {
  stakeEvents: any[];
  createEvents: any[];
  rewardPoolData: RewardPoolData[];
  currentSupply: number;
  contractStartDate: Date;
}

const FutureMaxSupplyChart: React.FC<FutureMaxSupplyChartProps> = ({
  stakeEvents,
  createEvents,
  rewardPoolData,
  currentSupply,
  contractStartDate
}) => {
  const chartData = useMemo(() => {
    console.log('🔍 FutureMaxSupplyChart - Input Data:');
    console.log('stakeEvents:', stakeEvents?.length || 0);
    console.log('createEvents:', createEvents?.length || 0);
    console.log('rewardPoolData:', rewardPoolData?.length || 0);
    console.log('currentSupply:', currentSupply);
    console.log('contractStartDate:', contractStartDate);
    
    if (!stakeEvents?.length || !createEvents?.length || !rewardPoolData?.length) {
      console.log('❌ Missing required data for chart');
      return {
        labels: [],
        datasets: [],
        customTooltipData: []
      };
    }

    try {
      // Convert events to positions
      const positions = convertToPositions(stakeEvents, createEvents);
      console.log('📊 Converted positions:', positions.length);
      console.log('First position:', positions[0]);
      
      // Calculate max supply projections
      const projections = calculateFutureMaxSupply(
        positions,
        rewardPoolData,
        currentSupply,
        contractStartDate
      );
      
      console.log('📈 Projections calculated:', projections.length);
      console.log('First projection:', projections[0]);
      console.log('Last projection:', projections[projections.length - 1]);
      
      // Format data for Chart.js
      const labels = projections.map(projection => 
        `Day ${projection.day} (${new Date(projection.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })})`
      );
      
      const datasets = [
        {
          label: 'Current Supply',
          data: projections.map(() => Math.round(currentSupply)),
          borderColor: '#6B7280',
          backgroundColor: 'rgba(107, 114, 128, 0.1)',
          borderDash: [5, 5],
          fill: false,
        },
        {
          label: 'Max Supply',
          data: projections.map(p => Math.round(p.totalMaxSupply)),
          borderColor: '#FBBF24',
          backgroundColor: 'rgba(251, 191, 36, 0.1)',
          fill: false,
        },
        {
          label: 'From Stakes',
          data: projections.map(p => Math.round(p.breakdown.fromStakes)),
          borderColor: '#22C55E',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: false,
        },
        {
          label: 'From Creates',
          data: projections.map(p => Math.round(p.breakdown.fromCreates)),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: false,
        }
      ];
      
      const customTooltipData = projections.map(projection => ({
        day: projection.day,
        date: projection.date,
        totalMaxSupply: Math.round(projection.totalMaxSupply),
        fromStakes: Math.round(projection.breakdown.fromStakes),
        fromCreates: Math.round(projection.breakdown.fromCreates),
        currentSupply: Math.round(currentSupply),
        activePositions: projection.activePositions,
        dailyRewardPool: Math.round(projection.dailyRewardPool),
        totalShares: Math.round(projection.totalShares)
      }));
      
      console.log('📊 Chart Data Generated:');
      console.log('Labels:', labels.slice(0, 5), '...');
      console.log('Max Supply dataset:', datasets[1]?.data?.slice(0, 5), '...');
      console.log('Min/Max values:', {
        min: Math.min(...(datasets[1]?.data || [])),
        max: Math.max(...(datasets[1]?.data || []))
      });
      
      return {
        labels,
        datasets,
        customTooltipData
      };
    } catch (error) {
      console.error('Error calculating max supply projections:', error);
      return {
        labels: [],
        datasets: [],
        customTooltipData: []
      };
    }
  }, [stakeEvents, createEvents, rewardPoolData, currentSupply, contractStartDate]);

  if (!chartData.labels.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <div className="text-lg font-medium mb-2">No Data Available</div>
          <div className="text-sm">Max supply projections will appear when data is loaded</div>
        </div>
      </div>
    );
  }

  return (
    <LineChart
      title="Future TORUS Max Supply Projection"
      labels={chartData.labels}
      datasets={chartData.datasets}
      height={400}
      yAxisLabel="TORUS Supply"
      xAxisLabel="Protocol Day"
      customTooltipData={chartData.customTooltipData}
      customTooltipCallback={(context: any, data: any) => {
        const lines = [];
        lines.push(`Protocol Day: ${data.day}`);
        lines.push(`Date: ${data.date}`);
        lines.push(`Max Supply: ${data.totalMaxSupply.toLocaleString()} TORUS`);
        lines.push(`From Stakes: ${data.fromStakes.toLocaleString()} TORUS`);
        lines.push(`From Creates: ${data.fromCreates.toLocaleString()} TORUS`);
        lines.push(`Current Supply: ${data.currentSupply.toLocaleString()} TORUS`);
        lines.push(`Active Positions: ${data.activePositions}`);
        lines.push(`Daily Reward Pool: ${data.dailyRewardPool.toLocaleString()} TORUS`);
        lines.push(`Total Shares: ${data.totalShares.toLocaleString()}`);
        return lines;
      }}
      formatYAxis={(value: number) => {
        if (value >= 1000000) return `${(value/1000000).toFixed(1)}M`;
        if (value >= 1000) return `${(value/1000).toFixed(1)}K`;
        return value.toLocaleString();
      }}
    />
  );
};

export default FutureMaxSupplyChart;