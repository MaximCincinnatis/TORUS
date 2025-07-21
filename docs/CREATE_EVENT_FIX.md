# Create Event Fetching Fix Documentation

## Issue Summary
From July 16-21, 2025, no new creates were being displayed on the TORUS dashboard despite active on-chain activity. Investigation revealed that 81 creates were missing from the data.

## Root Cause
The `smart-update-fixed.js` script had an incorrect event signature for the `Created` event:

### Wrong Event Signature (Line 584):
```javascript
'event Created(address indexed user, uint256 indexed createId, uint256 amount, uint256 shares, uint16 indexed duration, uint256 rewardDay, uint256 timestamp, address referrer)'
```

### Correct Event Signature (from contract ABI):
```javascript
'event Created(address indexed user, uint256 stakeIndex, uint256 torusAmount, uint256 endTime)'
```

## Impact
- All creates from July 16-21 were missing (81 events)
- Charts showed incorrect data (only 1 create ending after day 94)
- Users couldn't see their recent create activity

## Fix Applied

### 1. Fixed Event Signature
Updated `smart-update-fixed.js` to use the correct event signature from the contract ABI.

### 2. Updated Event Processing
Modified the event processing logic to handle the correct fields:
- `stakeIndex` instead of `createId`
- `torusAmount` instead of `amount`
- `endTime` directly provided (not calculated)
- Removed non-existent fields

### 3. One-Time Data Recovery
Created `scripts/fetch-missing-creates.js` to:
- Fetch all creates from July 16 onwards
- Process them with correct field mapping
- Merge with existing data without duplicates

### 4. Added Monitoring
Created `scripts/monitor-data-health.js` to detect:
- Stale data (not updated recently)
- Large gaps in event timestamps
- Missing reward pool data
- LP positions with zero amounts

## Results
- Successfully recovered 81 missing creates
- Now showing 56 creates ending after day 94 (vs 1 before)
- Data gaps reduced from 6 days to normal intervals

## Prevention

### Development Standards Applied:
1. **Use Existing Code**: Leverage existing `ethersWeb3.ts` instead of duplicating
2. **Verify Against Source**: Always check actual contract ABI
3. **Add Monitoring**: Detect issues before users report them
4. **Test Thoroughly**: Verify data after changes
5. **Document Everything**: Clear documentation for future reference

### Monitoring Recommendations:
- Run `monitor-data-health.js` daily
- Alert if no creates for >48 hours
- Check for data gaps >24 hours
- Verify event counts are increasing

## Testing the Fix

### Verify Creates are Being Fetched:
```bash
# Check recent creates
node -e "
const data = require('./public/data/cached-data.json');
const recent = data.stakingData.createEvents.slice(-10);
recent.forEach(c => {
  const d = new Date(c.timestamp * 1000);
  console.log(d.toISOString(), '-', (c.torusAmount/1e18).toFixed(2), 'TORUS');
});
"
```

### Run Health Check:
```bash
node scripts/monitor-data-health.js
```

## Lessons Learned

1. **Contract Integration**: Always verify event signatures against deployed contract
2. **Data Validation**: Implement checks to detect missing data early
3. **Incremental Updates**: Ensure they actually fetch new events
4. **Testing**: Test with real blockchain data, not just cached data
5. **Monitoring**: Proactive monitoring prevents user-reported issues

## Additional Improvements Made

### Code Quality:
- Added proper error handling with retries
- Implemented rate limiting for RPC calls
- Added transaction-like updates (all or nothing)
- Created reusable monitoring tools

### Documentation:
- Clear inline comments
- Script purpose headers
- Usage examples
- Troubleshooting guides

This fix ensures the dashboard now accurately reflects all on-chain create activity and prevents similar issues in the future.