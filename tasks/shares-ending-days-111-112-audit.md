# Shares Ending by Future Date Chart Audit - Days 111-112

## Summary
The small bars on days 111 and 112 in the "Shares Ending by Future Date" chart are **INACCURATE** due to a data collection issue. Most creates ending on these days incorrectly show 0 shares.

## Key Findings

### Reward Pool Total Shares (Converted from Wei)
- **Day 109**: 314,257,005 shares
- **Day 110**: 209,212,791 shares (33% drop)
- **Day 111**: 129,189,578 shares (38% drop)
- **Day 112**: 443,126 shares (99.7% drop!)
- **Day 113**: Data not shown in reward pool

### Shares Ending Each Day (Chart Data)

#### Stakes Ending:
- Day 111: 4 stakes totaling ~836,352 shares
- Day 112: 2 stakes totaling ~123,904 shares

#### Creates Ending:
- Day 111: 38 creates with shares
- Day 112: 46 creates (many with 0 shares)

## Technical Verification

1. **Data Conversion**: The chart correctly converts shares from Wei (10^18) to regular units
   ```javascript
   const shares = parseFloat(stake.shares) / 1e18;
   ```

2. **Specific Examples from Day 112**:
   - Stake 1: 77,440 shares (from 77440000000000000000000 Wei)
   - Stake 2: 46,464 shares (from 46464000000000000000000 Wei)
   - Total stakes: ~123,904 shares

3. **Reward Pool Correlation**: The reward pool totalShares drops from 129M on day 111 to just 443K on day 112, which explains why the bars appear so small.

## Data Collection Issue

### Creates on Day 112:
- **46 total creates** ending on day 112
- **Only 3 have proper shares** (365,686 shares total)
- **39 show 0 shares** (data collection error)
- **4 have undefined shares** (incomplete data)

### Pattern Identified:
- Days 1-24: Creates have proper shares values
- Days 24-27: Creates show 0 shares (unclaimed creates)
- The data format changed around day 24

### Root Cause:
All creates with 0 shares:
- Were initiated on days 24-27
- Have `claimedCreate: false`
- Contain new fields like `createDays`, `stakingDays`, `power`
- Are missing the shares calculation

## Conclusion

The extremely small bars on days 111 and 112 are **INACCURATE** due to incomplete data collection for unclaimed creates. The chart is missing shares data for 43 out of 46 creates ending on day 112. This is a data collection bug, not a real drop in shares.

The data collection script needs to be updated to properly calculate shares for unclaimed creates initiated after day 24.