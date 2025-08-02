# ETH Build Functions Audit Report - Buy & Process Contract

## Contract Address
`0xaa390a37006e22b5775a34f2147f81ebd6a63641`

## Critical Finding
The dashboard is missing ETH builds from the `distributeETHForBuilding()` function, which explains why days 19-21 show 0 ETH used for builds despite having multiple BuyAndBuild events.

## All ETH-Related Functions

### 1. swapETHForTorusAndBuild(uint32 _deadline)
- **Function Selector**: `0x53ad9b96`
- **Type**: Payable
- **Purpose**: Swaps ETH for TitanX, then half for Torus, and adds liquidity
- **Emits**: BuyAndBuild event
- **Current Status**: ✅ TRACKED in dashboard

### 2. distributeETHForBuilding()
- **Function Selector**: `0xc381da4f`
- **Type**: Payable
- **Purpose**: Accepts ETH deposits for the building flow
- **Emits**: No direct event, but ETH is accumulated for later building
- **Current Status**: ❌ NOT TRACKED in dashboard

### 3. distributeETHForBurning()
- **Function Selector**: `0xe3221eb5`
- **Type**: Payable
- **Purpose**: Accepts ETH deposits for the burning flow
- **Emits**: No direct event, but ETH is accumulated for later burning
- **Current Status**: Unknown (need to verify)

### 4. swapETHForTorusAndBurn(uint32 _deadline)
- **Function Selector**: `0x39b6ce64`
- **Type**: Payable
- **Purpose**: Swaps ETH for TitanX, then for Torus, and burns
- **Emits**: BuyAndBurn event
- **Current Status**: ✅ TRACKED in dashboard

## Non-ETH Functions (for completeness)

### 5. swapTitanXForTorusAndBuild(uint32 _deadline)
- **Function Selector**: `0xfc9b61ae`
- **Type**: Non-payable
- **Purpose**: Swaps TitanX for Torus and adds liquidity
- **Emits**: BuyAndBuild event
- **Current Status**: ✅ TRACKED

### 6. swapTitanXForTorusAndBurn(uint32 _deadline)
- **Function Selector**: `0xd6d315a4`
- **Type**: Non-payable
- **Purpose**: Swaps TitanX for Torus and burns
- **Emits**: BuyAndBurn event
- **Current Status**: ✅ TRACKED

## Missing Data Issue

### Problem
Days 19-21 show:
- Day 19: 16 BuyAndBuild events but 0 ETH used for builds
- Day 20: 7 BuyAndBuild events but 0 ETH used for builds
- Day 21: 2 BuyAndBuild events but 0 ETH used for builds

### Root Cause
The update script only checks for function selector `0x53ad9b96` (swapETHForTorusAndBuild) but misses:
1. Direct ETH sends to `distributeETHForBuilding()` (selector `0xc381da4f`)
2. These distributed ETH amounts are later used in builds but not properly tracked

### How distributeETHForBuilding Works
1. Users send ETH directly to this function
2. ETH accumulates in the contract
3. Later, when certain conditions are met, the accumulated ETH is used for building
4. This creates BuyAndBuild events but the original ETH contribution is not linked

## Recommended Fix

Update the `update-buy-process-data.js` script to:

1. Track all transactions with function selector `0xc381da4f`
2. Check transaction value for ETH amount
3. Associate these ETH amounts with the appropriate protocol day
4. Consider implementing a mechanism to link distributed ETH with subsequent BuyAndBuild events

## Code Changes Needed

In `update-buy-process-data.js`, around line 358, add:

```javascript
if (functionSelector === '0x53ad9b96' || functionSelector === '0xc381da4f') {
  // ETH build - check transaction value
  if (tx.value && !tx.value.isZero()) {
    const ethAmount = parseFloat(ethers.utils.formatEther(tx.value));
    newDailyData[dateKey].ethUsed += ethAmount;
    newDailyData[dateKey].ethUsedForBuilds += ethAmount;
  }
}
```

Additionally, need to:
1. Fetch all transactions to the contract with selector `0xc381da4f`
2. Track these as ETH contributions for building
3. Update historical data to include these missing ETH amounts

## Impact
This missing tracking affects:
- ETH used for builds statistics
- Overall ETH usage metrics
- Daily protocol metrics accuracy
- Historical data integrity for days 19-21 (and potentially others)