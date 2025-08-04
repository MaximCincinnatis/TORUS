# Protocol Day Assignment Fix Plan

## The Problem
Burns are being grouped by UTC calendar date (YYYY-MM-DD) instead of protocol day boundaries (6PM UTC).

## Simple & Accurate Solution

### 1. Create a Shared Utility Function
Create `scripts/shared/protocolDayHelper.js`:
```javascript
const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');

/**
 * Get the protocol day for a given timestamp
 * Protocol days start at 6PM UTC
 * @param {number} timestampSeconds - Unix timestamp in seconds
 * @returns {number} Protocol day (1-based)
 */
function getProtocolDayFromTimestamp(timestampSeconds) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const eventTime = new Date(timestampSeconds * 1000);
  const timeSinceStart = eventTime.getTime() - CONTRACT_START_DATE.getTime();
  return Math.floor(timeSinceStart / msPerDay) + 1;
}

/**
 * Get the date key (YYYY-MM-DD) for a protocol day
 * Used for maintaining backward compatibility with existing data structure
 * @param {number} protocolDay - Protocol day (1-based)
 * @returns {string} Date in YYYY-MM-DD format
 */
function getDateKeyForProtocolDay(protocolDay) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const dayStart = new Date(CONTRACT_START_DATE.getTime() + ((protocolDay - 1) * msPerDay));
  return dayStart.toISOString().split('T')[0];
}

module.exports = {
  getProtocolDayFromTimestamp,
  getDateKeyForProtocolDay,
  CONTRACT_START_DATE
};
```

### 2. Update the Scripts

#### For `update-buy-process-data.js`:
Replace the date grouping logic with:
```javascript
const { getProtocolDayFromTimestamp, getDateKeyForProtocolDay } = require('./shared/protocolDayHelper');

// When processing events:
for (const transfer of newBurnTransfers) {
  const timestamp = blockTimestamps.get(transfer.blockNumber);
  const protocolDay = getProtocolDayFromTimestamp(timestamp);
  const dateKey = getDateKeyForProtocolDay(protocolDay);
  
  if (!burnsByDate[dateKey]) {
    burnsByDate[dateKey] = ethers.BigNumber.from(0);
  }
  burnsByDate[dateKey] = burnsByDate[dateKey].add(transfer.args.value);
}
```

#### For incremental updates:
Same approach - use protocol day to determine the correct date key.

### 3. One-Time Data Correction Script
Create `scripts/fix-protocol-day-assignment.js`:
```javascript
// This script will:
// 1. Load current buy-process-data.json
// 2. Re-fetch all events with proper timestamps
// 3. Reassign burns to correct protocol days
// 4. Preserve all other data (event counts, totals)
// 5. Create backup before modifying
```

### 4. Key Benefits of This Approach

1. **Simple**: One source of truth for protocol day calculation
2. **Accurate**: Uses exact 6PM UTC boundaries
3. **Compatible**: Maintains existing data structure (date keys)
4. **Safe**: No complex date parsing or timezone issues
5. **Testable**: Easy to unit test the helper functions
6. **Maintainable**: Clear, documented functions

### 5. Migration Strategy

1. **Test First**: Create unit tests for the helper functions
2. **Backup**: Always backup existing data before corrections
3. **Verify**: Run verification script to ensure corrections match on-chain
4. **Deploy**: Update both scripts simultaneously
5. **Monitor**: Watch first few updates to ensure accuracy

### 6. Why This Leaves Code Better

- Removes duplicate date calculation logic
- Single source of truth for protocol days
- Clear separation of concerns
- Better documentation
- Easier to test and maintain
- No more protocol day misalignment issues

## Implementation Order

1. Create and test the shared helper module
2. Create the one-time correction script
3. Run correction with verification
4. Update both update scripts to use the helper
5. Deploy and monitor

This approach ensures 100% accuracy while keeping changes minimal and maintainable.