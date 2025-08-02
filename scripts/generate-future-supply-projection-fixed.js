const fs = require('fs');

// Helper function to convert stake and create events to positions
function convertToPositions(stakeEvents, createEvents) {
  const positions = [];
  
  // Convert stake events
  stakeEvents.forEach(stake => {
    const maturityDate = stake.maturityDate ? new Date(stake.maturityDate) : null;
    const endTime = stake.endTime ? parseInt(stake.endTime) : null;
    
    // Calculate maturity day from maturityDate or endTime
    let maturityDay;
    if (maturityDate) {
      const CONTRACT_START = new Date('2025-07-10T15:00:00Z');
      maturityDay = Math.floor((maturityDate - CONTRACT_START) / (24 * 60 * 60 * 1000)) + 1;
    } else if (endTime) {
      const CONTRACT_START = new Date('2025-07-10T15:00:00Z');
      maturityDay = Math.floor((new Date(endTime * 1000) - CONTRACT_START) / (24 * 60 * 60 * 1000)) + 1;
    } else {
      maturityDay = parseInt(stake.protocolDay) + parseInt(stake.stakingDays || 0) - 1;
    }
    
    positions.push({
      type: 'stake',
      id: stake.stakeIndex || stake.id,
      principal: stake.principal,
      shares: stake.shares,
      startDay: parseInt(stake.protocolDay),
      stakingDays: parseInt(stake.stakingDays || 0),
      maturityDay: maturityDay,
      user: stake.user,
      timestamp: stake.timestamp,
      blockNumber: stake.blockNumber
    });
  });
  
  // Convert create events
  createEvents.forEach(create => {
    const endTime = parseInt(create.endTime);
    const CONTRACT_START = new Date('2025-07-10T15:00:00Z');
    const maturityDay = Math.floor((new Date(endTime * 1000) - CONTRACT_START) / (24 * 60 * 60 * 1000)) + 1;
    
    // Calculate create days from endTime and startTime
    const startTime = parseInt(create.timestamp);
    const createDays = Math.ceil((endTime - startTime) / (24 * 60 * 60));
    
    positions.push({
      type: 'create',
      id: create.stakeIndex || create.id,
      torusAmount: create.torusAmount,
      shares: create.shares,
      startDay: parseInt(create.protocolDay),
      stakingDays: createDays,
      maturityDay: maturityDay,
      user: create.user,
      timestamp: create.timestamp,
      blockNumber: create.blockNumber
    });
  });
  
  return positions;
}

// Calculate position projections with daily rewards
function calculatePositionProjections(positions, rewardPoolData, contractStartDate) {
  const projections = [];
  const rewardPoolMap = new Map();
  
  // Create reward pool lookup
  rewardPoolData.forEach(data => {
    rewardPoolMap.set(data.day, data);
  });
  
  positions.forEach(position => {
    const dailyProjections = [];
    let cumulativeReward = 0;
    
    // Calculate daily projections for this position
    for (let day = position.startDay; day <= position.maturityDay; day++) {
      const rewardData = rewardPoolMap.get(day);
      if (!rewardData || !rewardData.totalShares || rewardData.totalShares === 0) {
        dailyProjections.push({
          day,
          isActive: true,
          dailyReward: 0,
          cumulativeReward,
          sharePercentage: 0
        });
        continue;
      }
      
      const sharePercentage = parseFloat(position.shares) / parseFloat(rewardData.totalShares);
      const dailyReward = sharePercentage * parseFloat(rewardData.rewardPool) / 1e18; // Convert from Wei
      cumulativeReward += dailyReward;
      
      dailyProjections.push({
        day,
        isActive: true,
        dailyReward,
        cumulativeReward,
        sharePercentage
      });
    }
    
    projections.push({
      position,
      maturityDay: position.maturityDay,
      totalRewards: cumulativeReward,
      dailyProjections
    });
  });
  
  return projections;
}

// Generate extended reward pool data for future days
function generateExtendedRewardPoolData(existingData, targetDay) {
  const extended = [...existingData];
  const lastActualDay = Math.max(...existingData.map(d => d.day));
  
  // Generate projections for days 9-96 if needed
  for (let day = lastActualDay + 1; day <= targetDay; day++) {
    if (day >= 9 && day <= 96) {
      const prevDay = extended.find(d => d.day === day - 1);
      if (prevDay) {
        extended.push({
          day,
          rewardPool: prevDay.rewardPool * 0.9992, // 0.08% daily reduction
          totalShares: prevDay.totalShares,
          calculated: true
        });
      }
    }
  }
  
  return extended;
}

