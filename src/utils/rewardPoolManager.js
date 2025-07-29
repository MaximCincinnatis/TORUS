/**
 * Reward Pool Manager
 * Centralized module for fetching and managing TORUS reward pool data
 * Following best practices: Single responsibility, DRY, fail-safe design
 */

const { ethers } = require('ethers');

// Contract configuration
const STAKE_CONTRACT_ADDRESS = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
const STAKE_CONTRACT_ABI = [
  'function getCurrentDayIndex() view returns (uint24)',
  'function rewardPool(uint24 day) view returns (uint256)',
  'function totalShares(uint24 day) view returns (uint256)',
  'function penaltiesInRewardPool(uint24 day) view returns (uint256)',
];

// Constants based on TORUS contract design
const INITIAL_REWARD_POOL = 100000; // 100,000 TORUS
const DAILY_REDUCTION_RATE = 0.0008; // 0.08%
const TOTAL_REWARD_DAYS = 365; // Extended to include penalty rewards

/**
 * Fetch reward pool data for a range of days
 * @param {ethers.Provider} provider - Ethereum provider
 * @param {number} startDay - Starting day (inclusive)
 * @param {number} endDay - Ending day (inclusive)
 * @returns {Promise<Array>} Array of reward pool data
 */
async function fetchRewardPoolData(provider, startDay = 1, endDay = null) {
  console.log(`📊 Fetching reward pool data from day ${startDay} to ${endDay || 'current'}`);
  
  try {
    const contract = new ethers.Contract(STAKE_CONTRACT_ADDRESS, STAKE_CONTRACT_ABI, provider);
    
    // Get current day if not specified
    if (!endDay) {
      const currentDay = await contract.getCurrentDayIndex();
      endDay = Math.min(currentDay, TOTAL_REWARD_DAYS);
    }
    
    // Validate range
    if (startDay < 1 || startDay > TOTAL_REWARD_DAYS) {
      throw new Error(`Invalid start day: ${startDay}. Must be between 1 and ${TOTAL_REWARD_DAYS}`);
    }
    
    const rewardPoolData = [];
    const batchSize = 10; // Fetch 10 days at a time to avoid timeouts
    
    // Fetch in batches
    for (let batchStart = startDay; batchStart <= endDay; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize - 1, endDay);
      console.log(`  Fetching days ${batchStart}-${batchEnd}...`);
      
      const batchPromises = [];
      for (let day = batchStart; day <= batchEnd; day++) {
        batchPromises.push(fetchSingleDayData(contract, day));
      }
      
      try {
        const batchResults = await Promise.all(batchPromises);
        rewardPoolData.push(...batchResults);
        
        // Rate limiting - wait 100ms between batches
        if (batchEnd < endDay) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`❌ Error fetching batch ${batchStart}-${batchEnd}:`, error.message);
        // Continue with next batch instead of failing completely
      }
    }
    
    console.log(`✅ Fetched ${rewardPoolData.length} days of reward pool data`);
    
    // Calculate future rewards for chart display
    const currentDay = await contract.getCurrentDayIndex();
    const maxProjectionDay = currentDay + 88; // Always show 88 days forward
    
    // Fill in future days with calculated rewards
    let lastReward = INITIAL_REWARD_POOL;
    for (let day = 1; day <= maxProjectionDay; day++) {
      if (day === 1) {
        lastReward = INITIAL_REWARD_POOL;
      } else {
        lastReward = lastReward * (1 - DAILY_REDUCTION_RATE);
      }
      
      // Check if we already have this day
      const existing = rewardPoolData.find(d => d.day === day);
      if (!existing) {
        rewardPoolData.push({
          day,
          rewardPool: lastReward, // Rewards decline forever
          totalShares: 0,
          penaltiesInPool: 0,
          calculated: true
        });
      }
    }
    
    // Sort by day
    rewardPoolData.sort((a, b) => a.day - b.day);
    
    return rewardPoolData;
    
  } catch (error) {
    console.error('❌ Error in fetchRewardPoolData:', error);
    throw error;
  }
}

/**
 * Fetch data for a single day
 */
async function fetchSingleDayData(contract, day) {
  try {
    const [rewardPool, totalShares, penalties] = await Promise.all([
      contract.rewardPool(day),
      contract.totalShares(day),
      contract.penaltiesInRewardPool(day)
    ]);
    
    return {
      day,
      rewardPool: parseFloat(ethers.utils.formatEther(rewardPool)) * 1e18, // Keep in wei format
      totalShares: parseFloat(ethers.utils.formatEther(totalShares)) * 1e18,
      penaltiesInPool: parseFloat(ethers.utils.formatEther(penalties)) * 1e18
    };
  } catch (error) {
    console.error(`❌ Error fetching day ${day}:`, error.message);
    // Return calculated fallback data
    return calculateRewardPoolForDay(day);
  }
}

