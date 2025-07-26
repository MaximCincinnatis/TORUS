/**
 * Future TORUS Max Supply Projection Calculator
 * 
 * This calculates the maximum possible TORUS supply by projecting each position's
 * share of the daily reward pools until their maturity dates, accounting for
 * dilution from new positions over time.
 */

export interface Position {
  user: string;
  id: string;
  shares: string;
  principal?: string;
  torusAmount?: string;
  maturityDate: string;
  stakingDays: number;
  timestamp: string;
  blockNumber: number;
  type: 'stake' | 'create';
}

export interface RewardPoolData {
  day: number;
  rewardPool: string | number;
  totalShares: string | number;
  penaltiesInPool: string | number;
}

export interface MaxSupplyProjection {
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
}

export interface PositionProjection {
  position: Position;
  dailyProjections: {
    day: number;
    date: string;
    sharePercentage: number;
    dailyReward: number;
    cumulativeReward: number;
    isActive: boolean;
  }[];
  totalProjectedReward: number;
  maturityDay: number;
}

/**
 * Calculate share pool percentages for each position on each day
 */
export function calculateSharePoolPercentages(
  positions: Position[],
  rewardPoolData: RewardPoolData[],
  contractStartDate: Date
): Map<string, PositionProjection> {
  const positionProjections = new Map<string, PositionProjection>();
  
  // Create a map of day -> reward pool data for quick lookup
  const rewardPoolMap = new Map<number, RewardPoolData>();
  rewardPoolData.forEach(data => {
    rewardPoolMap.set(data.day, data);
  });
  
  // Get the actual day range from reward pool data
  const minDay = Math.min(...rewardPoolData.map(data => data.day));
  const maxDay = Math.max(...rewardPoolData.map(data => data.day));
  
  positions.forEach(position => {
    // Validate position data
    if (!position || !position.user || !position.id || !position.type) {
      console.warn('⚠️ Invalid position data, skipping:', position);
      return;
    }
    
    if (!position.shares || isNaN(parseFloat(position.shares))) {
      console.warn('⚠️ Invalid shares in position, skipping:', position);
      return;
    }
    
    if (!position.maturityDate) {
      console.warn('⚠️ Missing maturity date in position, skipping:', position);
      return;
    }
    
    const positionKey = `${position.user}-${position.id}-${position.type}`;
    const maturityDate = new Date(position.maturityDate);
    
    if (isNaN(maturityDate.getTime())) {
      console.warn('⚠️ Invalid maturity date in position, skipping:', position);
      return;
    }
    
    const maturityDay = Math.floor((maturityDate.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    
    // CRITICAL FIX: Convert Wei to human units
    const positionShares = parseFloat(position.shares) / 1e18;
    
    if (positionShares <= 0) {
      console.warn('⚠️ Position has zero or negative shares, skipping:', position);
      return;
    }
    
    const dailyProjections: PositionProjection['dailyProjections'] = [];
    let cumulativeReward = 0;
    
    // Calculate projections for each day in the available data range
    const endDay = Math.min(maturityDay, maxDay);
    for (let day = minDay; day <= endDay; day++) {
      const rewardData = rewardPoolMap.get(day);
      if (!rewardData) {
        console.warn(`⚠️ No reward data for day ${day} in position calculation`);
        continue;
      }
      
      const date = new Date(contractStartDate);
      date.setUTCDate(date.getUTCDate() + day - 1);
      
      // Position is active if it was created before this day and hasn't matured
      const positionStart = new Date(parseInt(position.timestamp) * 1000);
      const positionStartDay = Math.floor((positionStart.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      const isActive = day >= positionStartDay && day <= maturityDay;
      
      let sharePercentage = 0;
      let dailyReward = 0;
      
      if (isActive && parseFloat(rewardData.totalShares.toString()) > 0) {
        const totalShares = parseFloat(rewardData.totalShares.toString());
        const rewardPool = parseFloat(rewardData.rewardPool.toString());
        
        // Validate reward pool data
        if (isNaN(totalShares) || isNaN(rewardPool)) {
          console.warn(`⚠️ Invalid reward data for day ${day}, skipping`);
          continue;
        }
        
        sharePercentage = positionShares / totalShares;
        dailyReward = rewardPool * sharePercentage;
        
        // Ensure daily reward is never negative
        if (dailyReward < 0) {
          console.warn(`⚠️ Negative daily reward detected: ${dailyReward}, setting to 0`);
          dailyReward = 0;
        }
        
        cumulativeReward += dailyReward;
        
        // Ensure cumulative reward never goes negative
        if (cumulativeReward < 0) {
          console.warn(`⚠️ Negative cumulative reward detected: ${cumulativeReward}, resetting to 0`);
          cumulativeReward = 0;
        }
      }
      
      dailyProjections.push({
        day,
        date: date.toISOString().split('T')[0],
        sharePercentage,
        dailyReward,
        cumulativeReward,
        isActive
      });
    }
    
    positionProjections.set(positionKey, {
      position,
      dailyProjections,
      totalProjectedReward: cumulativeReward,
      maturityDay
    });
  });
  
  return positionProjections;
}

/**
 * Calculate future TORUS accrual for all positions
 */
export function calculateFutureMaxSupply(
  positions: Position[],
  rewardPoolData: RewardPoolData[],
  currentSupply: number,
  contractStartDate: Date,
  currentProtocolDay?: number
): MaxSupplyProjection[] {
  console.log('🔍 calculateFutureMaxSupply called with:');
  console.log('positions:', positions.length);
  console.log('rewardPoolData:', rewardPoolData.length);
  console.log('currentSupply:', currentSupply);
  console.log('contractStartDate:', contractStartDate);
  
  // DEBUG: Check if we have the complete reward pool data
  const firstFewDays = rewardPoolData.slice(0, 10);
  console.log('🔍 First 10 days of reward pool data:', firstFewDays.map(d => ({ day: d.day, rewardPool: d.rewardPool })));
  
  // CRITICAL FIX: Generate missing reward pool data for proper projections
  const extendedRewardPoolData = [...rewardPoolData];
  
  // Find the last day with non-zero rewards (should be day 8)
  const daysWithRewards = rewardPoolData.filter(d => parseFloat(d.rewardPool.toString()) > 0);
  const lastDayWithRewards = Math.max(...daysWithRewards.map(d => d.day));
  const lastRewardPool = parseFloat(rewardPoolData.find(d => d.day === lastDayWithRewards)?.rewardPool.toString() || '0');
  
  // Generate corrected reward pool data with 0.08% daily reduction for days 9+
  const dailyReductionRate = 0.0008; // 0.08% as decimal
  let currentPool = lastRewardPool;
  
  // Update existing zero entries and add any missing days
  for (let day = lastDayWithRewards + 1; day <= 96; day++) {
    currentPool = currentPool * (1 - dailyReductionRate);
    
    // Find existing entry for this day
    const existingIndex = extendedRewardPoolData.findIndex(d => d.day === day);
    if (existingIndex >= 0) {
      // Update existing entry
      extendedRewardPoolData[existingIndex].rewardPool = currentPool;
    } else {
      // Add missing entry
      extendedRewardPoolData.push({
        day,
        rewardPool: currentPool,
        totalShares: '0',
        penaltiesInPool: '0'
      });
    }
  }
  
  console.log('🔍 Extended reward pool data from', lastDayWithRewards, 'to 96 days');
  console.log('🔍 Last actual reward pool (day', lastDayWithRewards, '):', lastRewardPool.toFixed(2));
  console.log('🔍 Projected reward pool (day 96):', currentPool.toFixed(2));
  
  // AUDIT: Check specific key days
  const day88Pool = parseFloat(extendedRewardPoolData.find(d => d.day === 88)?.rewardPool?.toString() || '0');
  console.log('🎯 AUDIT: Day 88 reward pool:', day88Pool.toFixed(2));
  
  // Calculate total rewards with extended data
  const totalPossibleRewards = extendedRewardPoolData.reduce((sum, d) => sum + parseFloat(d.rewardPool.toString()), 0);
  console.log('🔍 Total possible rewards (with projections):', totalPossibleRewards.toFixed(2));
  console.log('🔍 Current supply + all rewards would be:', (currentSupply + totalPossibleRewards).toFixed(2));
  
  // Validate input parameters
  if (!positions || positions.length === 0) {
    console.warn('⚠️ No positions provided, returning empty projections');
    return [];
  }
  
  if (!extendedRewardPoolData || extendedRewardPoolData.length === 0) {
    console.warn('⚠️ No reward pool data provided, returning empty projections');
    return [];
  }
  
  if (currentSupply < 0) {
    console.warn('⚠️ Current supply is negative, using 0');
    currentSupply = 0;
  }
  
  if (!contractStartDate || isNaN(contractStartDate.getTime())) {
    console.error('❌ Invalid contract start date provided');
    return [];
  }
  
  const positionProjections = calculateSharePoolPercentages(positions, extendedRewardPoolData, contractStartDate);
  const maxSupplyProjections: MaxSupplyProjection[] = [];
  
  // Create a map of day -> reward pool data for quick lookup
  const rewardPoolMap = new Map<number, RewardPoolData>();
  extendedRewardPoolData.forEach(data => {
    rewardPoolMap.set(data.day, data);
  });
  
  // Calculate max supply for each day
  const minDay = Math.min(...extendedRewardPoolData.map(data => data.day));
  const maxDay = Math.max(...extendedRewardPoolData.map(data => data.day));
  
  // Start from current protocol day to avoid double counting past positions
  const startDay = currentProtocolDay || minDay;
  
  console.log(`🔍 Processing days ${startDay} to ${maxDay} (starting from current protocol day)`);
  console.log(`🔍 Current supply already includes positions matured before day ${startDay}`);
  
  // Track cumulative rewards from current day forward only
  let cumulativeFromStakes = 0;
  let cumulativeFromCreates = 0;
  
  for (let day = startDay; day <= maxDay; day++) {
    const rewardData = rewardPoolMap.get(day);
    if (!rewardData) {
      console.warn(`⚠️ No reward data for day ${day}, skipping`);
      continue;
    }
    
    const date = new Date(contractStartDate);
    date.setUTCDate(date.getUTCDate() + day - 1);
    
    let activePositions = 0;
    let dailyFromStakes = 0;
    let dailyFromCreates = 0;
    
    // CORRECT LOGIC: Supply only added on maturity days when positions are claimed
    positionProjections.forEach(projection => {
      const dayProjection = projection.dailyProjections.find(p => p.day === day);
      if (dayProjection?.isActive) {
        activePositions++;
      }
      
      // Only add supply on maturity day when position can be claimed
      if (day === projection.maturityDay) {
        if (projection.position.type === 'stake') {
          // Stakes: Add principal + all accumulated rewards on maturity day
          const principal = parseFloat(projection.position.principal || '0') / 1e18;
          const accumulatedRewards = dayProjection?.cumulativeReward || 0;
          dailyFromStakes += principal + accumulatedRewards;
        } else if (projection.position.type === 'create') {
          // Creates: Add new tokens + all accumulated rewards on maturity day  
          const newTokens = parseFloat(projection.position.torusAmount || '0') / 1e18;
          const accumulatedRewards = dayProjection?.cumulativeReward || 0;
          dailyFromCreates += newTokens + accumulatedRewards;
        }
      }
    });
    
    // Accumulate daily rewards
    cumulativeFromStakes += dailyFromStakes;
    cumulativeFromCreates += dailyFromCreates;
    
    // Calculate total max supply as current supply + all accumulated rewards
    let totalMaxSupply = currentSupply + cumulativeFromStakes + cumulativeFromCreates;
    const fromExisting = 0; // Reset this as it was causing the bug
    
    // Validate that total max supply is never negative and never decreases
    if (totalMaxSupply < currentSupply) {
      console.warn(`⚠️ Max supply ${totalMaxSupply} less than current supply ${currentSupply}, using current supply`);
      totalMaxSupply = currentSupply;
      cumulativeFromStakes = Math.max(0, cumulativeFromStakes);
      cumulativeFromCreates = Math.max(0, cumulativeFromCreates);
    }
    
    if (day <= 15 || day === 88) { // Debug first 15 days and day 88
      console.log(`Day ${day}: totalMaxSupply=${totalMaxSupply.toFixed(2)} (current=${currentSupply} + stakes=${cumulativeFromStakes.toFixed(2)} + creates=${cumulativeFromCreates.toFixed(2)})`);
      console.log(`  Daily: stakes=${dailyFromStakes.toFixed(2)}, creates=${dailyFromCreates.toFixed(2)}, RewardPool: ${parseFloat(rewardData.rewardPool.toString()).toFixed(2)}, ActivePositions: ${activePositions}`);
    }
    
    // CRITICAL AUDIT for day 88
    if (day === 88) {
      console.log('🎯 CRITICAL AUDIT - Day 88 Results:');
      console.log(`  Max Supply: ${totalMaxSupply.toFixed(2)} TORUS`);
      console.log(`  Target: ~8,800,000 TORUS`);
      console.log(`  Match: ${totalMaxSupply >= 8000000 ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`  Breakdown: current=${currentSupply} + stakes=${cumulativeFromStakes.toFixed(2)} + creates=${cumulativeFromCreates.toFixed(2)}`);
    }
    
    // Debug maturity days
    if (dailyFromStakes > 0 || dailyFromCreates > 0) {
      console.log(`📅 MATURITY DAY ${day}: Stakes=${dailyFromStakes.toFixed(2)} Creates=${dailyFromCreates.toFixed(2)}`);
    }
    
    maxSupplyProjections.push({
      day,
      date: date.toISOString().split('T')[0],
      totalMaxSupply,
      activePositions,
      dailyRewardPool: parseFloat(rewardData.rewardPool.toString()),
      totalShares: parseFloat(rewardData.totalShares.toString()),
      breakdown: {
        fromStakes: cumulativeFromStakes,
        fromCreates: cumulativeFromCreates,
        fromExisting
      }
    });
  }
  
  return maxSupplyProjections;
}

/**
 * Simulate dilution effect when new positions are added
 */
export function simulateDilutionEffect(
  existingPositions: Position[],
  newPositions: Position[],
  rewardPoolData: RewardPoolData[],
  contractStartDate: Date
): {
  beforeDilution: MaxSupplyProjection[];
  afterDilution: MaxSupplyProjection[];
  dilutionImpact: {
    day: number;
    date: string;
    supplyBefore: number;
    supplyAfter: number;
    dilutionAmount: number;
    dilutionPercentage: number;
  }[];
} {
  // Calculate projections before new positions
  const beforeDilution = calculateFutureMaxSupply(
    existingPositions,
    rewardPoolData,
    0, // Using 0 for comparison
    contractStartDate,
    1 // Start from day 1 for dilution analysis
  );
  
  // Calculate projections after new positions are added
  const allPositions = [...existingPositions, ...newPositions];
  const afterDilution = calculateFutureMaxSupply(
    allPositions,
    rewardPoolData,
    0, // Using 0 for comparison
    contractStartDate,
    1 // Start from day 1 for dilution analysis
  );
  
  // Calculate dilution impact
  const dilutionImpact = beforeDilution.map((before, index) => {
    const after = afterDilution[index];
    const dilutionAmount = before.totalMaxSupply - after.totalMaxSupply;
    const dilutionPercentage = before.totalMaxSupply > 0 ? (dilutionAmount / before.totalMaxSupply) * 100 : 0;
    
    return {
      day: before.day,
      date: before.date,
      supplyBefore: before.totalMaxSupply,
      supplyAfter: after.totalMaxSupply,
      dilutionAmount,
      dilutionPercentage
    };
  });
  
  return {
    beforeDilution,
    afterDilution,
    dilutionImpact
  };
}

/**
 * Convert raw stake/create events to Position objects
 */
export function convertToPositions(
  stakeEvents: any[],
  createEvents: any[]
): Position[] {
  const positions: Position[] = [];
  
  // Convert stake events
  stakeEvents.forEach(event => {
    positions.push({
      user: event.user,
      id: event.id,
      shares: event.shares,
      principal: event.principal,
      maturityDate: event.maturityDate,
      stakingDays: event.stakingDays,
      timestamp: event.timestamp,
      blockNumber: event.blockNumber,
      type: 'stake'
    });
  });
  
  // Convert create events
  createEvents.forEach(event => {
    positions.push({
      user: event.user,
      id: event.id,
      shares: event.shares,
      torusAmount: event.torusAmount,
      maturityDate: event.maturityDate,
      stakingDays: event.stakingDays,
      timestamp: event.timestamp,
      blockNumber: event.blockNumber,
      type: 'create'
    });
  });
  
  return positions;
}