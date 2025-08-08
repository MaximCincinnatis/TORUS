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
      console.error(`🚨 Day ${day}: Only ${(totalShares/1e6).toFixed(2)}M shares active! This will cause reward spikes!`);
    }
  }
  
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
          console.warn(`⚠️ Invalid reward pool for day ${day}, skipping`);
          continue;
        }
        
        sharePercentage = positionShares / calculatedTotalShares;
        dailyReward = rewardPool * sharePercentage;
        
        // Debug for suspicious days - log the actual calculation
        if (day >= 109 && day <= 117 && dailyReward > 500) {
          console.log(`🚨 HUGE DAILY REWARD on Day ${day} for Position ${positionKey}:`);
          console.log(`   Position Shares: ${positionShares.toFixed(0)}`);
          console.log(`   Total Shares Active: ${calculatedTotalShares.toFixed(0)}`); 
          console.log(`   Share %: ${(sharePercentage * 100).toFixed(4)}%`);
          console.log(`   Daily Reward Pool: ${rewardPool.toFixed(2)} TORUS`);
          console.log(`   Daily Reward Earned: ${dailyReward.toFixed(2)} TORUS`);
          console.log(`   Cumulative So Far: ${cumulativeReward.toFixed(2)} TORUS`);
          if (dailyReward > rewardPool) {
            console.error(`   ERROR: Daily reward exceeds pool!`);
          }
        }
        
        // Sanity check: A position can't get more than the entire daily pool
        if (dailyReward > rewardPool) {
          console.warn(`⚠️ Position trying to claim ${dailyReward.toFixed(2)} from pool of ${rewardPool.toFixed(2)} on day ${day}. Capping at pool size.`);
          dailyReward = rewardPool;
        }
        
        // Ensure daily reward is never negative
        if (dailyReward < 0) {
          console.warn(`⚠️ Negative daily reward detected: ${dailyReward}, setting to 0`);
          dailyReward = 0;
        }
        
        // CRITICAL FIX: Only accumulate rewards from currentProtocolDay forward
        // Rewards before currentProtocolDay are already included in currentSupply
        if (currentProtocolDay && day >= currentProtocolDay) {
          cumulativeReward += dailyReward;
        } else if (!currentProtocolDay) {
          // If no currentProtocolDay provided, accumulate all rewards
          cumulativeReward += dailyReward;
        }
        
        // Alert if cumulative rewards are getting huge
        if (cumulativeReward > 1000000) { // More than 1M TORUS accumulated
          console.error(`Position ${positionKey} has accumulated ${cumulativeReward.toFixed(0)} TORUS by day ${day}`);
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
  // Extend to current protocol day + 88 for proper projection
  const targetDay = Math.max(96, (currentProtocolDay || 0) + 88);
  for (let day = lastDayWithRewards + 1; day <= targetDay; day++) {
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
  
  console.log('🔍 Extended reward pool data from', lastDayWithRewards, 'to', targetDay, 'days');
  console.log('🔍 Last actual reward pool (day', lastDayWithRewards, '):', lastRewardPool.toFixed(2));
  console.log('🔍 Projected reward pool (day', targetDay, '):', currentPool.toFixed(2));
  
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
  
  console.log(`📊 Calculating supply projection from day ${minDay} to ${maxDay}`);
  
  // Start from current protocol day to avoid double counting past positions
  const startDay = currentProtocolDay || minDay;
  
  console.log(`🔍 Processing days ${startDay} to ${maxDay} (starting from current protocol day)`);
  console.log(`🔍 Current supply already includes positions matured before day ${startDay}`);
  
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
      console.log(`
========================================
📊 TOTALSHARES CALCULATION FOR DAY ${day}
========================================
Active Positions: ${activeCount}
Total Shares: ${totalShares.toLocaleString()} (${totalShares.toFixed(0)})
${totalShares < 1000000 ? '🚨 WARNING: SHARES TOO LOW! This will cause hockey stick!' : '✅ Shares look reasonable'}
========================================`);
    }
  }
  
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
      // FIX: Only include positions that mature on or after the current protocol day
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
            console.warn(`
🚨🚨🚨 MASSIVE REWARDS DETECTED 🚨🚨🚨
Day ${day}: Stake ${projection.position.id} maturing
Position Shares: ${shares.toLocaleString()}
Active from day ${startDay} to ${day} (${activeDays} days)
Accumulated Rewards: ${accumulatedRewards.toLocaleString()} TORUS
Average Daily Reward: ${avgDailyReward.toFixed(2)} TORUS/day
Principal: ${principal.toFixed(2)} TORUS
Daily pool is only ~91K TORUS!
`);
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
            console.warn(`
🚨🚨🚨 MASSIVE REWARDS DETECTED 🚨🚨🚨
Day ${day}: Create ${projection.position.id} maturing
Position Shares: ${shares.toLocaleString()}
Active from day ${startDay} to ${day} (${activeDays} days)
Accumulated Rewards: ${accumulatedRewards.toLocaleString()} TORUS
Average Daily Reward: ${avgDailyReward.toFixed(2)} TORUS/day
New Tokens: ${newTokens.toFixed(2)} TORUS
Daily pool is only ~91K TORUS!
`);
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
      console.error(`
🚨 FOUND THE BUG - MASSIVE DAILY RELEASE on Day ${day}:
  Daily stakes: ${dailyFromStakes.toFixed(2)} TORUS (was ${prevCumulativeStakes.toFixed(2)}, now ${cumulativeFromStakes.toFixed(2)})
  Daily creates: ${dailyFromCreates.toFixed(2)} TORUS (was ${prevCumulativeCreates.toFixed(2)}, now ${cumulativeFromCreates.toFixed(2)})
  ${positionProjections.size} total position projections
`);
    }
    
    // Debug logging for days with suspicious values
    if (day >= 110 && day <= 117) {
      const totalSharesForDay = totalSharesByDay.get(day) || 0;
      const totalSupplyForDay = currentSupply + cumulativeFromStakes + cumulativeFromCreates;
      console.log(`
=====================================
🎯 MAX SUPPLY CALCULATION - DAY ${day}
=====================================
Total Shares Active: ${totalSharesForDay.toLocaleString()}
Daily Stakes Maturing: ${dailyFromStakes.toFixed(2)} TORUS
Daily Creates Maturing: ${dailyFromCreates.toFixed(2)} TORUS
Cumulative Stakes: ${cumulativeFromStakes.toFixed(2)} TORUS
Cumulative Creates: ${cumulativeFromCreates.toFixed(2)} TORUS
TOTAL MAX SUPPLY: ${totalSupplyForDay.toLocaleString()} TORUS
${totalSupplyForDay > 1000000 ? '🚨🚨🚨 HOCKEY STICK DETECTED! Supply > 1M TORUS!' : ''}
=====================================`);
    }
    
    // Calculate total max supply as current supply + all accumulated rewards
    let totalMaxSupply = currentSupply + cumulativeFromStakes + cumulativeFromCreates;
    const fromExisting = 0; // Reset this as it was causing the bug
    
    // CRITICAL DEBUG: Check for massive jumps
    if (maxSupplyProjections.length > 0) {
      const prevSupply = maxSupplyProjections[maxSupplyProjections.length - 1].totalMaxSupply;
      const increase = totalMaxSupply - prevSupply;
      if (increase > 10000000) { // More than 10M increase
        console.error(`
🚨🚨🚨 MASSIVE SUPPLY SPIKE DETECTED 🚨🚨🚨
Day ${day}: Supply jumped from ${(prevSupply/1e6).toFixed(2)}M to ${(totalMaxSupply/1e6).toFixed(2)}M
Increase: ${(increase/1e6).toFixed(2)}M TORUS
Daily stakes maturing: ${dailyFromStakes.toFixed(2)}
Daily creates maturing: ${dailyFromCreates.toFixed(2)}
Active positions: ${activePositions}
Total shares: ${(totalSharesByDay.get(day) || 0) / 1e6}M
`);
      }
    }
    
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
      totalShares: totalSharesByDay.get(day) || 0,
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