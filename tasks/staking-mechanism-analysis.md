# TORUS Staking Mechanism Analysis

## Overview
When users stake TORUS tokens, they must ALWAYS pay a fee in EITHER ETH or TitanX. This is a critical aspect of the staking mechanism that affects the actual cost of staking.

## How stakeTorus Works

### Function Parameters
- `torusAmount` (uint256): The amount of TORUS tokens to stake
- `stakingDays` (uint24): The duration of the stake (1-88 days)

### Fee Calculation
The fee is calculated based on:
1. The amount of TORUS being staked
2. The staking duration
3. The current difficulty factor

```solidity
// Simplified fee calculation
partialForLength = (BASE_FOR_88_DAYS_100_POWER_DAY1 * stakingDays) / 88
difficulty = getDifficultyFactor()
partialForPower = (torusAmount * difficulty)
power = (partialForPower * 100) / partialForLength
costTitanX = (COST_100_POWER_TITANX * power) / (100 * 20 * 1e18) // 5% fee
```

### Payment Methods

#### Option 1: Pay with ETH
- User sends ETH along with the stakeTorus transaction
- The contract calculates how much ETH is needed for the TitanX fee
- ETH is distributed to:
  - Genesis wallet
  - Burning mechanism
  - Building fund
  - TitanX purchase and burn
- Any excess ETH is refunded

#### Option 2: Pay with TitanX
- User must have TitanX tokens approved for the contract
- TitanX is transferred from user to contract
- TitanX is distributed to:
  - Genesis wallet
  - Burning mechanism
  - Building fund
  - Direct TitanX burn

## Important Implications

1. **Actual Cost**: The cost to stake TORUS is not just the TORUS tokens themselves, but also the fee paid in ETH or TitanX

2. **No Free Staking**: Unlike some staking systems where you only lock tokens, TORUS staking ALWAYS requires an additional fee payment

3. **Fee Distribution**: The fees support the ecosystem through:
   - Genesis wallet funding
   - Token burning (deflationary mechanism)
   - Building fund for development
   - TitanX burning (supporting TitanX ecosystem)

## Dashboard Considerations

The dashboard should:
1. Show the actual cost of staking (TORUS + fees)
2. Track ETH/TitanX fees paid per stake
3. Calculate true ROI including fee costs
4. Display fee distribution metrics

## Verification
This mechanism can be verified by:
1. Looking at stakeTorus transactions on Etherscan - they always have either ETH value or TitanX transfers
2. Reviewing the contract code's _distributeFees function
3. Analyzing the fee calculation logic