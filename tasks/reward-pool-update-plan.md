# Plan: Update Scripts to Fetch Reward Pool Data

## Current State Analysis

### Problems Identified
1. **Data Gap**: Reward pool data only covers days 1-8, missing days 9-88
2. **Script Issues**: Update scripts fetch only future days, missing historical data
3. **No Validation**: No checks to ensure reward pool data completeness
4. **Multiple Scripts**: 19+ update scripts with overlapping functionality

### Existing Infrastructure
- Contract: `0xc7cc775b21f9df85e043c7fdd9dac60af0b69507`
- Functions available:
  - `getCurrentDayIndex()` - Current protocol day
  - `rewardPool(uint24 day)` - Reward amount for specific day
  - `totalShares(uint24 day)` - Total shares for specific day
  - `penaltiesInRewardPool(uint24 day)` - Penalties accumulated

## Proposed Implementation Plan

### Phase 1: Create Centralized Reward Pool Module (Day 1)

#### 1.1 Create `src/utils/rewardPoolManager.js`
```javascript
// Centralized module for all reward pool operations
module.exports = {
  fetchRewardPoolData,      // Fetch from blockchain
  validateRewardPoolData,   // Ensure data completeness
  mergeRewardPoolData,      // Merge with existing data
  calculateDailyRewards     // Calculate rewards for positions
};
```

#### 1.2 Key Features
- **Rate limiting**: Prevent RPC overload
- **Retry logic**: Handle network failures
- **Batch fetching**: Optimize blockchain calls
- **Data validation**: Ensure all 88 days present
- **Caching**: Avoid redundant blockchain calls

### Phase 2: Implement Fetching Logic (Day 2)

#### 2.1 Historical Data Fetcher
```javascript
async function fetchHistoricalRewardPools(provider, contract, fromDay, toDay) {
  // Fetch in batches of 10 days to avoid timeouts
  // Include proper error handling and retries
  // Return validated data structure
}
```

#### 2.2 Current State Fetcher
```javascript
async function fetchCurrentRewardState(provider, contract) {
  // Get current protocol day
  // Fetch active reward pools
  // Include penalties and total shares
}
```

### Phase 3: Update Existing Scripts (Day 3)

#### 3.1 Modify Core Update Scripts
1. **`update-all-dashboard-data.js`**
   - Import rewardPoolManager
   - Replace inline fetching with module calls
   - Add validation before saving

2. **`smart-update.js`**
   - Use incremental reward pool updates
   - Only fetch changed days

#### 3.2 Create Migration Script
```javascript
// scripts/migrate-reward-pools.js
// One-time script to fetch all historical data
// Validates against contract formula
// Creates backup before updating
```

### Phase 4: Add Validation & Testing (Day 4)

#### 4.1 Validation Rules
```javascript
const RewardPoolValidation = {
  // Day 1 must be 100,000 TORUS
  validateInitialPool: (data) => data[0].rewardPool === 100000,
  
  // Each day reduces by 0.08%
  validateDailyReduction: (data) => {
    // Check mathematical progression
  },
  
  // Must have exactly 88 days with rewards
  validateDuration: (data) => {
    // Days 1-88 have rewards > 0
    // Days 89+ have rewards = 0
  }
};
```

#### 4.2 Test Suite
```javascript
// tests/rewardPoolTests.js
describe('Reward Pool Data', () => {
  test('fetches complete historical data');
  test('validates mathematical formula');
  test('handles network failures gracefully');
  test('merges data without loss');
});
```

### Phase 5: Monitoring & Maintenance (Day 5)

#### 5.1 Health Checks
```javascript
// utils/rewardPoolHealth.js
async function checkRewardPoolHealth() {
  // Verify data completeness
  // Check for anomalies
  // Alert if issues found
}
```

#### 5.2 Automated Validation
- Add to CI/CD pipeline
- Run health checks after each update
- Log detailed metrics

## Implementation Steps

### Step 1: Create Module Structure
```bash
src/
  utils/
    rewardPoolManager.js     # Core module
    rewardPoolValidator.js   # Validation logic
    rewardPoolTypes.ts       # TypeScript types
scripts/
  reward-pools/
    fetch-historical.js      # One-time historical fetch
    validate-rewards.js      # Validation script
tests/
  reward-pools/
    rewardPool.test.js       # Unit tests
```

### Step 2: Implement Core Functions
1. Start with read-only operations
2. Add extensive logging
3. Test with small date ranges
4. Gradually expand coverage

### Step 3: Integration
1. Update one script at a time
2. Run in parallel with existing code
3. Compare results before switching
4. Maintain backward compatibility

## Best Practices Applied

### 1. **Single Responsibility**
- One module handles all reward pool logic
- Clear separation of concerns

### 2. **DRY (Don't Repeat Yourself)**
- Centralized fetching logic
- Reusable validation functions

### 3. **Fail-Safe Design**
- Never overwrite without validation
- Always create backups
- Graceful degradation on errors

### 4. **Incremental Migration**
- Update scripts one at a time
- Maintain working system throughout
- Easy rollback if needed

### 5. **Comprehensive Testing**
- Unit tests for each function
- Integration tests for full flow
- Performance tests for large datasets

### 6. **Documentation**
- Clear function documentation
- Usage examples
- Troubleshooting guide

## Risk Mitigation

### Potential Risks
1. **Data Loss**: Mitigated by backups and validation
2. **Network Issues**: Handled by retry logic and caching
3. **Contract Changes**: Abstract contract interface
4. **Performance**: Batch operations and rate limiting

### Rollback Plan
1. Keep backup of current working data
2. Feature flag for new implementation
3. Parallel run before full switch
4. One-click revert capability

## Success Criteria

### Must Have
- ✅ All 88 days of reward pool data fetched
- ✅ Data validates against contract formula
- ✅ No data loss during updates
- ✅ Charts show green reward bars

### Nice to Have
- ⭐ Real-time reward updates
- ⭐ Historical reward tracking
- ⭐ Penalty pool visualization
- ⭐ Performance metrics dashboard

## Timeline

- **Day 1**: Module structure and interfaces
- **Day 2**: Core fetching implementation
- **Day 3**: Script integration
- **Day 4**: Testing and validation
- **Day 5**: Deployment and monitoring

## Next Steps

1. Review and approve this plan
2. Create module structure
3. Begin implementation with historical fetcher
4. Test with small date ranges
5. Gradually roll out to all scripts

This plan ensures we fix the reward pool issue systematically while maintaining system stability and following best development practices.