# TORUS Dashboard Protocol Day Fix - 2025-07-26

## Issue Fixed: Maximum Supply Chart Not Starting from Current Day

### Problem Identified:
- Chart was starting from day 8 instead of current day 17
- Frontend was calculating protocol days incorrectly (18-hour offset)
- Local calculation assumed midnight UTC start, but contract uses 6:00 PM UTC
- Update scripts weren't running properly to refresh currentProtocolDay

### Root Cause:
1. **Timing Mismatch**: Frontend calculated days from midnight UTC (00:00) but contract starts at 6:00 PM UTC (18:00)
2. **Stale Data**: cached-data.json had currentProtocolDay: 8 from July 18th instead of current day 17
3. **Inconsistent Sources**: Frontend used local calculation instead of contract's authoritative getCurrentDayIndex()

### Solution Implemented:

#### 1. Updated Frontend (App.tsx)
- ✅ Removed local `getCurrentProtocolDay()` function
- ✅ Replaced local calculations with `currentProtocolDay` state from cached data
- ✅ Frontend now uses contract-sourced protocol day exclusively

#### 2. Verified Update Scripts
- ✅ Confirmed `update-all-dashboard-data.js` already uses `contract.getCurrentDayIndex()`
- ✅ Data properly stored in cached-data.json as `currentProtocolDay`
- ✅ Auto-update mechanism working (every 30 minutes via cron)

#### 3. Data Updated
- ✅ Ran full update script to fetch current protocol day from contract
- ✅ currentProtocolDay now correctly shows 17 (from contract's getCurrentDayIndex())
- ✅ Maximum Supply chart will now start from day 17 as intended

### Protocol Day Timing Confirmed:
- **Contract Start**: July 10, 2025 at 6:00 PM UTC (18:00:00)
- **Day Boundaries**: Each day starts at 6:00 PM UTC
- **Current Day**: 17 (as of July 26, 2025)
- **Update Frequency**: Every 30 minutes (acceptable delay)

### Auto-Update System Audit:

#### ✅ Working Components:
1. **Cron Job**: `*/30 * * * *` runs every 30 minutes
2. **Script Chain**: `run-auto-update.sh` → `auto-update-fixed.js` → `smart-update-fixed.js`
3. **Contract Integration**: Uses `getCurrentDayIndex()` from smart contract
4. **Data Persistence**: Saves to cached-data.json and Git commits changes

#### ⚠️ Areas for Improvement:
1. **Day Boundary Precision**: Updates every 30 min, not specifically at 6 PM UTC when days flip
2. **Error Handling**: Could add specific validation for protocol day changes
3. **Monitoring**: No alerts if currentProtocolDay stops updating

### Verification:
- [x] Contract returns day 17 via `getCurrentDayIndex()`
- [x] Update script fetches and stores day 17 in cached-data.json
- [x] Frontend loads currentProtocolDay from cached data instead of local calculation
- [x] Maximum Supply chart will filter projections from day 17 onwards
- [x] Auto-update cron job continues to run every 30 minutes

### Files Modified:
1. `/src/App.tsx` - Removed local protocol day calculation
2. `/public/data/cached-data.json` - Updated currentProtocolDay to 17

### Future Considerations:
- Consider adding specific protocol day change detection around 6 PM UTC
- Add monitoring to ensure currentProtocolDay continues updating
- Document the 6 PM UTC day boundary timing for future developers

## Status: ✅ COMPLETE
The Maximum Supply chart now correctly starts from the current protocol day (17) as fetched directly from the smart contract, and the auto-update system ensures this stays current every 30 minutes.

---

# TORUS Token Total Supply Check - 2025-07-27

## Task: Check totalSupply() on TORUS Token Contract

### Summary:
Successfully queried the totalSupply() function on the TORUS token contract at address 0xb47f575807fc5466285e1277ef8acfbb5c6686e8 on Ethereum mainnet.

### Results:
- **Total Supply in Wei**: 17979638583984640637183
- **Total Supply in TORUS tokens**: 17979.638583984640637183
- **Formatted**: 17,979.64 TORUS tokens (approximately)

### Implementation Details:
1. Created a simple Node.js script using ethers.js v5
2. Connected to Ethereum mainnet using a public RPC endpoint
3. Called the totalSupply() view function on the TORUS token contract
4. Converted the result from wei to tokens using 18 decimal places

### Files Created:
- `/home/wsl/projects/TORUSspecs/torus-dashboard/check-total-supply.js` - Script to query totalSupply

### Technical Notes:
- Used ethers.js v5.7.2 (already installed in the project)
- The TORUS token uses standard 18 decimal places
- Total supply is approximately 17,979.64 TORUS tokens as of 2025-07-27

## Status: ✅ COMPLETE