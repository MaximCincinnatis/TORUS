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
    console.log('🔍 FutureMaxSupplyChart - Input Data:');
    console.log('stakeEvents:', stakeEvents?.length || 0);
    console.log('createEvents:', createEvents?.length || 0);
    console.log('rewardPoolData:', rewardPoolData?.length || 0);
    console.log('currentSupply:', currentSupply, 'TORUS (this should reflect burns)');
    console.log('contractStartDate:', contractStartDate);
    console.log('preCalculatedProjection:', preCalculatedProjection?.length || 0, 'days');
    
    // Force console output to show
    console.log('🚀 FutureMaxSupplyChart component is loading...');
    
    // Check if we have pre-calculated projection data
    if (preCalculatedProjection && preCalculatedProjection.length > 0) {
      console.log('✅ Using pre-calculated projection data');
      // Use pre-calculated data directly
      const projections = preCalculatedProjection;
      
      // Apply same filtering and processing as before
      let filteredProjections = projections.filter(p => p.day >= currentProtocolDay);
      
      console.log(`📊 Pre-calculated: ${projections.length} days total`);
      console.log(`📊 After filtering from day ${currentProtocolDay}: ${filteredProjections.length} days`);
      
      // Continue with same chart data formatting...
      // Skip to line 98 for the rest of the logic
    
    } else if (!stakeEvents?.length || !createEvents?.length || !rewardPoolData?.length) {
      console.log('❌ Missing required data for chart');
      return {
        labels: [],
        datasets: [],
        customTooltipData: []
      };
    } else {
      console.log('📊 Calculating projection from raw data (no pre-calculated data available)');
    }

    try {
      // Only calculate if no pre-calculated data
      let projections;
      if (preCalculatedProjection && preCalculatedProjection.length > 0) {
        projections = preCalculatedProjection;
      } else {
        // Convert events to positions
        const positions = convertToPositions(stakeEvents, createEvents);
        console.log('📊 Converted positions:', positions.length);
        console.log('First position:', positions[0]);
        
        // Calculate max supply projections
        projections = calculateFutureMaxSupply(
          positions,
          rewardPoolData,
          currentSupply,
          contractStartDate
        );
      }
      
      console.log('📈 Projections loaded:', projections.length);
      console.log('First projection:', projections[0]);
      console.log('Last projection:', projections[projections.length - 1]);
      
      // Apply timeframe filtering - only show current day onward
      console.log('🔍 Using currentProtocolDay:', currentProtocolDay);
      
      // Get ALL projections from current day forward, don't limit by days
      // The PannableLineChart will handle windowing with the windowSize prop
      let filteredProjections = projections.filter(p => p.day >= currentProtocolDay);
      
      console.log(`📊 BEFORE filtering: projections has ${projections.length} days`);
      console.log(`📊 BEFORE filtering: First projection day: ${projections[0]?.day}, Last: ${projections[projections.length - 1]?.day}`);
      console.log(`📊 Filtering from day ${currentProtocolDay} forward`);
      console.log(`📊 AFTER filtering: ${filteredProjections.length} days available for panning`);
      console.log(`📊 AFTER filtering: First day shown: ${filteredProjections[0]?.day}, Last: ${filteredProjections[filteredProjections.length - 1]?.day}`);
      
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
      
      console.log('📊 FIRST LABEL:', labels[0]);
      console.log('📊 LAST LABEL:', labels[labels.length - 1]);
      
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