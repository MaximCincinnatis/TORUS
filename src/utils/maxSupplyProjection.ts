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
  protocolDay?: number;
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
  contractStartDate: Date,
  currentProtocolDay?: number
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
  
  // Pre-calculate total shares for each day from actual positions
  // This is used by both position projections and supply calculations
  const totalSharesByDay = new Map<number, number>();
  for (let day = minDay; day <= maxDay; day++) {
    let totalShares = 0;
    const dayDate = new Date(contractStartDate);
    dayDate.setUTCDate(dayDate.getUTCDate() + day - 1);
    
    positions.forEach(position => {
      const positionStart = new Date(parseInt(position.timestamp) * 1000);
      const positionStartDay = Math.floor((positionStart.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      const maturityDate = new Date(position.maturityDate);
      const maturityDay = Math.floor((maturityDate.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      
      // Position is active if it started before or on this day and hasn't matured yet
      // IMPORTANT: Position is active UNTIL maturity day (exclusive - it exits ON maturity day)
      if (day >= positionStartDay && day < maturityDay) {  // Changed <= to < because position exits ON maturity day
        totalShares += parseFloat(position.shares) / 1e18;
      }
    });
    
    totalSharesByDay.set(day, totalShares);
    
    // Debug: Alert if totalShares drops too low
    if (day >= 110 && day <= 117 && totalShares < 10000000) { // Less than 10M shares
    }
  }
  
  positions.forEach(position => {
    // Validate position data
    if (!position || !position.user || !position.id || !position.type) {
      return;
    }
    
    if (!position.shares || isNaN(parseFloat(position.shares))) {
      return;
    }
    
    if (!position.maturityDate) {
      return;
    }
    
    const positionKey = `${position.user}-${position.id}-${position.type}`;
    const maturityDate = new Date(position.maturityDate);
    
    if (isNaN(maturityDate.getTime())) {
      return;
    }
    
    const maturityDay = Math.floor((maturityDate.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    
    // CRITICAL FIX: Convert Wei to human units
    const positionShares = parseFloat(position.shares) / 1e18;
    
    if (positionShares <= 0) {
      return;
    }
    
    const dailyProjections: PositionProjection['dailyProjections'] = [];
    let cumulativeReward = 0;
    
    // Calculate projections for each day in the available data range
    const endDay = Math.min(maturityDay, maxDay);
    for (let day = minDay; day <= endDay; day++) {
      const rewardData = rewardPoolMap.get(day);
      if (!rewardData) {
        continue;
      }
      
      const date = new Date(contractStartDate);
      date.setUTCDate(date.getUTCDate() + day - 1);
      
      // Position is active if it was created before this day and hasn't matured
      const positionStart = new Date(parseInt(position.timestamp) * 1000);
      const positionStartDay = Math.floor((positionStart.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      // Position earns rewards up to but NOT including maturity day
      // On maturity day, the position has already exited and claimed
      const isActive = day >= positionStartDay && day < maturityDay;
      
      let sharePercentage = 0;
      let dailyReward = 0;
      
      // Use calculated totalShares to match App.tsx calculation
      // This ensures consistency between charts
      let calculatedTotalShares = totalSharesByDay.get(day) || 0;
      
      // CRITICAL FIX: Skip reward calculation if no shares are active
      // This prevents division by zero and infinite rewards
      if (isActive && calculatedTotalShares > 0 && day < maturityDay) {
        const rewardPool = parseFloat(rewardData.rewardPool.toString());
        
        // Validate reward pool data
        if (isNaN(rewardPool)) {
          continue;
        }
        
        sharePercentage = positionShares / calculatedTotalShares;
        dailyReward = rewardPool * sharePercentage;
        
        // Debug for suspicious days - log the actual calculation
        if (day >= 109 && day <= 117 && dailyReward > 500) {
          if (dailyReward > rewardPool) {
          }
        }
        
        // Sanity check: A position can't get more than the entire daily pool
        if (dailyReward > rewardPool) {
          dailyReward = rewardPool;
        }
        
        // Ensure daily reward is never negative
        if (dailyReward < 0) {
          dailyReward = 0;
        }
        
        // CRITICAL FIX: Only accumulate rewards from currentProtocolDay forward
        // Rewards before currentProtocolDay are already included in currentSupply
        // Default to day 29 if not provided (that's the actual current protocol day)
        const effectiveCurrentDay = currentProtocolDay || 29;
        if (day >= effectiveCurrentDay) {
          cumulativeReward += dailyReward;
        }
        
        // Alert if cumulative rewards are getting huge
        if (cumulativeReward > 1000000) { // More than 1M TORUS accumulated
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
  
  // DEBUG: Check if we have the complete reward pool data
  const firstFewDays = rewardPoolData.slice(0, 10);
  
  // CRITICAL FIX: Generate missing reward pool data for proper projections
  const extendedRewardPoolData = [...rewardPoolData];
  
  // Find the last day with non-zero rewards (should be day 8)
  const daysWithRewards = rewardPoolData.filter(d => parseFloat(d.rewardPool.toString()) > 0);
  const lastDayWithRewards = daysWithRewards.length > 0 ? Math.max(...daysWithRewards.map(d => d.day)) : 8;
  const lastRewardPool = daysWithRewards.length > 0 
    ? parseFloat(rewardPoolData.find(d => d.day === lastDayWithRewards)?.rewardPool.toString() || '0')
    : 90807.46; // Default day 8 reward pool value
  
  // Generate corrected reward pool data with 0.08% daily reduction for days 9+
  const dailyReductionRate = 0.0008; // 0.08% as decimal
  let currentPool = lastRewardPool;
  
  // Update existing zero entries and add any missing days
  // Extend to current protocol day + 88 for proper projection
  const targetDay = Math.max(96, (currentProtocolDay || 0) + 88);
  
  // FIX: Ensure we have data for the current protocol day
  // Start from day 1 if no data exists, or from lastDayWithRewards + 1
  const startGenDay = rewardPoolData.length === 0 ? 1 : lastDayWithRewards + 1;
  
  // Add initial days with actual rewards if missing
  if (rewardPoolData.length === 0 && startGenDay === 1) {
    const initialRewards = [
      91323.04, 91249.16, 91175.35, 91101.62,
      91027.97, 90954.39, 90880.89, 90807.46
    ];
    for (let day = 1; day <= 8; day++) {
      extendedRewardPoolData.push({
        day,
        rewardPool: initialRewards[day - 1],
        totalShares: '0',
        penaltiesInPool: '0'
      });
    }
  }
  
  for (let day = Math.max(9, startGenDay); day <= targetDay; day++) {
    currentPool = currentPool * (1 - dailyReductionRate);
    
    // Find existing entry for this day
    const existingIndex = extendedRewardPoolData.findIndex(d => d.day === day);
    if (existingIndex >= 0) {
      // Update existing entry with corrected reward pool
      extendedRewardPoolData[existingIndex].rewardPool = currentPool;
      // Don't use the faulty totalShares from the contract - we'll calculate it properly
      extendedRewardPoolData[existingIndex].totalShares = '0'; // Will be recalculated
    } else {
      // Add missing entry
      extendedRewardPoolData.push({
        day,
        rewardPool: currentPool,
        totalShares: '0', // Will be recalculated
        penaltiesInPool: '0'
      });
    }
  }
  
  
  // AUDIT: Check specific key days
  const day88Pool = parseFloat(extendedRewardPoolData.find(d => d.day === 88)?.rewardPool?.toString() || '0');
  
  // Calculate total rewards with extended data
  const totalPossibleRewards = extendedRewardPoolData.reduce((sum, d) => sum + parseFloat(d.rewardPool.toString()), 0);
  
  // Validate input parameters
  if (!positions || positions.length === 0) {
    return [];
  }
  
  if (!extendedRewardPoolData || extendedRewardPoolData.length === 0) {
    return [];
  }
  
  if (currentSupply < 0) {
    currentSupply = 0;
  }
  
  if (!contractStartDate || isNaN(contractStartDate.getTime())) {
    return [];
  }
  
  const positionProjections = calculateSharePoolPercentages(positions, extendedRewardPoolData, contractStartDate, currentProtocolDay);
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
  // FIX: Ensure we start from the current day, not the day after
  const startDay = currentProtocolDay || minDay;
  
  // DEBUG: Check if we have data for the start day
  const startDayData = rewardPoolMap.get(startDay);
  if (!startDayData) {
  } else {
  }
  
  
  // Track cumulative rewards from current day forward only
  let cumulativeFromStakes = 0;
  let cumulativeFromCreates = 0;
  
  // Calculate total shares for each day from actual positions
  // We need this for the debug logging and final output
  const totalSharesByDay = new Map<number, number>();
  for (let day = minDay; day <= maxDay; day++) {
    let totalShares = 0;
    let activeCount = 0;
    positions.forEach(position => {
      const positionStart = new Date(parseInt(position.timestamp) * 1000);
      const positionStartDay = Math.floor((positionStart.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      const maturityDate = new Date(position.maturityDate);
      const maturityDay = Math.floor((maturityDate.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      
      // Position is active if it started before this day and hasn't matured yet
      if (day >= positionStartDay && day < maturityDay) {
        totalShares += parseFloat(position.shares) / 1e18;
        activeCount++;
      }
    });
    totalSharesByDay.set(day, totalShares);
    
    // Log critical days with clear formatting
    if (day >= 110 && day <= 117) {
    }
  }
  
  
  for (let day = startDay; day <= maxDay; day++) {
    // Log first iteration
    if (day === startDay) {
    }
    
    const rewardData = rewardPoolMap.get(day);
    if (!rewardData) {
      if (day === 38) {
      }
      continue;
    }
    
    // DEBUG: Log when processing current protocol day
    if (day === currentProtocolDay) {
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
      // FIX: Only include positions that mature on or after the current protocol day
      // BUT we need to include the current day itself in projections
      if (day === projection.maturityDay && (!currentProtocolDay || projection.maturityDay >= currentProtocolDay)) {
        if (projection.position.type === 'stake') {
          // Stakes: Add principal + all accumulated rewards on maturity day
          const principal = parseFloat(projection.position.principal || '0') / 1e18;
          // Get the LAST projection before maturity (not ON maturity day)
          const lastActiveProjection = projection.dailyProjections.find(p => p.day === day - 1);
          const accumulatedRewards = lastActiveProjection?.cumulativeReward || 0;
          
          // Debug massive rewards - lower threshold to catch issues
          if (accumulatedRewards > 5000) {
            const shares = parseFloat(projection.position.shares || '0') / 1e18;
            const positionStart = new Date(parseInt(projection.position.timestamp) * 1000);
            const startDay = Math.floor((positionStart.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
            const activeDays = day - startDay;
            const avgDailyReward = accumulatedRewards / activeDays;
          }
          
          dailyFromStakes += principal + accumulatedRewards;
        } else if (projection.position.type === 'create') {
          // Creates: Add new tokens + all accumulated rewards on maturity day  
          const newTokens = parseFloat(projection.position.torusAmount || '0') / 1e18;
          // Get the LAST projection before maturity (not ON maturity day)
          const lastActiveProjection = projection.dailyProjections.find(p => p.day === day - 1);
          const accumulatedRewards = lastActiveProjection?.cumulativeReward || 0;
          
          // Debug massive rewards - lower threshold to catch issues
          if (accumulatedRewards > 5000) {
            const shares = parseFloat(projection.position.shares || '0') / 1e18;
            const positionStart = new Date(parseInt(projection.position.timestamp) * 1000);
            const startDay = Math.floor((positionStart.getTime() - contractStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
            const activeDays = day - startDay;
            const avgDailyReward = accumulatedRewards / activeDays;
          }
          
          dailyFromCreates += newTokens + accumulatedRewards;
        }
      }
    });
    
    // Accumulate daily rewards
    const prevCumulativeStakes = cumulativeFromStakes;
    const prevCumulativeCreates = cumulativeFromCreates;
    cumulativeFromStakes += dailyFromStakes;
    cumulativeFromCreates += dailyFromCreates;
    
    // Log if there's a massive jump
    if (dailyFromStakes > 10000000 || dailyFromCreates > 10000000) {
    }
    
    // Debug logging for days with suspicious values
    if (day >= 110 && day <= 117) {
      const totalSharesForDay = totalSharesByDay.get(day) || 0;
      const totalSupplyForDay = currentSupply + cumulativeFromStakes + cumulativeFromCreates;
    }
    
    // Calculate total max supply as current supply + all accumulated rewards
    let totalMaxSupply = currentSupply + cumulativeFromStakes + cumulativeFromCreates;
    const fromExisting = 0; // Reset this as it was causing the bug
    
    // CRITICAL DEBUG: Check for massive jumps
    if (maxSupplyProjections.length > 0) {
      const prevSupply = maxSupplyProjections[maxSupplyProjections.length - 1].totalMaxSupply;
      const increase = totalMaxSupply - prevSupply;
      if (increase > 10000000) { // More than 10M increase
      }
    }
    
    // Validate that total max supply is never negative and never decreases
    if (totalMaxSupply < currentSupply) {
      totalMaxSupply = currentSupply;
      cumulativeFromStakes = Math.max(0, cumulativeFromStakes);
      cumulativeFromCreates = Math.max(0, cumulativeFromCreates);
    }
    
    if (day <= 15 || day === 88) { // Debug first 15 days and day 88
    }
    
    // CRITICAL AUDIT for day 88
    if (day === 88) {
    }
    
    // Debug maturity days
    if (dailyFromStakes > 0 || dailyFromCreates > 0) {
    }
    
    // DEBUG: Log when adding current protocol day to projections
    if (day === currentProtocolDay) {
    }
    
    maxSupplyProjections.push({
      day,
      date: date.toISOString().split('T')[0],
      totalMaxSupply,
      activePositions,
      dailyRewardPool: parseFloat(rewardData.rewardPool.toString()),
      totalShares: totalSharesByDay.get(day) || 0,
      breakdown: {
        fromStakes: cumulativeFromStakes,
        fromCreates: cumulativeFromCreates,
        fromExisting
      }
    });
  }
  
  if (maxSupplyProjections[0]?.day !== currentProtocolDay) {
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
      type: event.type || 'stake'
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
      type: event.type || 'create'
    });
  });
  
  return positions;
}