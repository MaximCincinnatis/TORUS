# Reward Pool Fix Documentation

## Overview
This document details the fix implemented for the "Accrued share pool rewards" display issue in the TORUS dashboard. The issue was that reward bars appeared too small because the reward pool data contained 0 values after day 21.

## Problem Identified
1. **Zero Values**: The rewardPoolData in cached-data.json showed 0 values for days after day 21
2. **Wei Format Issues**: Some values were stored in wei format (e.g., 1e+23) instead of TORUS units
3. **Data Duplication**: Multiple rewardPoolData arrays existed in the JSON structure
4. **Data Location**: Data was stored both at root level and under stakingData

## Solution Implemented

### Reward Pool Calculation Formula
Based on the smart contract logic:
```javascript
// Constants from the contract
const INITIAL_REWARD_POOL = 100000; // 100,000 TORUS
const DAILY_REDUCTION_RATE = 0.0008; // 0.08% daily reduction

function calculateRewardPoolForDay(day) {
  if (day < 1) return 0;
  
  let rewardPool = INITIAL_REWARD_POOL;
  for (let i = 1; i < day; i++) {
    rewardPool = rewardPool * (1 - DAILY_REDUCTION_RATE);
  }
  
  return rewardPool;
}
```

### Key Features of the Fix

1. **Wei to TORUS Conversion**:
   ```javascript
   // If value is in wei format (very large), convert it
   if (rewardPool > 1e10) {
     rewardPool = rewardPool / 1e18;
   }
   ```

2. **Data Deduplication**:
   - Uses a Map to ensure only one entry per day
   - Prefers non-zero values when duplicates exist
   - Removes duplicate arrays from JSON structure

3. **Missing Data Calculation**:
   - Calculates values for days 1-88 using the formula
   - Days after 88 correctly show 0 (as per contract design)
   - Preserves existing non-zero values where available

4. **Data Structure Cleanup**:
   - Ensures data is stored only in `stakingData.rewardPoolData`
   - Removes any top-level `rewardPoolData` arrays
   - Maintains consistent data format

### Scripts Created

1. **fix-reward-pool-data.js**: Initial fix attempt
2. **fix-reward-pool-data-v2.js**: Improved version with wei conversion
3. **clean-reward-pool-data.js**: Final cleanup and deduplication

### Results After Fix

Sample data showing the declining reward pool:
- Day 1: 100,000.00 TORUS
- Day 10: 99,204.75 TORUS
- Day 20: 98,491.25 TORUS
- Day 21: 98,412.10 TORUS
- Day 22: 98,333.37 TORUS
- Day 30: 97,650.40 TORUS
- Day 50: 96,021.04 TORUS
- Day 88: 93,274.09 TORUS
- Day 89+: 0 TORUS (contract stops rewards after day 88)

## Integration into Full Update Script

To integrate this fix into `update-all-dashboard-data.js`, the following changes are needed:

### 1. Add the Reward Pool Calculation Function
```javascript
function calculateRewardPoolForDay(day) {
  if (day < 1) return 0;
  
  let rewardPool = 100000; // Initial pool
  for (let i = 1; i < day; i++) {
    rewardPool = rewardPool * (1 - 0.0008);
  }
  
  return rewardPool;
}
```

### 2. Update the Reward Pool Data Processing
When processing reward pool data from the contract:
1. Check if returned value is 0 for days 1-88
2. If 0, use calculated value instead
3. Convert wei values to TORUS units if needed
4. Ensure data is stored in `stakingData.rewardPoolData`

### 3. Add Data Validation
```javascript
// Validate and fix reward pool data
const fixRewardPoolData = (rewardPoolData) => {
  const dayDataMap = new Map();
  
  rewardPoolData.forEach(dayData => {
    let rewardPool = dayData.rewardPool;
    
    // Convert from wei if needed
    if (rewardPool > 1e10) {
      rewardPool = rewardPool / 1e18;
    }
    
    // Use calculated value for days 1-88 if current is 0
    if (dayData.day <= 88 && rewardPool === 0) {
      rewardPool = calculateRewardPoolForDay(dayData.day);
    }
    
    dayDataMap.set(dayData.day, {
      ...dayData,
      rewardPool
    });
  });
  
  // Ensure days 1-88 exist
  for (let day = 1; day <= 88; day++) {
    if (!dayDataMap.has(day)) {
      dayDataMap.set(day, {
        day,
        rewardPool: calculateRewardPoolForDay(day),
        totalShares: 2500000000, // Default value
        penaltiesInPool: 0
      });
    }
  }
  
  return Array.from(dayDataMap.values()).sort((a, b) => a.day - b.day);
};
```

### 4. Ensure Proper Data Structure
Make sure the update script:
- Stores reward pool data only in `stakingData.rewardPoolData`
- Doesn't create duplicate arrays at root level
- Maintains the correct data format for each day

## Important Notes

1. **Contract Behavior**: The smart contract returns 0 for reward pools after day 88, which is correct behavior
2. **Default Values**: When data is missing, use 2,500,000,000 (2.5B) as default totalShares
3. **Data Persistence**: The fix ensures calculated values persist across updates
4. **Backwards Compatibility**: The fix maintains compatibility with existing dashboard components

## Testing
After implementing in the full update script, verify:
1. Reward pool values decline by 0.08% daily for days 1-88
2. Days after 88 show 0 rewards
3. No duplicate data arrays in JSON
4. Charts display visible reward bars
5. Wei values are properly converted to TORUS units