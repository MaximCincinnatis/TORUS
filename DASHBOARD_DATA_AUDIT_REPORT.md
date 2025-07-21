# TORUS Dashboard Data Audit Report
Date: 2025-07-21
Last Data Update: 2025-07-21T18:00:10.178Z

## Executive Summary

The audit reveals several critical issues with the cached-data.json file that need immediate attention:

1. **Duplicate rewardPoolData sections** with conflicting values
2. **LP Positions data appears correct** with proper torusAmount/titanxAmount values
3. **Recent creates data exists** (visible through stake events)
4. **Data contains "Infinity" values** which could cause display issues

## Detailed Findings

### 1. Reward Pool Data Issues ❌

**CRITICAL ISSUE**: There are TWO rewardPoolData sections in the JSON file:

- **First section** (inside chartData): Contains correct values with non-zero reward pools
  - Day 1: 100,000 TORUS
  - Day 9: 99,361.78 TORUS (correct decay)
  - Days 1-88: All have proper decaying values

- **Second section** (at root level): Contains INCORRECT data
  - Days 1-8: Have values
  - Days 9-88: ALL HAVE ZERO reward pool values ❌
  - This appears to be the section the frontend is reading

**Impact**: The dashboard is likely showing zero rewards available from day 9 onwards, which is incorrect.

### 2. LP Positions Data ✅

LP positions appear to have correct data:

| Token ID | Owner | TORUS Amount | TITANX Amount | In Range |
|----------|-------|--------------|---------------|----------|
| 1030759 | 0x9BBb...f30d | 0 | 115M | No |
| 1031465 | 0xCe32...32b6 | 142.96 | 3.7B | Yes |
| 1032346 | 0x1622...2466 | 0 | 879M | No |
| 1034067 | 0x3176...0112 | 168.84 | 6.4B | Yes |
| 1029195 | 0xAa39...3641 | 10,331.25 | 394.6B | Yes |

**Notes**:
- Out-of-range positions correctly show 0 TORUS amount
- In-range positions have both TORUS and TITANX amounts
- All positions have claimable fees calculated

### 3. Creates/Stakes Data ✅

Recent stake events are present and appear reasonable:
- Total stake events: 123
- Stakes in last 24 hours: 3
- Recent blocks: 22891014, 22891366, 22891778 (all recent)

### 4. Data Integrity Issues ⚠️

1. **"Infinity" values**: Found in LP position price ranges (e.g., "upperTitanxPerTorus": "Infinity")
2. **No scientific notation found**: This is good
3. **Totals validation**: ETH and TitanX totals correctly add up

## Root Cause Analysis

The issue appears to stem from the update scripts:
1. The full update script (`update-all-dashboard-data.js`) likely creates the structure with both rewardPoolData sections
2. The second (root-level) rewardPoolData is being incorrectly populated with zero values from day 9 onwards
3. The frontend is reading the wrong rewardPoolData section

## Recommendations

### Immediate Actions Required:

1. **Fix the JSON structure**: Remove the duplicate rewardPoolData section or ensure both have correct values
2. **Update the frontend**: Ensure it reads from the correct rewardPoolData section (the one inside chartData)
3. **Fix update scripts**: Prevent creation of duplicate sections with conflicting data

### Code Changes Needed:

1. In update scripts, ensure only ONE rewardPoolData section exists
2. If multiple sections are needed for different purposes, give them unique names
3. Add validation to prevent zero reward pools for days 1-88

## Impact Assessment

- **High Impact**: Users cannot see correct reward pool data from day 9 onwards
- **Medium Impact**: Infinity values in LP data could cause display/calculation issues
- **Low Impact**: LP positions and staking data appear correct

## Verification Steps

To verify the fix:
1. Check that rewardPoolData for days 1-88 all have non-zero values
2. Ensure no duplicate data sections exist
3. Confirm frontend displays correct reward pool values
4. Test that Infinity values don't break the UI

---

**Audit Status**: FAILED ❌
**Action Required**: URGENT - Fix reward pool data structure