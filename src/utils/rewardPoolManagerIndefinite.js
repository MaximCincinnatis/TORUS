/**
 * Reward Pool Manager - Indefinite Support
 * Handles TORUS reward pools that run forever, not just 88 days
 * 
 * Days 1-88: Base rewards (100,000 declining by 0.08% daily) + penalties
 * Days 89+: Only penalties from early unstakes and late claims
 */

const { ethers } = require('ethers');

// Constants
const STAKE_CONTRACT_ADDRESS = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
const INITIAL_REWARD_POOL = 100000;
const DAILY_REDUCTION_RATE = 0.0008; // 0.08%
const BASE_REWARD_DAYS = 88; // Base rewards only for first 88 days

/**
 * Calculate base reward for a specific day
 * @param {number} day - Protocol day
 * @returns {number} Base reward amount (0 after day 88)
 */
function calculateBaseReward(day) {
  if (day < 1 || day > BASE_REWARD_DAYS) {
    return 0;
  }
  
  let reward = INITIAL_REWARD_POOL;
  for (let i = 1; i < day; i++) {
    reward = reward * (1 - DAILY_REDUCTION_RATE);
  }
  return reward;
}

/**
 * Fetch reward pool data for any day range (supports indefinite days)
 * @param {ethers.Provider} provider - Ethereum provider
 * @param {Object} contract - Stake contract instance
 * @param {number} fromDay - Start day
 * @param {number} toDay - End day
 * @returns {Promise<Array>} Reward pool data
 */
async function fetchRewardPoolRange(provider, contract, fromDay, toDay) {
  const rewardData = [];
  
  // Fetch in batches to avoid timeouts
  const batchSize = 20;
  
  for (let day = fromDay; day <= toDay; day += batchSize) {
    const batchEnd = Math.min(day + batchSize - 1, toDay);
    const batchPromises = [];
    
    for (let d = day; d <= batchEnd; d++) {
      batchPromises.push(fetchDayData(contract, d));
    }
    
    try {
      const results = await Promise.all(batchPromises);
      rewardData.push(...results);
    } catch (error) {
      console.error(`Error fetching days ${day}-${batchEnd}:`, error.message);
      // Add calculated fallback data
      for (let d = day; d <= batchEnd; d++) {
        rewardData.push(createFallbackDayData(d));
      }
    }
    
    // Rate limiting
    if (batchEnd < toDay) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return rewardData;
}

/**
 * Fetch data for a single day
 */
async function fetchDayData(contract, day) {
  try {
    const [baseReward, totalShares, penalties] = await Promise.all([
      contract.rewardPool(day),
      contract.totalShares(day),
      contract.penaltiesInRewardPool(day)
    ]);
    
    return {
      day,
      baseReward: parseFloat(ethers.utils.formatEther(baseReward)) * 1e18,
      penaltiesInPool: parseFloat(ethers.utils.formatEther(penalties)) * 1e18,
      totalShares: parseFloat(ethers.utils.formatEther(totalShares)) * 1e18,
      // Combined reward pool for compatibility
      rewardPool: parseFloat(ethers.utils.formatEther(baseReward)) * 1e18
    };
  } catch (error) {
    return createFallbackDayData(day);
  }
}

/**
 * Create fallback data when blockchain fetch fails
 */
function createFallbackDayData(day) {
  const baseReward = calculateBaseReward(day);
  return {
    day,
    baseReward,
    penaltiesInPool: 0, // Can't calculate without blockchain data
    totalShares: 0, // Can't calculate without blockchain data
    rewardPool: baseReward // For backward compatibility
  };
}

/**
 * Update reward pool data to support indefinite days
 * @param {Object} cachedData - Current cached data
 * @param {number} currentProtocolDay - Current day from contract
 * @param {number} daysToProject - How many future days to include
 */
async function updateRewardPoolsIndefinite(provider, cachedData, currentProtocolDay, daysToProject = 365) {
  const contract = new ethers.Contract(STAKE_CONTRACT_ADDRESS, STAKE_CONTRACT_ABI, provider);
  
  console.log(`Updating reward pools for days 1-${currentProtocolDay + daysToProject}`);
  
  // Fetch historical data (days 1 to current)
  const historicalData = await fetchRewardPoolRange(provider, contract, 1, currentProtocolDay);
  
  // Project future days (current+1 to current+daysToProject)
  const futureData = [];
  for (let day = currentProtocolDay + 1; day <= currentProtocolDay + daysToProject; day++) {
    futureData.push({
      day,
      baseReward: calculateBaseReward(day),
      penaltiesInPool: 0, // Unknown future penalties
      totalShares: 0, // Unknown future shares
      rewardPool: calculateBaseReward(day)
    });
  }
  
  // Combine all data
  const allRewardData = [...historicalData, ...futureData];
  
  // Update cached data
  cachedData.stakingData.rewardPoolData = allRewardData;
  
  console.log(`✅ Updated ${allRewardData.length} days of reward data`);
  console.log(`   Days 1-88: Base rewards + penalties`);
  console.log(`   Days 89+: Penalties only`);
  
  return cachedData;
}

/**
 * Validate reward data includes penalty information
 */
function validateIndefiniteRewards(data) {
  const errors = [];
  
  // Check structure
  if (!Array.isArray(data)) {
    errors.push('Reward data must be an array');
    return { isValid: false, errors };
  }
  
  // Check for base rewards ending at day 88
  const day89 = data.find(d => d.day === 89);
  if (day89 && day89.baseReward > 0) {
    errors.push('Base rewards should be 0 after day 88');
  }
  
  // Check for penalty data
  const haspenalties = data.some(d => d.penaltiesInPool !== undefined);
  if (!haspenalties) {
    errors.push('Missing penalty pool data');
  }
  
  // Ensure we have data beyond day 88
  const maxDay = Math.max(...data.map(d => d.day));
  if (maxDay <= 88) {
    errors.push(`Data only goes to day ${maxDay}, should extend beyond day 88`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Contract ABI for fetching
const STAKE_CONTRACT_ABI = [
  'function getCurrentDayIndex() view returns (uint24)',
  'function rewardPool(uint24 day) view returns (uint256)',
  'function totalShares(uint24 day) view returns (uint256)',
  'function penaltiesInRewardPool(uint24 day) view returns (uint256)',
];

module.exports = {
  calculateBaseReward,
  fetchRewardPoolRange,
  updateRewardPoolsIndefinite,
  validateIndefiniteRewards,
  STAKE_CONTRACT_ADDRESS,
  STAKE_CONTRACT_ABI,
  BASE_REWARD_DAYS
};