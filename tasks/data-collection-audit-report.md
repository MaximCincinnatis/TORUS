# Data Collection Audit Report

## Executive Summary

This audit investigated data collection issues that resulted in:
1. Day 18 being completely missing from the dataset
2. ETH usage showing as 0 for days 17-19
3. Missing titanXUsedForBuilds data

## Root Cause Analysis

### 1. Missing Day 18 Data

**Root Cause**: Protocol day calculation edge case
- The `getProtocolDay()` function in `update-buy-process-data.js` calculates days based on timestamps
- Protocol days start at 6 PM UTC (not midnight)
- When events occur near the day boundary, they can be misattributed to the wrong day
- Day 18 data was likely merged into Day 17 or Day 19 due to timestamp calculation issues

**Evidence**:
- Manual fix scripts (`fix-day17-data.js`, `fix-day18-19-dates.js`) were created to restore the missing data
- The fix scripts had to manually insert Day 18 between Days 17 and 19
- Day 18 was showing as "2025-07-27" (same as Day 17) instead of "2025-07-28"

### 2. ETH Usage Showing as 0

**Root Cause**: Complex ETH detection logic
- The script detects ETH transactions by checking function selectors:
  - `0x39b6ce64` for ETH burns
  - `0x53ad9b96` for ETH builds
- ETH detection requires fetching transaction receipts and looking for WETH deposit events
- This is an expensive operation that may fail or be skipped during high-load periods

**Evidence**:
```javascript
// Lines 210-229 in update-buy-process-data.js
const functionSelector = tx.data.slice(0, 10);
if (functionSelector === '0x39b6ce64') {
    // ETH burn - get WETH deposit amount
    const receipt = await provider.getTransactionReceipt(event.transactionHash);
    const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    const depositTopic = ethers.utils.id('Deposit(address,uint256)');
    // Complex logic to extract ETH amount from WETH deposits
}
```

**Issues**:
- If RPC calls fail or timeout, ETH amounts default to 0
- No retry mechanism for failed ETH amount fetches
- The script continues even if ETH detection fails

### 3. Missing titanXUsedForBuilds Data

**Root Cause**: Data field initialization
- The `titanXUsedForBuilds` field was added later to the data structure
- Historical data may not have this field properly initialized
- The merging logic doesn't always preserve or calculate this field correctly

## Data Merging Logic Issues

### Current Approach
The script uses a Map-based merging approach:
```javascript
// Lines 337-369 in update-buy-process-data.js
const dailyDataMap = new Map();
// Add existing data to map
mergedDailyData.forEach(day => {
    dailyDataMap.set(day.date, day);
});
// Merge new data
Object.entries(newDailyData).forEach(([date, data]) => {
    if (dailyDataMap.has(date)) {
        // Merge logic that can lose data if not careful
    }
});
```

### Problems Identified
1. **Date Key Collisions**: Using date strings as keys can cause issues when protocol days don't align with calendar days
2. **Partial Updates**: When merging, some fields use `||` operators which can preserve 0 values instead of updating
3. **No Validation**: The script doesn't validate that all required fields are present after merging

## Automated Update Analysis

### Current Setup
- Cron job runs every 5 minutes (previously 30 minutes)
- Executes `auto-update-fixed.js` which calls `smart-update-enhanced-integrated.js`
- Falls back to `smart-update-fixed.js` if enhanced version fails

### Will These Issues Happen Again?

**Likely YES** for the following reasons:

1. **No Fix for Root Causes**: The automated scripts still use the same flawed logic:
   - Same protocol day calculation that can miss days
   - Same ETH detection that can fail silently
   - Same merging logic that can lose data

2. **Fallback Behavior**: When the enhanced updater fails, it falls back to the original updater which has the same issues

3. **No Data Validation**: The scripts don't validate data completeness after updates

## Recommendations

### Immediate Actions
1. **Add Data Validation**: After each update, validate:
   - All protocol days are present and sequential
   - No fields have unexpected 0 values
   - ETH usage correlates with ETH burn/build counts

2. **Improve ETH Detection**:
   - Add retry mechanism for failed WETH deposit lookups
   - Cache successful ETH amounts to avoid re-fetching
   - Add fallback estimation based on gas prices if detection fails

3. **Fix Protocol Day Calculation**:
   - Use block timestamps consistently
   - Add boundary checks for day transitions
   - Validate that each day appears exactly once

### Long-term Improvements
1. **Refactor Data Structure**:
   - Use protocol day number as primary key instead of date strings
   - Store raw event data separately from aggregated daily data
   - Implement proper data versioning

2. **Add Monitoring**:
   - Alert when days are missing
   - Track ETH detection success rate
   - Log all data merging operations

3. **Implement Data Recovery**:
   - Automated detection of missing days
   - Ability to re-fetch historical data without losing current data
   - Backup data before each update

## Conclusion

The data collection issues stem from:
1. Complex protocol day calculations that don't handle edge cases
2. Fragile ETH detection logic that fails silently
3. Data merging approach that can lose information

Without addressing these root causes, similar data loss issues **will likely occur again**. The automated updates provide frequency but not reliability. Manual intervention and fix scripts will continue to be necessary until the fundamental issues are resolved.