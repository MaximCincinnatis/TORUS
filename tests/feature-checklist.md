# LP Positions Feature Checklist

Run this checklist before EVERY deployment to ensure no features are broken.

## Manual Verification Checklist

### Visual Elements ✓
- [ ] TitanX logo appears in table header
- [ ] TORUS text has special styling (color/font)
- [ ] Status badges show correct colors (green="In Range", red="Out of Range")
- [ ] Table has proper borders and spacing
- [ ] Position count shows at top ("X positions found")

### Data Display ✓
- [ ] Position IDs are clickable links (blue, underlined)
- [ ] Owner addresses are truncated (0x1234...5678)
- [ ] TitanX amounts show with commas (1,234,567.89)
- [ ] TORUS amounts use smart decimals:
  - [ ] < 0.001: Shows 6 decimals
  - [ ] < 1: Shows 4 decimals  
  - [ ] < 1000: Shows 3 decimals
  - [ ] >= 1000: Shows with commas
- [ ] Claimable Yield shows with $ symbol
- [ ] APR shows with % symbol
- [ ] Price ranges show "Full Range V3" or "X.XX - Y.YY"

### Interactive Features ✓
- [ ] Clicking Position ID opens Uniswap in new tab
- [ ] Clicking Owner address opens Etherscan in new tab
- [ ] Links have proper security attributes (rel="noopener noreferrer")
- [ ] Table scrolls horizontally on mobile

### Data Integrity ✓
- [ ] No positions with 0 TORUS and 0 TitanX shown
- [ ] Field mapping works (amount0 → torusAmount, amount1 → titanxAmount)
- [ ] Handles both token orders (TORUS as token0 or token1)
- [ ] Loading state shows skeleton loader
- [ ] Error state shows graceful message

### Performance ✓
- [ ] Table loads within 2 seconds
- [ ] Pagination limits to 10 rows
- [ ] No console errors
- [ ] No React warnings

## Automated Test Commands

```bash
# Run before every commit
npm run test:lp-positions

# Run visual regression tests
npm run test:visual

# Validate data contracts
npm run validate:lp-data

# Full test suite
npm run test:all
```

## Quick Manual Test

1. Open dashboard
2. Scroll to LP Positions section
3. Verify 5 random positions have all features
4. Click one Position ID → Uniswap opens
5. Click one Owner → Etherscan opens
6. Check console for errors

## If Something Breaks

1. **DON'T PANIC** - We have specs and tests
2. Check `dashboard-specs/chart-specifications.json` for requirements
3. Run `npm run validate:specs` to find mismatches
4. Check recent commits for changes to:
   - `LPPositionsTable.tsx`
   - `lpCalculations.js`
   - Any update scripts
5. Revert problematic commit if needed

## Sign-Off

Before deploying, confirm:
- [ ] All manual checks passed
- [ ] All automated tests passed
- [ ] No console errors
- [ ] Performance acceptable

Checked by: _________________ Date: _________________