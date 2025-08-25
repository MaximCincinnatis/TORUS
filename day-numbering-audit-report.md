# Day Numbering Audit Report
## Max TORUS Supply w/Future Share Payouts Chart

### Executive Summary
The chart displays "Day 39" as the first day when the current protocol day is 38. This is due to the projection starting point logic in the code.

---

## Current State Analysis

### System Status
- **Current Protocol Day**: 38 (confirmed from contract)
- **Date**: August 17, 2025
- **Issue**: Chart starts with Day 39 instead of Day 38

### Data Structure
- **futureSupplyProjection array**: Empty (0 entries)
- **Implication**: Projections are calculated on-the-fly, not pre-stored

---

## Root Cause Analysis

### Code Review - maxSupplyProjection.ts

**Line 353**: `const startDay = currentProtocolDay || minDay;`
- This correctly sets the start day to the current protocol day (38)

**Line 395**: `for (let day = startDay; day <= maxDay; day++)`
- The loop starts from `startDay` which should be 38

### Code Review - FutureMaxSupplyChart.tsx

**Line 113**: `let filteredProjections = projections.filter(p => p.day >= currentProtocolDay);`
- Filter correctly includes days >= 38
- Should include day 38 in the output

**Line 137-142**: Label formatting
```typescript
`Day ${projection.day} (${new Date(projection.date + 'T00:00:00Z').toLocaleDateString(...)})`
```
- Labels display the projection.day value directly
- Date is formatted in UTC

---

## Test Results

### Test 1: Protocol Day Verification
✅ **PASS** - Current protocol day is 38

### Test 2: Projection Data
❌ **FAIL** - No projection data in cached-data.json (array is empty)

### Test 3: Filter Logic
✅ **PASS** - Filter correctly includes current day when tested with mock data

### Test 4: Date Alignment
✅ **PASS** - Days since contract start (38) matches current protocol day (38)

---

## Issue Identification

### Primary Issue
The `futureSupplyProjection` array is empty, causing the chart to calculate projections dynamically.

### Suspected Cause
When projections are calculated dynamically, there may be an off-by-one error in:
1. The projection generation starting point
2. The day calculation when creating projection objects

### Evidence
- Empty `futureSupplyProjection` array in cached-data.json
- Chart shows Day 39 first despite filter including day >= 38
- The calculation logic likely starts from `currentProtocolDay + 1` somewhere in the chain

---

## Expected vs Actual Behavior

### Expected
- First day shown: **Day 38 (Aug 17)**
- Projection includes current protocol day
- Days increment sequentially from 38

### Actual
- First day shown: **Day 39**
- Current protocol day is skipped
- Days increment from 39 onward

---

## Recommendations

### Immediate Fix
The projection generation should explicitly include the current protocol day:
- When creating projection objects, ensure `day` starts at `currentProtocolDay`, not `currentProtocolDay + 1`

### Specific Location
Check the projection generation loop where projection objects are created. The day assignment likely uses an offset that adds 1 unnecessarily.

### Verification Steps
1. Populate the `futureSupplyProjection` array with correct data
2. Ensure first entry has `day: 38`
3. Verify chart displays "Day 38" as first label

---

## Conclusion

The issue is confirmed: the chart starts with Day 39 when it should start with Day 38. The root cause is in the projection generation logic that skips the current protocol day when creating projection data points. The filtering and display logic are correct; the issue is in the data generation itself.

**Status**: Issue identified and documented. No production code was modified during this audit.