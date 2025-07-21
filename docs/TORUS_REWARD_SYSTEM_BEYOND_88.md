# TORUS Reward System Beyond Day 88

## Key Findings

### 1. Contract Runs Indefinitely
The TORUS contract does NOT stop at day 88 - it continues running indefinitely. Day 88 is only the end of the initial reward distribution period.

### 2. Reward Sources After Day 88

#### Initial Rewards (Days 1-88 Only)
- Start: 100,000 TORUS on day 1
- Daily reduction: 0.08% (80 basis points)
- End: ~93,274 TORUS on day 88
- **Day 89+: 0 TORUS base rewards**

#### Penalty Pools (Continue Forever)
After day 88, reward pools can still receive TORUS from:

1. **Early Unstaking Penalties**
   - Users can unstake early after completing 50% of their stake duration
   - Formula: `((PercentageCompleted - 50) * 2) = ClaimableRewards%`
   - Forfeited rewards go to the penalty pool
   - Example: Unstaking at 75% complete = claim 50% of rewards, forfeit 50%

2. **Late Claim Penalties**
   - Stakes have a grace period for claiming after maturity
   - Claims after the grace period incur penalties
   - Penalties are proportional to days late (capped at PENALTY_DAYS)
   - 50% of late claim penalties go to the reward pool

3. **Distribution of Penalties**
   - Penalties collected on any day are added to `penaltiesInRewardPool[day]`
   - Active stakes on that day share these penalties proportional to their shares
   - This creates ongoing rewards even after day 88

### 3. Staking Duration Limits

- **Minimum**: 1 day
- **Maximum**: 88 days
- **No limit on when to stake**: Users can create new stakes on day 100, 200, etc.
- **Positions mature based on**: Start day + staking duration

### 4. Example Scenarios

#### Scenario A: Stake Created on Day 50
- 88-day stake created on day 50
- Earns base rewards from days 50-88 (39 days)
- Earns penalty pool rewards from days 50-138
- Matures on day 138

#### Scenario B: Stake Created on Day 100
- 88-day stake created on day 100
- Earns NO base rewards (past day 88)
- Earns ONLY penalty pool rewards from days 100-188
- Matures on day 188

#### Scenario C: Early Unstake on Day 120
- Someone unstakes early on day 120
- Their forfeited rewards go into day 120's penalty pool
- All active stakes on day 120 share these penalties

### 5. Implications for Dashboard

1. **Reward Calculations Must Include**:
   - Base rewards (days 1-88 only)
   - Penalty pool rewards (all days)
   - Total reward = base + penalties

2. **Future Projections Should Show**:
   - Declining base rewards until day 88
   - Potential penalty rewards after day 88 (harder to predict)
   - Active positions that can claim penalties

3. **Data Requirements**:
   - Need to fetch `penaltiesInRewardPool(day)` for all days
   - Track when penalties are added to pools
   - Calculate share percentages including penalty distributions

### 6. Current Dashboard Limitations

1. **Missing Penalty Data**: Currently showing 0 penalties for all days
2. **Stops at Day 88**: Charts don't show activity beyond day 88
3. **Incomplete Projections**: Not accounting for penalty-based rewards

### 7. Recommended Updates

1. **Extend Data Collection**:
   ```javascript
   // Fetch penalties for all days up to current
   for (let day = 1; day <= currentDay; day++) {
     const penalties = await contract.penaltiesInRewardPool(day);
     // Store penalty data
   }
   ```

2. **Update Reward Calculations**:
   ```javascript
   const calculateDailyReward = (position, day, rewardPoolData) => {
     const dayData = rewardPoolData[day];
     const baseReward = day <= 88 ? dayData.rewardPool : 0;
     const penaltyReward = dayData.penaltiesInPool || 0;
     const totalPool = baseReward + penaltyReward;
     
     const sharePercentage = position.shares / dayData.totalShares;
     return totalPool * sharePercentage;
   };
   ```

3. **Extend Chart Timeline**:
   - Show projections beyond day 88
   - Include penalty pool distributions
   - Mark day 88 as "end of base rewards" not "end of program"

## Conclusion

The TORUS reward system is designed for long-term operation with two phases:
1. **Days 1-88**: Base rewards + any penalties
2. **Days 89+**: Penalty rewards only

This creates ongoing incentives for staking even after the initial 88-day period, as early unstakers and late claimers continue to feed the reward pools.