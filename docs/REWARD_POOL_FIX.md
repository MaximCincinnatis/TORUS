# TORUS Reward Pool Data Fix Documentation

## Issue Identified
The TORUS Release Schedule with Accrued Rewards chart was showing no green bars (rewards) after day 93 because the reward pool data was incorrectly set to 0 after day 8.

## Root Cause
The cached reward pool data only contained valid values for days 1-8, with days 9-96 showing 0 reward pool. This prevented any reward calculations for positions maturing after day 8.

## Solution Implemented

### 1. Reward Pool Formula
According to the TORUS contract, the reward pool follows this pattern:
- **Initial Pool**: 100,000 TORUS on day 1
- **Daily Reduction**: 0.08% (80 basis points)
- **Duration**: 88 days total
- **Formula**: `nextPool = previousPool * (1 - 0.0008)`

### 2. Fix Applied
Created `fix-reward-pool-data.js` which:
- Calculates correct reward pool values for all 88 days
- Preserves existing totalShares and penalties data
- Sets reward pool to 0 for days after 88 (as per contract design)

### 3. Expected Results
- Days 1-88: Show both principal (purple) and accrued rewards (green) bars
- Days 89+: Show only principal (no rewards available after day 88)

## Verification
After running the fix:
- Day 1: 100,000 TORUS reward pool
- Day 88: 93,274 TORUS reward pool
- Day 89+: 0 TORUS reward pool

## Update Scripts Need Enhancement
The data update scripts should be modified to:
1. Fetch reward pool data directly from the blockchain
2. Use the contract functions:
   - `rewardPool(uint24 day)`
   - `totalShares(uint24 day)`
   - `penaltiesInRewardPool(uint24 day)`
3. Ensure all 88 days are fetched, not just future days

## Testing Checklist
- [ ] Verify green bars appear on the chart for days 1-88
- [ ] Confirm no green bars after day 88
- [ ] Check that reward amounts are proportional to shares
- [ ] Validate total rewards match expected calculations

## Development Standards Applied
1. **Data Backup**: Created timestamped backup before modifying data
2. **Documentation**: Created this file to track changes
3. **Validation**: Script verifies the fix was applied correctly
4. **Clear Logging**: Shows progress and results during execution
5. **Mathematical Accuracy**: Uses exact contract formula