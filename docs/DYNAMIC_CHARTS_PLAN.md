# Dynamic Charts Implementation Plan

## Overview
Charts need to dynamically show data based on the current day, extending 88 days into the future for forward-looking charts.

## Chart Categories

### 1. Forward-Looking Charts (Need 88 days from today)
- **TORUS Release Schedule** - Shows when stakes/creates mature
- **Stake Maturity Schedule** - Shows when stakes mature
- **Create Maturity Schedule** - Shows when creates mature
- **Future TORUS Max Supply Projection** - Projects supply changes

### 2. Historical Charts (Show past data)
- **TORUS Staked Per Contract Day** - Historical staking activity
- **Total TitanX Used for Creates** - Historical create costs

### 3. Mixed Charts (Show both past and future)
- **TORUS Price** - Historical + current
- **LP Positions** - Current state

## Implementation Approach

### Step 1: Update Data Fetching (Simple & Direct)
```javascript
// In update scripts, fetch data relative to current day
const currentDay = await contract.getCurrentDayIndex();
const futuredays = 88;

// Fetch reward data for next 88 days
for (let day = currentDay; day <= currentDay + futuredays; day++) {
  const [rewardPool, penalties, totalShares] = await Promise.all([
    contract.rewardPool(day),
    contract.penaltiesInRewardPool(day), 
    contract.totalShares(day)
  ]);
  
  rewardData.push({
    day,
    rewardPool: day <= 88 ? parseFloat(rewardPool) : 0,
    penaltiesInPool: parseFloat(penalties),
    totalShares: parseFloat(totalShares)
  });
}
```

### Step 2: Update Chart Data Calculations
```javascript
// Make charts show data relative to today
const calculateForwardLookingData = () => {
  const today = new Date();
  const data = [];
  
  // Show next 88 days
  for (let i = 0; i < 88; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    
    // Calculate data for this future date
    data.push({
      date: date.toISOString().split('T')[0],
      value: calculateValueForDate(date)
    });
  }
  
  return data;
};
```

### Step 3: Update Chart Components
- Modify x-axis to show dates/days dynamically
- Ensure data updates when day changes
- Add visual indicator for "today" on charts

## Simple Implementation Steps

### Phase 1: Fix Immediate Issues (Day 1)
1. ✅ Fix green bars not showing (DONE)
2. Update calculateTorusReleasesWithRewards to use current data
3. Test with real reward pool data

### Phase 2: Make Charts Dynamic (Day 2)
1. Add getCurrentDay() helper function
2. Update forward-looking charts to show today + 88 days
3. Update data fetching to get future penalty data

### Phase 3: Update Scripts (Day 3)
1. Modify update scripts to fetch current + future data
2. Add penalty pool fetching for all days
3. Validate data includes future projections

### Phase 4: Test & Document (Day 4)
1. Test all charts show correct date ranges
2. Verify data updates daily
3. Update chart specifications

## Code Changes Required

### 1. App.tsx - Add Dynamic Date Calculation
```javascript
// Get current protocol day
const getCurrentProtocolDay = () => {
  const launchDate = new Date('2025-04-29');
  const today = new Date();
  return Math.floor((today - launchDate) / (1000 * 60 * 60 * 24)) + 1;
};

// Update chart data to be dynamic
const chartData = useMemo(() => {
  const currentDay = getCurrentProtocolDay();
  // Calculate data for currentDay to currentDay + 88
}, [/* dependencies */]);
```

### 2. Update Scripts - Fetch Future Data
```javascript
// In smart-update-fixed.js
const currentDay = await stakeContract.getCurrentDayIndex();

// Fetch current + next 88 days
const rewardPoolData = [];
for (let day = currentDay; day <= currentDay + 88; day++) {
  // Fetch and store data
}
```

### 3. Chart Specifications Update
Add to dashboard-specs/chart-specifications.json:
```json
{
  "dynamicBehavior": {
    "forwardLooking": {
      "range": "currentDay to currentDay+88",
      "updates": "daily at midnight UTC"
    }
  }
}
```

## Testing Checklist
- [ ] Green bars show on TORUS Release Schedule
- [ ] Charts show correct date ranges
- [ ] Data updates when day changes
- [ ] Penalty data is fetched for future days
- [ ] Historical charts still work correctly

## Avoiding Over-Complication
- NO complex date libraries - use native Date
- NO reactive subscriptions - update on page load
- NO real-time updates - daily is sufficient
- SIMPLE calculations - direct and readable

## Next Steps
1. Test green bars fix
2. Implement getCurrentProtocolDay helper
3. Update one chart as proof of concept
4. Roll out to other charts
5. Update data fetching scripts