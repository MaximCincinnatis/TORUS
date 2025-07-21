# LP Amount Zero Prevention Guide

## Why LP Amounts Show 0

### 1. **Legitimate Reasons**
- **Out of Range**: Position's price range doesn't include current price
  - Below range: All in TORUS (titanxAmount = 0)
  - Above range: All in TitanX (torusAmount = 0)
- **Closed Position**: User withdrew all liquidity

### 2. **Bug Reasons** (What we need to prevent)
- **Field Mismatch**: Frontend expects different field names than backend provides
- **Calculation Errors**: RPC failures, missing pool data
- **Update Script Issues**: Full updates overwriting good data with zeros

## Current Protection Measures

### 1. **Frontend Resilience** (Implemented)
```typescript
// LPPositionsTable.tsx now checks multiple fields
const titanXAmount = position.titanxAmount !== undefined ? position.titanxAmount : 
  (tokenInfo.token0IsTitanX ? (position.amount0 || 0) : (position.amount1 || 0));
```

### 2. **Data Validation** (validate-lp-amounts.js)
- Checks for suspicious zero amounts
- Prevents writing bad data
- Preserves existing good data

### 3. **Update Script Safety**
```javascript
// Safe update pattern
function safeUpdateLPPositions(newPositions, existingPositions) {
  // 1. Validate new data
  // 2. Merge with existing (preserve non-zero)
  // 3. Reject if >50% have zero amounts
}
```

## Will It Happen Again?

### Scenarios Where It Could:
1. **Backend Changes Field Names** 
   - Risk: LOW (we now handle both formats)
   
2. **Update Script Errors**
   - Risk: MEDIUM (need to implement safe update pattern)
   
3. **All Positions Go Out of Range**
   - Risk: LOW (legitimate, not a bug)

## Prevention Checklist

### Before Every Update Script Run:
1. ✅ Backup current data
2. ✅ Run validation on new data
3. ✅ Compare zero count before/after
4. ✅ Merge instead of replace

### In Update Scripts:
```javascript
const { validateLPAmounts, safeUpdateLPPositions } = require('./scripts/validate-lp-amounts');

// Instead of:
cachedData.lpPositions = newPositions; // ❌ BAD

// Do this:
cachedData.lpPositions = safeUpdateLPPositions(newPositions, cachedData.lpPositions); // ✅ GOOD
```

### Monitoring:
```bash
# Add to cron job
node scripts/validate-lp-amounts.js
if [ $? -ne 0 ]; then
  echo "LP validation failed - not updating"
  exit 1
fi
```

## Quick Fixes If It Happens

### 1. **Immediate Fix**
```javascript
// In browser console
localStorage.setItem('lp-amounts-override', 'true');
location.reload();
```

### 2. **Check Which Script Ran**
```bash
# Check update logs
tail -100 /var/log/torus-updates.log | grep "lpPositions"
```

### 3. **Restore From Backup**
```bash
# Backups are in public/data/backups/
cp public/data/backups/cached-data-TIMESTAMP.json public/data/cached-data.json
```

## Long-term Solution

1. **Refactor Update Scripts** (As mentioned in CLAUDE.md)
   - Single update engine
   - Proper data merging
   - Validation before write

2. **Add Integration Tests**
   ```javascript
   test('Update script preserves non-zero amounts', () => {
     const existing = [{ tokenId: '1', torusAmount: 100, titanxAmount: 200 }];
     const updated = [{ tokenId: '1', torusAmount: 0, titanxAmount: 0 }];
     const result = safeUpdateLPPositions(updated, existing);
     expect(result[0].torusAmount).toBe(100); // Preserved
   });
   ```

3. **Add Monitoring**
   - Alert if >20% positions have zero amounts
   - Track amount changes over time
   - Auto-rollback on suspicious patterns