# Fix Duplicate Stake Events Issue

## Problem
The smart-update-fixed.js script was creating duplicate stake and create events by simply concatenating new events with existing ones without checking for duplicates.

## Todo List
- [x] Analyze the stake event duplication issue in smart-update-fixed.js
- [x] Check how existing stake events are being merged with new ones
- [x] Look for where the deduplication logic should be applied
- [x] Implement a fix to prevent duplicate stake events
- [x] Test the fix and verify no duplicates are created
- [x] Review: Summarize changes and remaining issues

## Changes Made

### 1. Added Deduplication Helper Function
Created `deduplicateEvents()` function that removes duplicate events based on a unique key.

### 2. Updated Event Merging Logic
Modified lines 831-880 in smart-update-fixed.js to:
- Track existing events in a Set using unique keys (user-id-blockNumber)
- Filter out duplicates from new events before merging
- Log when duplicates are skipped

### 3. Added Cleanup on Startup
Added code at the beginning of `performSmartUpdate()` to clean existing duplicates from the data.

### 4. Created Test Script
Created test-stake-deduplication.js to verify the deduplication logic works correctly.

## Test Results
- Found and will remove 3 duplicate stake events
- Found and will remove 16 duplicate create events
- Deduplication logic correctly identifies duplicates based on user-id-blockNumber key

## Impact
- Prevents new duplicates from being added during incremental updates
- Cleans up existing duplicates when the update script runs
- Provides clear logging when duplicates are detected and skipped
- Ensures data integrity for stake and create events

## Remaining Issues
- Some historical duplicates lack transaction hashes (added before proper tracking)
- These will be cleaned up on the next update run

---

# Investigate Missing Burn Chart Data (Days 17-19)

## Todo List

- [x] Check public/data/buy-process-data.json to examine raw data for days 17, 18, 19
  - Day 17 is completely missing from the data
  - Day 18 shows as 2025-07-27 with all zero values
  - Day 19 shows as 2025-07-28 with 3 burns (but shouldn't exist yet)
- [x] Run node check-burn-events.js to verify actual blockchain events
  - Created investigate-day17.js script instead
  - Found 24 BuyAndBurn and 10 BuyAndBuild events on Day 17
  - Total of 218.49 TORUS burned on Day 17
- [x] Check if we need to manually run update-buy-process-data.js to fetch missing data
  - Ran update script but it didn't recover the missing day
  - The fix-buy-process-protocol-days.js script removed the duplicate but didn't restore Day 17
- [x] Look at the chart rendering functions in src/App.tsx for any issues
  - Chart rendering is fine, it's a data issue not a display issue
  - Charts use getProtocolDayUserDate() to map protocol days to dates
- [x] Report specific findings about what data is missing and why
  - Day 17 (2025-07-27) data was completely missing from JSON
  - Day 18 was incorrectly labeled as 2025-07-27 with zero data
  - Day 19 was incorrectly showing future data

## Resolution

### Issues Fixed

1. **Restored Day 17 Data**
   - Created fix-day17-data.js script
   - Recovered 24 BuyAndBurn and 10 BuyAndBuild events from blockchain
   - Added 218.49 TORUS burned on Day 17

2. **Fixed Day 18 Data**
   - Created fix-day18-19-dates.js script
   - Corrected date from 2025-07-27 to 2025-07-28
   - Updated with actual blockchain data: 10 burns, 4 builds, 47.29 TORUS burned

3. **Removed Invalid Day 19**
   - Day 19 hasn't occurred yet (protocol days change at 6 PM UTC)
   - Removed premature data entry

### Final Data Status

- Day 15 (2025-07-25): 213.90 TORUS burned (29 burns, 14 builds) ✅
- Day 16 (2025-07-26): 241.98 TORUS burned (38 burns, 19 builds) ✅
- Day 17 (2025-07-27): 218.49 TORUS burned (24 burns, 10 builds) ✅ RESTORED
- Day 18 (2025-07-28): 47.29 TORUS burned (10 burns, 4 builds) ✅ UPDATED

All burn charts should now display correctly with complete data for days 17 and 18.

## Previous Investigation

### TorusBuyAndProcess Contract Address Verification

#### Summary of Changes Made

1. **Searched the codebase** and found the TorusBuyAndProcess contract address `0xaa390a37006e22b5775a34f2147f81ebd6a63641` is used throughout the project in:
   - `/scripts/update-buy-process-data.js`
   - Multiple other scripts in the `/scripts` directory
   - Referenced in `CLAUDE.md` documentation

2. **Verified on Etherscan** that:
   - The TORUS token contract at `0xb47f575807fc5466285e1277ef8acfbb5c6686e8` creates the TorusBuyAndProcess contract in its constructor
   - The contract at `0xaa390a37006e22b5775a34f2147f81ebd6a63641` is active and has burn functionality
   - The contract includes `burnTorus()` function and tracks `totalTorusBurnt`

3. **Created verification script** (`/scripts/verify-buy-process-address.js`) that:
   - Queries the TORUS token contract for the actual buyAndProcess address
   - Confirms the address matches (case-insensitive): `0xAa390a37006E22b5775A34f2147F81eBD6a63641`
   - The address in our code `0xaa390a37006e22b5775a34f2147f81ebd6a63641` is correct

#### Important Findings

- The TorusBuyAndProcess contract address `0xaa390a37006e22b5775a34f2147f81ebd6a63641` is **correct** and actively burning TORUS tokens
- No updates to the contract address are needed
- The address is properly referenced throughout the codebase
- The CLAUDE.md documentation already notes an issue with the contract's `totalTorusBurnt()` function double-counting burns, which has been addressed in the update scripts

#### Next Steps

No further action required - the contract address is verified as correct.

## Data Collection Audit - July 29, 2025

### Summary

Investigated data collection issues that caused:
1. Day 18 to be completely missing from the dataset
2. ETH usage showing as 0 for days 17-19  
3. Missing titanXUsedForBuilds data

### Root Causes Identified

1. **Protocol Day Calculation Issues**
   - Edge case in `getProtocolDay()` function when events occur near day boundaries (6 PM UTC)
   - Days can be misattributed or completely missed
   - Day 18 data was merged into adjacent days

2. **ETH Detection Failures**
   - Complex logic requiring transaction receipt fetches and WETH deposit event parsing
   - Fails silently when RPC calls timeout or error
   - No retry mechanism for failed lookups

3. **Data Merging Problems**
   - Uses date strings as keys which can cause collisions
   - Partial updates can preserve 0 values instead of updating
   - No validation after merging

### Will This Happen Again?

**YES** - The automated updates still have the same flaws:
- Same protocol day calculation logic
- Same fragile ETH detection
- Same merging approach
- No data validation or recovery mechanisms

### Recommendations

1. **Immediate**: Add data validation, improve ETH detection with retries, fix day calculation
2. **Long-term**: Refactor data structure, add monitoring/alerts, implement automatic recovery

### Files Created

- `/tasks/data-collection-audit-report.md` - Comprehensive audit report with detailed findings

### Next Steps

The fundamental issues in the data collection scripts need to be addressed to prevent future data loss. Manual intervention will continue to be necessary until these root causes are fixed.