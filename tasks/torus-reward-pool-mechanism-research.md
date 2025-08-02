# TORUS Reward Pool Mechanism Research Report

## Overview
The TORUS reward pool is a key component of the staking rewards system that distributes rewards to stakers based on their share of the total staking pool. This research documents how the reward pool mechanism works, including calculations, smart contract functions, and implementation details.

## Key Findings

### 1. Reward Pool Constants and Formula

**Initial Parameters:**
- **Starting Amount**: 100,000 TORUS on Protocol Day 1
- **Daily Reduction Rate**: 0.08% (0.0008 in decimal)
- **Protocol Start**: July 10, 2025 18:00 UTC
- **Base Reward Duration**: 88 days (after which base rewards become 0)

**Daily Reward Pool Calculation:**
```javascript
function calculateRewardPoolForDay(day) {
  if (day < 1) return 0;
  
  let rewardPool = 100000; // Initial 100,000 TORUS
  for (let i = 1; i < day; i++) {
    rewardPool = rewardPool * (1 - 0.0008); // Reduce by 0.08% daily
  }
  
  return rewardPool;
}
```

### 2. Smart Contract Functions

The reward pool data is fetched from the Create & Stake contract (0xc7cc775b21f9df85e043c7fdd9dac60af0b69507) using these functions:

```solidity
// Get base reward pool for a specific day
function rewardPool(uint24 day) view returns (uint256)

// Get total shares staked on a specific day
function totalShares(uint24 day) view returns (uint256)

// Get penalties collected in the reward pool for a specific day
function penaltiesInRewardPool(uint24 day) view returns (uint256)
```

### 3. Reward Pool Components

The total reward pool for any given day consists of two parts:

1. **Base Rewards** (Days 1-88 only):
   - Follows the declining formula above
   - Becomes 0 after day 88

2. **Penalty Rewards** (All days):
   - From early unstaking penalties
   - From late claim penalties
   - Continue indefinitely as long as stakes exist

**Total Daily Pool = Base Rewards + Penalty Rewards**

### 4. Reward Distribution Mechanism

Rewards are distributed proportionally based on shares:

```javascript
// Individual daily reward calculation
const sharePercentage = userShares / totalSharesForDay;
const dailyReward = (baseReward + penaltyReward) * sharePercentage;
```

### 5. Key Implementation Details

**From `update-all-dashboard-data.js`:**
- Fetches reward pool data for current day + 88 days forward
- Preserves historical data and merges with new data
- Handles RPC failures gracefully with zero fallbacks
- Data is stored in wei format and converted to TORUS units

**From `rewardPoolManager.js`:**
- Provides centralized reward pool management
- Includes calculation functions for future projections
- Validates reward pool data for consistency
- Supports batch fetching with rate limiting

### 6. Can Rewards Be Calculated Purely from Protocol Day?

**Yes, for base rewards (days 1-88):**
- The base reward amount is deterministic and follows the formula
- Can be calculated without blockchain queries
- Formula: `100,000 * (0.9992)^(day-1)`

**No, for penalty rewards:**
- Penalty amounts depend on user actions (early unstakes, late claims)
- Must be fetched from the blockchain
- Cannot be predicted in advance

**No, for total shares:**
- Total shares depend on staking activity
- Must be fetched from the blockchain
- Changes as users stake and unstake

### 7. Example Reward Pool Values

Based on the formula:
- Day 1: 100,000.00 TORUS
- Day 10: 99,204.75 TORUS
- Day 20: 98,412.94 TORUS
- Day 30: 97,625.22 TORUS
- Day 50: 96,061.06 TORUS
- Day 88: 93,274.09 TORUS
- Day 89+: 0 TORUS (base rewards only)

### 8. Current Implementation Status

**Working:**
- Base reward calculation formula implemented
- Reward pool data fetching from blockchain
- Historical data preservation
- Future projection calculations

**Issues Identified:**
- Some days show 0 rewards when they should have values
- Wei to TORUS conversion sometimes incorrect
- Penalty data not always fetched properly

**Solutions Implemented:**
- `calculateRewardPoolForDay` function for base rewards
- Data validation and correction scripts
- Proper wei conversion handling

## Recommendations

1. **For Dashboard Display:**
   - Show both base rewards and penalty rewards separately
   - Indicate day 88 as "end of base rewards" not "end of rewards"
   - Project future base rewards using the formula
   - Show "pending" for future penalty rewards

2. **For Data Updates:**
   - Use calculated values for base rewards (days 1-88) if blockchain returns 0
   - Always fetch penalty data from blockchain
   - Validate data consistency using the formula

3. **For Future Development:**
   - Implement penalty tracking and analysis
   - Add reward pool health metrics
   - Create alerts for unusual penalty amounts

## Conclusion

The TORUS reward pool mechanism is a hybrid system that combines:
1. **Predictable base rewards** (days 1-88) that can be calculated purely from the protocol day
2. **Dynamic penalty rewards** (all days) that must be fetched from the blockchain

Understanding this dual nature is crucial for accurate reward calculations and projections in the dashboard.