// Fixed calculation function
function calculateFutureMaxSupply(positions, rewardPoolData, currentSupply, contractStartDate) {
  const CONTRACT_START = new Date('2025-07-10T15:00:00Z');
  const today = new Date();
  const currentProtocolDay = Math.floor((today - CONTRACT_START) / (24 * 60 * 60 * 1000)) + 1;
  
  console.log(`🔄 Calculating future max supply starting from day ${currentProtocolDay}`);
  
  // Calculate position projections
  const positionProjections = calculatePositionProjections(positions, rewardPoolData, contractStartDate);
  
  // Find the range of days we need to project
  const maxMaturityDay = Math.max(...positionProjections.map(p => p.maturityDay));
  const extendedRewardPoolData = generateExtendedRewardPoolData(rewardPoolData, maxMaturityDay);
  
  // Create reward pool lookup
  const rewardPoolMap = new Map();
  extendedRewardPoolData.forEach(data => {
    rewardPoolMap.set(data.day, data);
  });
  
  // Calculate max supply projections
  const maxSupplyProjections = [];
  const minDay = Math.min(...extendedRewardPoolData.map(data => data.day));
  const maxDay = Math.max(...extendedRewardPoolData.map(data => data.day));
  
  // Start from current protocol day
  const startDay = currentProtocolDay || minDay;
  
  console.log(`🔍 Processing days ${startDay} to ${maxDay}`);
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
    
    // Count active positions and add supply for positions maturing
    positionProjections.forEach(projection => {
      const dayProjection = projection.dailyProjections.find(p => p.day === day);
      if (dayProjection?.isActive) {
        activePositions++;
      }
      
      // FIXED: Only add supply for positions maturing on or after current protocol day
      if (day === projection.maturityDay && projection.maturityDay >= currentProtocolDay) {
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
    
    // Debug logging for first few days
    if (day <= currentProtocolDay + 5) {
      console.log(`Day ${day}: totalMaxSupply=${totalMaxSupply.toFixed(2)} (current=${currentSupply} + stakes=${cumulativeFromStakes.toFixed(2)} + creates=${cumulativeFromCreates.toFixed(2)})`);
      if (dailyFromStakes > 0 || dailyFromCreates > 0) {
        console.log(`  ✅ Positions maturing: stakes=${dailyFromStakes.toFixed(2)}, creates=${dailyFromCreates.toFixed(2)}`);
      }
    }
    
    maxSupplyProjections.push({
      day,
      date: date.toISOString().split('T')[0],
      totalMaxSupply,
      activePositions,
      dailyRewardPool: parseFloat(rewardData.rewardPool || 0),
      totalShares: parseFloat(rewardData.totalShares || 0),
      breakdown: {
        fromStakes: cumulativeFromStakes,
        fromCreates: cumulativeFromCreates,
        fromExisting: 0
      }
    });
  }
  
  return maxSupplyProjections;
}

function generateFutureSupplyProjection() {
  console.log('🔄 Generating Future Supply Projection (FIXED VERSION)...\n');
  
  const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  // Constants
  const CONTRACT_START = new Date('2025-07-10T15:00:00Z');
  const today = new Date();
  const currentProtocolDay = Math.floor((today - CONTRACT_START) / (24 * 60 * 60 * 1000)) + 1;
  
  console.log(`Current Protocol Day: ${currentProtocolDay}`);
  console.log(`Today: ${today.toISOString().split('T')[0]}\n`);
  
  // Get positions and reward pool data
  const positions = convertToPositions(
    data.stakingData.stakeEvents || [],
    data.stakingData.createEvents || []
  );
  
  const rewardPoolData = data.stakingData.rewardPoolData || [];
  const currentSupply = data.totalSupply || 0;
  
  console.log(`Positions: ${positions.length}`);
  console.log(`Reward Pool Data Days: ${rewardPoolData.length}`);
  console.log(`Current Supply: ${currentSupply.toLocaleString()}\n`);
  
  // Generate projection starting from current day
  const futureProjection = calculateFutureMaxSupply(
    positions,
    rewardPoolData,
    currentSupply,
    CONTRACT_START
  );
  
  // Filter to only show from today forward
  const futureOnly = futureProjection.filter(p => p.day >= currentProtocolDay);
  
  console.log(`\nGenerated ${futureOnly.length} days of future projections\n`);
  
  // Show comparison for current day
  const currentDayProjection = futureOnly.find(p => p.day === currentProtocolDay);
  if (currentDayProjection) {
    console.log('📊 Current Day Projection (FIXED):');
    console.log(`  Day ${currentProtocolDay}: ${currentDayProjection.totalMaxSupply.toFixed(2)} TORUS`);
    console.log(`  Breakdown: stakes=${currentDayProjection.breakdown.fromStakes.toFixed(2)}, creates=${currentDayProjection.breakdown.fromCreates.toFixed(2)}`);
    console.log(`  This should now only include positions maturing today or later!\n`);
  }
  
  // Update the cached data
  if (!data.chartData) data.chartData = {};
  data.chartData.futureSupplyProjection = futureOnly;
  data.chartData.futureSupplyProjectionLastUpdate = {
    timestamp: new Date().toISOString(),
    protocolDay: currentProtocolDay,
    fixed: true
  };
  
  // Save
  fs.writeFileSync('public/data/cached-data.json', JSON.stringify(data, null, 2));
  
  console.log('✅ Future supply projection updated with fix for double-counting');
  
  // Show first few days
  console.log('\nFirst 5 days of projection:');
  futureOnly.slice(0, 5).forEach(p => {
    console.log(`  Day ${p.day} (${p.date}): ${p.totalMaxSupply.toLocaleString()} TORUS`);
  });
}

// Add this to smart-update-fixed.js
function shouldUpdateProjection(cachedData) {
  if (!cachedData) return true;
  const lastUpdate = cachedData.chartData?.futureSupplyProjectionLastUpdate;
  if (!lastUpdate) return true;
  
  const CONTRACT_START = new Date('2025-07-10T15:00:00Z'); // Contract days change at 15:00 UTC
  const currentProtocolDay = Math.floor((new Date() - CONTRACT_START) / (24 * 60 * 60 * 1000)) + 1;
  
  return currentProtocolDay > lastUpdate.protocolDay;
}

// Export for use in smart-update-fixed.js
module.exports = { generateFutureSupplyProjection, shouldUpdateProjection };

// Run if called directly
if (require.main === module) {
  generateFutureSupplyProjection();
}