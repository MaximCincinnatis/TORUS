# TORUS Dashboard - Fix Active Stakes and Bar Charts

## Problem Summary
The dashboard shows 0 active stakes and empty bar charts because maturity dates in cached-data.json are showing as 1978 instead of 2025. This is a timestamp conversion issue where the blockchain timestamps aren't being properly converted to JavaScript dates.

## Plan

### 1. Identify Root Cause of Timestamp Issue
- [ ] Check how timestamps are being processed in stake events
- [ ] Identify where the 1978 dates are coming from
- [ ] Find the correct timestamp conversion formula

### 2. Fix Timestamp Conversion in Scripts
- [ ] Update scripts that process stake/create events to properly convert timestamps
- [ ] Ensure maturity dates are calculated as: startTime + (stakingDays * 86400)
- [ ] Convert blockchain timestamps to proper JavaScript Date objects

### 3. Update Data Processing Scripts
- [ ] Fix smart-update-fixed.js to calculate maturity dates
- [ ] Fix update-all-dashboard-data.js timestamp handling
- [ ] Fix force-stake-refresh.js to use correct date calculations

### 4. Regenerate Cached Data
- [ ] Run updated scripts to regenerate cached-data.json
- [ ] Verify maturity dates show as 2025, not 1978
- [ ] Ensure stake distribution shows 1-88 days

### 5. Test Frontend Display
- [ ] Verify active stakes count > 0
- [ ] Verify stake maturity schedule bar chart shows bars
- [ ] Verify create release schedule shows data
- [ ] Test that filtering by date ranges works correctly

### 6. Deploy and Verify
- [ ] Commit and push fixes
- [ ] Verify Vercel deployment
- [ ] Confirm main URL shows active stakes and bar charts

## Technical Details

The issue appears to be that blockchain timestamps (which are Unix timestamps in seconds) are being incorrectly interpreted, resulting in dates from 1978. The fix involves:

1. Converting blockchain timestamp (seconds) to milliseconds: `timestamp * 1000`
2. Creating proper Date object: `new Date(timestamp * 1000)`
3. Calculating maturity: `new Date((startTime + stakingDays * 86400) * 1000)`

## Files to Update
- `/smart-update-fixed.js` - Add maturity date calculation
- `/scripts/data-updates/update-all-dashboard-data.js` - Fix timestamp conversion
- `/force-stake-refresh.js` - Update date calculations
- `/public/data/cached-data.json` - Will be regenerated with correct dates

## Success Criteria
- Active stakes shows count > 0 (not 0)
- Stake maturity schedule shows bars across 1-88 days
- Create release schedule shows distribution
- All dates display as 2025, not 1978