/**
 * Calculate expected reward pool for a day using contract formula
 */
function calculateRewardPoolForDay(day) {
  if (day < 1) {
    return {
      day,
      rewardPool: 0,
      totalShares: 0,
      penaltiesInPool: 0
    };
  }
  
  // Days 1-88: Base rewards (declining)
  // Days 89+: Only penalty rewards (fetched from contract)
  
  let rewardPool = INITIAL_REWARD_POOL;
  for (let i = 1; i < day; i++) {
    rewardPool = rewardPool * (1 - DAILY_REDUCTION_RATE);
  }
  
  return {
    day,
    rewardPool,
    totalShares: 808558839.0090909, // Default from existing data
    penaltiesInPool: 0
  };
}

/**
 * Validate reward pool data for completeness and accuracy
 */
function validateRewardPoolData(data) {
  const errors = [];
  
  // Check for required days
  const days = data.map(d => d.day);
  for (let day = 1; day <= TOTAL_REWARD_DAYS; day++) {
    if (!days.includes(day)) {
      errors.push(`Missing data for day ${day}`);
    }
  }
  
  // Validate day 1
  const day1 = data.find(d => d.day === 1);
  if (day1 && Math.abs(day1.rewardPool - INITIAL_REWARD_POOL) > 0.01) {
    errors.push(`Day 1 reward pool should be ${INITIAL_REWARD_POOL}, got ${day1.rewardPool}`);
  }
  
  // Validate progression
  for (let i = 1; i < data.length - 1; i++) {
    const current = data[i];
    const next = data[i + 1];
    
    if (current.day < TOTAL_REWARD_DAYS && next.day === current.day + 1) {
      const expectedNext = current.rewardPool * (1 - DAILY_REDUCTION_RATE);
      const difference = Math.abs(next.rewardPool - expectedNext);
      
      if (difference > 0.1) {
        errors.push(`Day ${next.day} progression error: expected ~${expectedNext.toFixed(2)}, got ${next.rewardPool}`);
      }
    }
  }
  
  // Check days after 88
  const afterRewardDays = data.filter(d => d.day > TOTAL_REWARD_DAYS);
  afterRewardDays.forEach(d => {
    if (d.rewardPool > 0) {
      errors.push(`Day ${d.day} should have 0 reward pool, got ${d.rewardPool}`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Merge new reward pool data with existing data
 * Preserves manually added data while updating blockchain data
 */
function mergeRewardPoolData(existingData, newData) {
  const merged = [...existingData];
  const existingDays = new Set(existingData.map(d => d.day));
  
  newData.forEach(newDay => {
    const existingIndex = merged.findIndex(d => d.day === newDay.day);
    
    if (existingIndex >= 0) {
      // Update existing day, preserving any manual additions
      merged[existingIndex] = {
        ...merged[existingIndex],
        ...newDay,
        // Preserve any custom fields
        lastUpdated: new Date().toISOString()
      };
    } else {
      // Add new day
      merged.push({
        ...newDay,
        lastUpdated: new Date().toISOString()
      });
    }
  });
  
  // Sort by day
  merged.sort((a, b) => a.day - b.day);
  
  return merged;
}

/**
 * Calculate daily rewards for a position
 */
function calculateDailyRewards(position, rewardPoolData, protocolDay) {
  const startDay = Math.max(1, protocolDay - position.stakingDays + 1);
  const endDay = protocolDay;
  
  let totalRewards = 0;
  
  for (let day = startDay; day <= endDay && day <= TOTAL_REWARD_DAYS; day++) {
    const dayData = rewardPoolData.find(d => d.day === day);
    
    if (dayData && dayData.totalShares > 0) {
      const positionShares = parseFloat(position.shares) / 1e18;
      const totalPool = dayData.rewardPool + dayData.penaltiesInPool;
      const dailyReward = (totalPool * positionShares) / dayData.totalShares;
      
      totalRewards += dailyReward;
    }
  }
  
  return totalRewards;
}

module.exports = {
  fetchRewardPoolData,
  validateRewardPoolData,
  mergeRewardPoolData,
  calculateDailyRewards,
  calculateRewardPoolForDay,
  
  // Constants for external use
  INITIAL_REWARD_POOL,
  DAILY_REDUCTION_RATE,
  TOTAL_REWARD_DAYS,
  STAKE_CONTRACT_ADDRESS
};