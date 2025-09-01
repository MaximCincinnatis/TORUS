import React, { useMemo } from 'react';
import LineChart from './LineChart';
import PannableLineChart from './PannableLineChart';
import {
  calculateFutureMaxSupply,
  convertToPositions,
  RewardPoolData
} from '../../utils/maxSupplyProjection';
import { getLatestSnapshotBeforeDay } from '../../utils/historicalSupplyTracker';

interface FutureMaxSupplyChartProps {
  stakeEvents: any[];
  createEvents: any[];
  rewardPoolData: RewardPoolData[];
  currentSupply: number;
  contractStartDate: Date;
  currentProtocolDay: number;
  days?: number;
  preCalculatedProjection?: Array<{
    day: number;
    date: string;
    totalMaxSupply: number;
    activePositions: number;
    dailyRewardPool: number;
    totalShares: number;
    breakdown: {
      fromStakes: number;
      fromCreates: number;
      fromExisting: number;
    };
  }>;
}

const FutureMaxSupplyChart: React.FC<FutureMaxSupplyChartProps> = ({
  stakeEvents,
  createEvents,
  rewardPoolData,
  currentSupply,
  contractStartDate,
  currentProtocolDay,
  days = 88,
  preCalculatedProjection
}) => {
  
  const chartData = useMemo(() => {
    
    // DEBUG: Check if rewardPoolData is the issue
    if (rewardPoolData?.length === 0) {
    }
    
    // Force console output to show
    
    // Check if we have pre-calculated projection data
    if (preCalculatedProjection && preCalculatedProjection.length > 0) {
      // Use pre-calculated data directly
      const projections = preCalculatedProjection;
      
      // Apply same filtering and processing as before
      let filteredProjections = projections.filter(p => p.day >= currentProtocolDay);
      
      
      // Continue with same chart data formatting...
      // Skip to line 98 for the rest of the logic
    
    } else if (!stakeEvents?.length || !createEvents?.length || !rewardPoolData?.length) {
      return {
        labels: [],
        datasets: [],
        customTooltipData: []
      };
    } else {
    }

    try {
      // Only calculate if no pre-calculated data
      let projections;
      if (preCalculatedProjection && preCalculatedProjection.length > 0) {
        projections = preCalculatedProjection;
      } else {
        // Convert events to positions
        const positions = convertToPositions(stakeEvents, createEvents);
        
        // Calculate max supply projections (starting from current protocol day)
        projections = calculateFutureMaxSupply(
          positions,
          rewardPoolData,
          currentSupply,
          contractStartDate,
          currentProtocolDay
        );
      }
      
      
      // DEBUG: Check if day 38 exists in projections
      const day38 = projections.find(p => p.day === 38);
      if (day38) {
      } else {
      }
      
      // Apply timeframe filtering - only show current day onward
      
      // Get ALL projections from current day forward, don't limit by days
      // The PannableLineChart will handle windowing with the windowSize prop
      let filteredProjections = projections.filter(p => p.day >= currentProtocolDay);
      
      
      // For past days, use historical supply data
      const adjustedProjections = filteredProjections.map(projection => {
        if (projection.day <= currentProtocolDay) {
          // For past days, try to get historical snapshot
          const historicalSnapshot = getLatestSnapshotBeforeDay(projection.day);
          if (historicalSnapshot) {
            return {
              ...projection,
              totalMaxSupply: historicalSnapshot.totalSupply
            };
          }
        }
        return projection;
      });
      
      // Format data for Chart.js using adjusted projections
      const labels = adjustedProjections.map(projection => 
        `Day ${projection.day} (${new Date(projection.date + 'T00:00:00Z').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC'
        })})`
      );
      
      
      const datasets = [
        {
          label: 'Max Supply',
          data: adjustedProjections.map(p => Math.round(p.totalMaxSupply)),
          borderColor: '#FBBF24',
          backgroundColor: 'rgba(251, 191, 36, 0.1)',
          fill: false,
        },
        {
          label: 'From Stakes',
          data: adjustedProjections.map(p => Math.round(p.breakdown.fromStakes)),
          borderColor: '#EC4899',
          backgroundColor: 'rgba(236, 72, 153, 0.1)',
          fill: false,
        },
        {
          label: 'From Creates',
          data: adjustedProjections.map(p => Math.round(p.breakdown.fromCreates)),
          borderColor: '#8B5CF6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          fill: false,
        },
        {
          label: 'Current Supply',
          data: adjustedProjections.map(() => Math.round(currentSupply)),
          borderColor: '#6B7280',
          backgroundColor: 'rgba(107, 114, 128, 0.1)',
          borderDash: [5, 5],
          fill: false,
        }
      ];
      
      const customTooltipData = adjustedProjections.map(projection => ({
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
      
      
      return {
        labels,
        datasets,
        customTooltipData
      };
    } catch (error) {
      return {
        labels: [],
        datasets: [],
        customTooltipData: []
      };
    }
  }, [stakeEvents, createEvents, rewardPoolData, currentSupply, contractStartDate, currentProtocolDay, days, preCalculatedProjection]);

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
    <PannableLineChart
        title="Accrued Future Supply Projection"
        labels={chartData.labels}
        datasets={chartData.datasets}
        height={600}
        yAxisLabel="TORUS Supply"
        xAxisLabel="Protocol Day"
        customTooltipData={chartData.customTooltipData}
        unifiedTooltip={true}
        formatYAxis={(value: number) => {
        if (value >= 1000000) return `${(value/1000000).toFixed(1)}M`;
        if (value >= 1000) return `${(value/1000).toFixed(1)}K`;
        return value.toLocaleString();
      }}
      windowSize={days}
    />
  );
};

export default FutureMaxSupplyChart;