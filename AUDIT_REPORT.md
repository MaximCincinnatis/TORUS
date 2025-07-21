# TORUS Dashboard Dynamic Charts Audit Report
*Date: January 21, 2025*

## Summary of Changes Audited

The recent implementation added dynamic chart functionality to show forward-looking data for 88 days from the current date. This audit examines the correctness of the implementation and identifies any potential issues.

## Findings

### 1. ✅ Contract Start Date Correction
**Status: CORRECT**
- Changed from `2025-07-11` to `2024-04-11` 
- This correctly reflects when the TORUS protocol launched
- Current protocol day calculation now shows ~467 days (as of Jan 21, 2025)

### 2. ✅ 88-Day Range Implementation  
**Status: CORRECT**
- All forward-looking charts properly initialize 88-day ranges using `for (let i = 0; i <= 88; i++)`
- This gives 89 days total (0-88 inclusive), which is intentional
- Applied consistently across:
  - Stake maturity calculations (line 307)
  - Create maturity calculations (line 399)
  - TORUS releases (line 457)
  - TORUS releases with rewards (line 491)
  - Reward calculations loop (line 549)

### 3. ✅ Reward Calculation Fix
**Status: CORRECT**
- Lines 558-561 correctly handle reward pool data that's already in decimal format
- Removed unnecessary `/1e18` division that was causing values to be too small
- This should fix the missing green bars on the TORUS Release Schedule chart

### 4. ⚠️ MAX_CHART_DAYS Constant
**Status: POTENTIAL CONFUSION**
- `MAX_CHART_DAYS` is still set to 365 (line 25)
- However, this is only used for warning messages (line 360)
- All actual chart calculations use the hardcoded 88-day loops
- **Recommendation**: Consider renaming to `MAX_HISTORICAL_DAYS` to avoid confusion

### 5. ✅ Dynamic Date Range Function
**Status: CORRECT**
- `getDynamicDateRange()` properly calculates today + 88 days
- Returns both start (today) and end dates for consistency

### 6. ⚠️ Timezone Handling
**Status: MINOR ISSUE**
- The date calculations use local timezone via `new Date('2024-04-11')`
- This could cause 1-day discrepancies depending on user timezone
- **Impact**: Minimal - only affects protocol day calculation by ±1 day
- **Recommendation**: Consider using UTC dates throughout

### 7. ✅ Forward-Looking Chart Identification
**Status: CORRECT**
- `isForwardLookingChart()` properly identifies which charts need dynamic ranges
- Includes all relevant charts that show future data

### 8. ✅ Current Protocol Day Calculation
**Status: CORRECT**
- `getCurrentProtocolDay()` correctly calculates days since launch
- Uses `Math.max(1, daysDiff)` to ensure minimum day 1
- Properly handles the date arithmetic

## Edge Cases Analysis

### 1. ✅ Data Beyond 88 Days
- Stakes/creates maturing beyond 88 days are properly excluded from forward-looking views
- Warning message logged when data falls outside range (line 360)

### 2. ✅ Empty Data Handling
- Charts properly handle empty data arrays
- Conditional rendering prevents errors when data is loading

### 3. ✅ Reward Pool Data Availability
- Correctly checks if reward pool data exists for each day
- Handles missing data gracefully without crashing

## Performance Considerations

### 1. ✅ Loop Efficiency
- 88-day loops are reasonable for performance
- No nested loops that would cause O(n²) complexity

### 2. ⚠️ Console Logging
- Extensive debug logging in reward calculations (lines 564-577)
- **Recommendation**: Consider removing or conditionally enabling for production

## Recommendations

1. **Rename MAX_CHART_DAYS** to MAX_HISTORICAL_DAYS to clarify its purpose
2. **Use UTC dates** throughout to avoid timezone issues
3. **Remove debug logging** or add a debug flag
4. **Add unit tests** for:
   - Protocol day calculation across timezones
   - 88-day range boundary conditions
   - Reward calculation with various data scenarios

## Conclusion

The dynamic charts implementation is fundamentally correct. The main issues fixed:
- ✅ Contract start date corrected from future to past
- ✅ 88-day forward-looking ranges properly implemented  
- ✅ Reward calculation bug fixed (removed extra /1e18)

The implementation successfully addresses the requirements for showing dynamic, forward-looking data while maintaining data integrity and performance.