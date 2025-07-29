# TORUS Dashboard - Scripts That Update cached-data.json Analysis

## Executive Summary

I've identified all scripts that update or modify the `cached-data.json` file and analyzed their data handling patterns, merge strategies, and duplicate risks. This analysis reveals both proper incremental update patterns and several scripts that could introduce duplicates or data loss.

## Critical Findings

### **⚠️ HIGH RISK - Data Loss Scripts**

#### 1. `/scripts/data-updates/update-all-dashboard-data.js` (Line 1100)
- **Issue**: Completely overwrites `lpPositions` array instead of merging
- **Risk**: Loses existing LP position data during full rebuilds
- **Code**: `cachedData.lpPositions = safeMergeLPPositions(lpPositions, cachedData.lpPositions)`
- **Impact**: Historical LP position data can be lost if not found in current scan

#### 2. `smart-update.js` (Lines 153-155)
- **Issue**: Falls back to full update script when detecting significant changes
- **Risk**: Triggers the problematic full rebuild above
- **Code**: `execSync('node scripts/data-updates/update-all-dashboard-data.js')`

### **✅ SAFE - Proper Incremental Patterns**

#### 1. `smart-update-fixed.js` (Lines 915-924)
- **Good**: Merges arrays with deduplication
- **Pattern**: `[...existingStakes, ...uniqueNewStakes]`
- **Deduplication**: Uses event keys to prevent duplicates

#### 2. `src/utils/incrementalUpdater.ts` (Lines 260-268)
- **Good**: Appends new events without replacing existing
- **Pattern**: Incremental merge with metadata tracking

#### 3. `incremental-lp-updater.js` (Lines 257-264)
- **Good**: Preserves existing position data during updates
- **Pattern**: Uses Map to merge positions, preserves manual overrides

## Complete Script Inventory

### **Smart Update Scripts**
1. **`smart-update.js`** - Original smart updater (⚠️ Falls back to problematic full update)
2. **`smart-update-fixed.js`** - Fixed version with proper data preservation (✅ Safe)
3. **`smart-update-enhanced.js`** - Enhanced version with additional features
4. **`auto-update-fixed.js`** - Automated scheduler for smart updates

### **Full Rebuild Scripts**
1. **`scripts/data-updates/update-all-dashboard-data.js`** - Main full rebuild (⚠️ LP overwrite risk)
2. **`scripts/data-updates/update-all-dashboard-data-complete.js`** - Complete version
3. **`scripts/data-updates/update-dashboard-data.js`** - Alternative full update
4. **`scripts/data-updates/update-json-with-real-data.js`** - Real data fetcher

### **Incremental Update Utilities**
1. **`src/utils/incrementalUpdater.ts`** - TypeScript incremental updater (✅ Safe)
2. **`incremental-lp-updater.js`** - LP position incremental updater (✅ Safe)
3. **`scripts/enhanced-incremental-lp-update.js`** - Enhanced LP updater

### **Event Fetching Scripts**
1. **`comprehensive-payment-matching.js`** - Payment data matcher for events
2. **`scripts/update-create-costs.js`** - Updates create event costs
3. **`scripts/update-buy-process-data.js`** - Buy & Process event updater

### **Specialized Update Scripts**
1. **`scripts/generate-future-supply-projection.js`** - Supply projection updates
2. **`update-cache-with-real-data.js`** - Real blockchain data updater
3. **`scripts/update-burns-from-transfers.js`** - Burn data updater

## Data Merging Patterns Analysis

### **✅ Safe Patterns**

#### 1. Incremental Array Merging
```javascript
// Good: Deduplicates and appends
const uniqueNewStakes = processedStakes.filter(stake => {
  const key = `${stake.user}-${stake.id}-${stake.blockNumber}`;
  if (stakeKeys.has(key)) return false;
  stakeKeys.add(key);
  return true;
});

cachedData.stakingData.stakeEvents = [
  ...existingStakes,
  ...uniqueNewStakes
];
```

#### 2. Map-Based Position Merging
```javascript
// Good: Preserves existing data, updates changed fields
const updatedPosition = {
  ...existingPos,
  ...newData,
  manualData: position.manualData, // Preserve manual overrides
  customNotes: position.customNotes
};
```

