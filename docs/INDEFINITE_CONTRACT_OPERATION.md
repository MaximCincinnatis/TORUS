# TORUS Contract - Indefinite Operation

## Critical Understanding: The Contract Runs Forever

The TORUS staking contract operates **indefinitely**, not just for 88 days. This is a fundamental aspect that affects all dashboard calculations and projections.

## Reward System Timeline

### Days 1-88: Initial Distribution Period
- **Base Rewards**: Start at 100,000 TORUS, decrease by 0.08% daily
- **Penalty Rewards**: From early unstakes and late claims
- **Total Daily Pool**: Base Rewards + Penalties

### Days 89+: Penalty-Only Period (Forever)
- **Base Rewards**: 0 (distribution period ended)
- **Penalty Rewards**: Continue from user actions
- **Total Daily Pool**: Penalties only

## Sources of Penalties After Day 88

### 1. Early Unstaking Penalties
- Users can unstake after 50% completion
- Forfeited rewards feed the penalty pool
- Example: 88-day stake unstaked on day 66 (75% complete)
  - User claims: 50% of earned rewards
  - Penalty pool receives: 50% of earned rewards

### 2. Late Claim Penalties
- Stakes have grace periods after maturity
- Late claims incur increasing penalties
- 50% of late penalties feed reward pools

### 3. Other Protocol Penalties
- Failed transactions
- Protocol violations
- Special events

## Implications for Dashboard

### Current Issues
1. ❌ Only showing data for days 1-96
2. ❌ Assuming 0 rewards after day 88
3. ❌ Not fetching penalty data from blockchain
4. ❌ Charts cut off at day 96

### Required Changes
1. ✅ Extend data arrays to current day + 365 (minimum)
2. ✅ Fetch penalty pool data for all days
3. ✅ Calculate rewards as: base (if ≤88) + penalties
4. ✅ Update charts to show indefinite timeline
5. ✅ Show that staking continues forever

## Example Scenarios

### Stake Created on Day 100 (After Initial Period)
```
Duration: 30 days
Base Rewards: 0 (past day 88)
Penalty Rewards: Share of any penalties on days 100-130
Total Rewards: Only from penalties
```

### Stake Created on Day 50 (During Initial Period)
```
Duration: 88 days (ends on day 138)
Base Rewards: Share of base rewards for days 50-88
Penalty Rewards: Share of penalties for days 50-138
Total Rewards: Base (days 50-88) + Penalties (days 50-138)
```

## Update Script Requirements

```javascript
// Fetch data for ANY day, not just 1-88
async function fetchRewardData(day) {
  const [baseReward, penalties, totalShares] = await Promise.all([
    contract.rewardPool(day),        // 0 after day 88
    contract.penaltiesInRewardPool(day), // Can be non-zero forever
    contract.totalShares(day)        // Active stakes on this day
  ]);
  
  return {
    day,
    baseReward: day <= 88 ? baseReward : 0,
    penalties,
    totalReward: baseReward + penalties,
    totalShares
  };
}
```

## Chart Display Requirements

1. **X-axis**: Should extend well beyond day 88
2. **Y-axis**: Show both base rewards and penalties
3. **Legend**: Distinguish base rewards (days 1-88) from penalties (all days)
4. **Projections**: Account for ongoing penalty accumulation

## Testing Checklist

- [ ] Verify data exists for days beyond 88
- [ ] Confirm penalty data is being fetched
- [ ] Check that positions can calculate rewards for any day
- [ ] Ensure charts display full timeline
- [ ] Validate projections account for penalties

## Key Takeaway

**The TORUS protocol is designed to run forever.** Day 88 is not an endpoint—it's merely the end of the initial base reward distribution. The protocol continues indefinitely with penalty-based rewards, creating a self-sustaining ecosystem where user actions continuously feed the reward pools.

This fundamental understanding must be reflected in all dashboard components, calculations, and user interfaces.