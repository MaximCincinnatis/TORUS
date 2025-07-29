# Buy & Build Contract ETH Usage Analysis

## Contract Analysis: How ETH is Used in Buy & Build Operations

Based on examination of the Buy & Process contract at `0xaa390a37006e22b5775a34f2147f81ebd6a63641`, here's exactly how ETH flows through Buy & Build operations:

### The Complete ETH Flow

#### 1. ETH Entry Point
ETH enters the contract via the `distributeETHForBuilding()` function:
```solidity
function distributeETHForBuilding() external payable {
    if (msg.value == 0) revert InvalidInput();
    totalETHForBuild += msg.value;  // Accumulates ETH for future builds
}
```

#### 2. Interval-Based Allocation System
The contract uses an interval-based system to allocate ETH:
- ETH is accumulated in `totalETHForBuild` pool
- Each interval (daily), a portion is allocated based on `DAILY_ALLOCATION_ETH_BUILDING`
- Allocated amounts are stored in `IntervalBuild` structs with `amountAllocated` and `amountBurned` fields

#### 3. Buy & Build Execution (`swapETHForTorusAndBuild`)
When Buy & Build is triggered (function selector `0x53ad9b96`):

```solidity
function swapETHForTorusAndBuild(uint32 _deadline) external nonReentrant buildETHIntervalUpdate {
    // Get allocated ETH from current interval
    IntervalBuild storage currInterval = ethIntervalsBuild[lastETHBuildIntervalNumber];
    
    // Calculate incentive (5% of allocated amount)
    uint256 incentive = (currInterval.amountAllocated * INCENTIVE_FEE_BUILD) / BPS_DENOM;
    
    // ETH actually used for build = allocated - incentive
    uint256 ethToSwapAndBuild = currInterval.amountAllocated - incentive;
    
    // Swap ETH for TitanX via Uniswap V3
    uint256 titanXAmount = _swapETHForTitanX(ethToSwapAndBuild, _deadline);
    
    // Update tracking variables
    totalETHBuilt += ethToSwapAndBuild;
    totalETHForBuild -= ethToSwapAndBuild + incentive;
    ethUsedForBuilds += ethToSwapAndBuild;  // THIS IS WHAT WE TRACK
    
    // Split TitanX: half swapped for TORUS, half added to liquidity
    uint256 half = titanXAmount / 2;
    uint256 remainder = titanXAmount - half;
    uint256 torusPurchased = _swapTitanXForTorus(half, _deadline);
    
    _addLiquidityBuild(remainder, torusPurchased, _deadline);
    
    // Pay incentive to caller
    payable(msg.sender).call{value: incentive}("");
    
    emit BuyAndBuild(ethToSwapAndBuild, torusPurchased, msg.sender);
}
```

#### 4. ETH-to-TitanX Swap Details
The `_swapETHForTitanX` function:
- Uses Uniswap V3 Router's `exactInput` method
- Swap path: ETH → WETH → TitanX (with pool fee)
- Applies slippage protection (default 10%)
- **Consumes the entire input ETH amount** - no refunds

### What "ethUsedForBuilds" Actually Represents

**`ethUsedForBuilds` = The exact amount of ETH swapped for TitanX in each build operation**

This is:
- ✅ The ETH allocated from the interval system
- ✅ After deducting the 5% caller incentive
- ✅ The amount actually sent to Uniswap for TitanX purchase
- ✅ The "real" ETH cost of the build operation

This is NOT:
- ❌ The transaction value (`msg.value` is 0 for this function)
- ❌ The total ETH sent to `distributeETHForBuilding`
- ❌ Including the caller incentive

### How the Dashboard Currently Tracks This

Looking at `/scripts/update-buy-process-data.js`, the current implementation:

```javascript
// Process Buy & Build events
for (const event of newBuyAndBuildEvents) {
    const tx = await provider.getTransaction(event.transactionHash);
    const functionSelector = tx.data.slice(0, 10);
    
    if (functionSelector === '0x53ad9b96') {
        // ETH build - check transaction value
        if (tx.value && !tx.value.isZero()) {
            const ethAmount = parseFloat(ethers.utils.formatEther(tx.value));
            newDailyData[dateKey].ethUsedForBuilds += ethAmount;
        }
    }
}
```

### THE PROBLEM: Dashboard is Measuring the Wrong Thing

**Current Approach**: Uses `tx.value` from the transaction
**Issue**: `swapETHForTorusAndBuild` is NOT a payable function - `tx.value` is always 0

**Correct Approach**: Extract the actual ETH amount from the `BuyAndBuild` event

The `BuyAndBuild` event is emitted as:
```solidity
emit BuyAndBuild(ethToSwapAndBuild, torusPurchased, msg.sender);
```

Where:
- `ethToSwapAndBuild` = the actual ETH used for the build
- `torusPurchased` = TORUS tokens acquired

### How to Fix the Dashboard

The dashboard should extract ETH amounts from the `BuyAndBuild` event's first parameter (`tokenAllocated`), which represents the ETH amount used for the build operation.

```javascript
// Correct approach:
const ethAmount = parseFloat(ethers.utils.formatEther(event.args.tokenAllocated));
newDailyData[dateKey].ethUsedForBuilds += ethAmount;
```

### Summary

1. **ETH Source**: Accumulated via `distributeETHForBuilding()` calls
2. **ETH Allocation**: Interval-based system allocates daily amounts
3. **ETH Usage**: Build operations consume allocated ETH (minus 5% incentive)
4. **ETH Measurement**: The first parameter of `BuyAndBuild` events contains the exact ETH amount
5. **Current Bug**: Dashboard incorrectly uses `tx.value` which is always 0 for this function
6. **Fix**: Use `event.args.tokenAllocated` from `BuyAndBuild` events

The contract tracks the exact ETH consumption internally via `ethUsedForBuilds += ethToSwapAndBuild`, and this same value is emitted in the `BuyAndBuild` event for external tracking.