#### 3. Metadata Tracking
```javascript
// Good: Tracks update progress
cachedData.stakingData.metadata.currentBlock = currentBlock;
cachedData.stakingData.metadata.lastIncrementalUpdate = new Date().toISOString();
```

### **⚠️ Risky Patterns**

#### 1. Array Replacement
```javascript
// BAD: Completely replaces existing data
cachedData.lpPositions = newPositions; // LOSES EXISTING DATA
```

#### 2. Full Rebuild Without Merge
```javascript
// BAD: Rebuilds from scratch
const data = buildFromBlockchain(); // IGNORES EXISTING CACHE
cachedData = data; // OVERWRITES EVERYTHING
```

#### 3. Missing Deduplication
```javascript
// BAD: No duplicate checking
allEvents.push(...newEvents); // CAN CREATE DUPLICATES
```

## Duplicate Risk Assessment

### **High Risk Scenarios**

1. **Smart Update → Full Update Fallback**
   - `smart-update.js` triggers full rebuild when detecting >5 new LP positions
   - Full rebuild overwrites LP positions instead of merging
   - **Result**: Loss of existing LP position data

2. **Manual Script Execution**
   - Running `update-all-dashboard-data.js` directly
   - No merge with existing cached data
   - **Result**: Complete data replacement

3. **Concurrent Updates**
   - Multiple scripts running simultaneously
   - Race conditions on file writes
   - **Result**: Data corruption or partial updates

### **Low Risk Scenarios**

1. **Incremental Updates Only**
   - Using `smart-update-fixed.js` with proper deduplication
   - Incremental LP position updates
   - **Result**: Safe data accumulation

2. **Event-Based Updates**
   - Processing only new events since last block
   - Proper duplicate key checking
   - **Result**: Clean incremental growth

## Recommendations

### **Immediate Actions**

1. **Fix LP Position Merge in Full Update**
   ```javascript
   // Replace line 1100 in update-all-dashboard-data.js
   // FROM:
   cachedData.lpPositions = lpPositions;
   
   // TO:
   cachedData.lpPositions = mergeLPPositions(cachedData.lpPositions, lpPositions);
   ```

2. **Update Smart Update Fallback**
   ```javascript
   // In smart-update.js, replace full update trigger
   // Consider incremental LP update instead of full rebuild
   ```

3. **Standardize on Safe Scripts**
   - Use `smart-update-fixed.js` as primary updater
   - Use `incremental-lp-updater.js` for LP-specific updates
   - Avoid direct execution of full rebuild scripts

### **Long-term Improvements**

1. **Implement Update Locks**
   - Prevent concurrent script execution
   - Use file-based or memory-based locks

2. **Add Data Validation**
   - Verify data integrity before/after updates
   - Rollback on validation failures

3. **Create Update Orchestrator**
   - Single script that coordinates all updates
   - Proper sequencing and dependency management

4. **Enhance Backup Strategy**
   - Automatic backups before major updates
   - Versioned backup retention

## Script Usage Guidelines

### **Primary Update Scripts (Use These)**
- `smart-update-fixed.js` - Main incremental updater
- `incremental-lp-updater.js` - LP position updates
- `src/utils/incrementalUpdater.ts` - TypeScript incremental updates

### **Dangerous Scripts (Use With Caution)**
- `scripts/data-updates/update-all-dashboard-data.js` - Can lose LP data
- `smart-update.js` - Falls back to dangerous full update

### **Emergency Recovery Scripts**
- `fix-stake-duplicates.js` - Removes duplicate stake events
- Backup files in `public/data/backups/` - For data recovery

## Conclusion

The TORUS Dashboard has both safe incremental update patterns and risky full rebuild scripts. The main risks are:

1. **LP Position Data Loss** in full rebuild scripts
2. **Event Duplication** when scripts run without proper deduplication
3. **Race Conditions** from concurrent script execution

By following the recommended safe scripts and fixing the identified issues, the data integrity can be maintained while enabling reliable automated updates.