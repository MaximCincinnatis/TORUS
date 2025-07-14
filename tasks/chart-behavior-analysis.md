# Chart Behavior Analysis for TORUS Dashboard

## Current Behavior

### ✅ What Works Well:
1. **Date Filtering**: Charts only show positions maturing AFTER today
2. **Rolling Window**: Always displays next 88 days from current date
3. **Automatic Updates**: Past positions drop off as dates pass
4. **Event Persistence**: Original stake/create events remain on blockchain

### ⚠️ Potential Issues:

#### 1. **Claimed vs Unclaimed Positions**
- **Issue**: We show ALL positions with future maturity dates, even if already claimed early
- **Impact**: Charts might show positions that no longer exist
- **Solution**: Need to track Claimed/StakeClaimed events and exclude those positions

#### 2. **Double Counting**
- **Issue**: If someone claims and re-stakes, we might count both positions
- **Example**: User stakes 1000 TORUS for 30 days, claims early at day 20, stakes again
- **Result**: Charts would show BOTH the original stake AND the new stake

#### 3. **Historical Accuracy**
- **Issue**: We calculate maturityDate from event timestamp + duration
- **Risk**: If blockchain timestamps are off, dates might be slightly wrong

## Recommended Improvements:

### 1. Track Claim Events
```typescript
// Add to fetchStakeEvents
const claimedStakes = await fetchStakeClaimedEvents();
const earlyClaimedStakes = await fetchEarlyStakeClaimedEvents();

// Filter out claimed positions
const activeStakes = stakeData.filter(stake => 
  !claimedStakes.has(`${stake.user}-${stake.id}`) &&
  !earlyClaimedStakes.has(`${stake.user}-${stake.id}`)
);
```

### 2. Add Active Position Verification
```typescript
// Query contract for actual active positions
const activePositions = await contract.getStakePositions(user);
// Cross-reference with our event data
```

### 3. Add Data Freshness Indicator
- Show last update time
- Add refresh button
- Display "Active as of [timestamp]"

## Current Status:
Charts will generally work correctly because:
- Old positions naturally fall off as dates pass
- New stakes create new events that get included
- The 88-day rolling window keeps data relevant

However, for 100% accuracy, we should implement claim tracking to avoid showing already-claimed positions.