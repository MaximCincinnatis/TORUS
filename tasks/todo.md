# TORUS Dashboard - LP Positions Fix Todo List

## Critical Issue: Uniswap V3 Yield Amounts Showing as 0

### Current Problem
- Claimable yield amounts for non-full range positions are showing as 0
- This issue has been fixed multiple times but keeps recurring
- Need to identify root cause and implement permanent solution

### Tasks

#### High Priority - LP Position Fixes
- [x] Audit all scripts that update LP position data
- [ ] Fix Uniswap V3 yield amounts showing as 0 for non-full range positions
- [ ] Create comprehensive test for LP position calculations  
- [ ] Implement permanent fix to prevent regression
- [ ] Consolidate update scripts into a single, reliable system

### Investigation Steps

1. **Identify all scripts that touch LP positions:**
   - smart-update-fixed.js
   - update-all-dashboard-data.js
   - incremental-lp-updater.js
   - incrementalUpdater.ts

2. **Check calculation functions:**
   - calculatePositionAmounts()
   - calculateClaimableYield()
   - Uniswap V3 math functions

3. **Common failure points:**
   - Missing tick/liquidity data
   - Incorrect price calculations
   - Data overwriting during updates
   - Type conversion issues (BigInt vs Number)

### Previous Fixes Applied
- Fixed calculatePositionAmounts in smart-update-fixed.js to handle all position types
- Copied proper Uniswap V3 math from full update script
- Issue: Fix is not persisting across all update scripts

### Permanent Solution Requirements
1. Centralize LP calculation logic in a shared module
2. Ensure all update scripts use the same calculation functions
3. Add validation to prevent 0 values from being saved
4. Implement data integrity checks before committing updates

## Update Scripts Audit Results

### All Update Scripts Found (19 project scripts):

#### Core Update Scripts (Main functionality):
1. **update-all-dashboard-data.js** (scripts/data-updates/)
   - Main full update script - rebuilds all data from scratch
   - **PROBLEM**: Overwrites lpPositions array completely (lines 943-944)
   - Most comprehensive but loses existing data
   
2. **smart-update.js**
   - Lightweight updates every 30 minutes
   - Only updates pool data and prices
   - Falls back to full update when new LP positions found
   - **PROBLEM**: Triggers full rebuild which loses data

3. **smart-update-fixed.js**
   - Enhanced version of smart-update.js
   - Has proper Uniswap V3 math calculations
   - Still falls back to full update for significant changes

4. **incrementalUpdater.ts** (src/utils/)
   - TypeScript utility for incremental updates
   - **GOOD**: Properly preserves existing data
   - Only appends new events, doesn't overwrite

5. **incremental-lp-updater.js**
   - Specialized for updating LP positions
   - Merges with existing positions
   - Preserves manually added data

#### Automation Scripts:
6. **auto-update.js** - Orchestrates full update + git push
7. **auto-update-fixed.js** - Enhanced automation script
8. **run-updater-service.js** - Service runner for updates

#### Specialized Update Scripts:
9. **update-complete-json.js** - General JSON updater
10. **update-blockchain-data.js** - Blockchain-specific updates
11. **update-cache-metadata.js** - Updates metadata only
12. **update-cache-with-real-data.js** - Real data fetcher
13. **update-claimable-simple.js** - Updates claimable amounts
14. **update-dashboard.js** - Dashboard-specific updates
15. **update-complete-dashboard-data.js** - Complete dashboard rebuild
16. **update-with-correct-fees.js** - Fee calculations update
17. **update-with-uniswap-values.js** - Uniswap data updater
18. **rpc-update-real-amounts.js** - RPC-based amount updates
19. **enhance-smart-update.js** - Smart update enhancements

#### Scripts in subdirectories:
- update-json-with-real-data.js (scripts/data-updates/)
- update-dashboard-data.js (scripts/data-updates/)
- update-complete-json-with-uniswap.js (scripts/data-updates/)
- update-all-dashboard-data-complete.js (scripts/data-updates/)

### Key Findings:

1. **Too Many Scripts**: 19+ different update scripts with overlapping functionality
2. **Inconsistent Approaches**: Some preserve data, others completely rebuild
3. **Main Culprit**: update-all-dashboard-data.js overwrites lpPositions array
4. **Cascading Problem**: Smart updates fall back to full update, triggering data loss
5. **No Single Source of Truth**: LP calculations duplicated across multiple scripts

### Scripts Actually Being Used:
- **smart-update.js** - Used by automated 30-minute updates
- **update-all-dashboard-data.js** - Called by smart-update as fallback
- **auto-update.js** - Used for manual/scheduled full updates

### Recommended Actions:
1. Consolidate all update logic into 2-3 well-defined scripts
2. Fix update-all-dashboard-data.js to merge instead of replace
3. Create shared calculation modules
4. Remove or archive unused scripts
5. Implement proper data preservation in all active scripts