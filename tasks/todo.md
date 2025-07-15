# TORUS Dashboard - Uniswap V3 LP Position Issues & Fix Plan

## Critical Issues Identified

### LP Position Data Problems
1. **Token Amounts Wrong**: Position 1029195 shows 31M+ TORUS when it should be ~10k TORUS
2. **Claimable Yield Wrong**: Most/all positions showing incorrect claimable amounts
3. **Estimated APR Wrong**: APR calculations not accurate
4. **TitanX Price Range**: Shows 0 in frontend for V3 range display
5. **Missing LP Positions**: Script only found 4 positions, user expects at least 5

## Root Cause Analysis

### 1. Token Amount Calculation Issue
- `fetch-all-lp-positions.js` uses arbitrary multipliers (1.0, 50, 0.5, 25)
- Should use proper Uniswap V3 math with sqrtPrice calculations
- `fix-lp-positions-simple.js` has the correct implementation

### 2. Block Range Issue (FIXED)
- ✅ Script was only searching recent 50k blocks
- ✅ Fixed to search from pool creation block 22890272
- ✅ Now finds 13 total positions (6 active after filtering)

### 3. Position Filtering (FIXED)
- ✅ Added filter to exclude closed positions with 0 liquidity and 0 fees
- ✅ Now shows only 6 active positions

## Todo Items

### High Priority - Fix Token Calculations
- [ ] **Run fix-lp-positions-simple.js to correct all amounts**
  - Uses proper Uniswap V3 math from lines 18-58
  - Calculates exact token amounts based on liquidity and price
  - Should show ~10k TORUS for position 1029195, not 31M

- [ ] **Verify claimable fee calculations**
  - Check if tokensOwed0/tokensOwed1 are being read correctly
  - Ensure proper decimal conversion with formatEther

- [ ] **Fix APR calculations**
  - Current logic uses arbitrary 52 week multiplier
  - Should use actual fee accumulation timeframe

- [ ] **Add price range formatting**
  - Implement formatPriceRange function from fix-lp-positions-simple.js
  - Convert tick ranges to human-readable TitanX/TORUS prices

### Medium Priority - Frontend Integration
- [ ] **Check frontend LP display components**
  - Review src/components/lp/LPPositionsTable.tsx
  - Verify it's using the correct fields from JSON

- [ ] **Test JSON structure compatibility**
  - Ensure lpPositions array has all required fields
  - Verify priceRange field is included and displayed

### Next Steps
1. Run `fix-lp-positions-simple.js` to correct all LP position data
2. Verify the corrected amounts match expectations (~10k TORUS)
3. Update main script to use correct calculations
4. Test frontend display with corrected data

## Review Section

### ✅ Completed Tasks
1. **Fixed block range** - Now searches from pool creation instead of recent 50k blocks
2. **Added position filtering** - Excludes closed positions with 0 liquidity
3. **Found missing positions** - Increased from 4 to 6 active positions

### 🔧 Pending Fixes
1. **Token amount calculations** - Need to replace arbitrary multipliers with proper math
2. **Claimable yields** - Verify fee calculations are accurate
3. **APR estimates** - Use realistic timeframes and calculations
4. **Price range display** - Add formatted price ranges for frontend

### 📝 Key Findings
- The issue is not with finding positions (that's fixed)
- The issue is with calculating the token amounts incorrectly
- Solution already exists in `fix-lp-positions-simple.js`
- Need to run this script to correct all LP position data