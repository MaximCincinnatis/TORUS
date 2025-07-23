# TORUS Buy & Process Contract - Burn Accounting Bug Report

## Contract Address
`0xaa390a37006e22b5775a34f2147f81ebd6a63641`

## Issue Summary
The contract's `totalTorusBurnt` variable is incorrectly tracking burned TORUS, showing 2,074 TORUS burned when only 1,127 TORUS has actually been burned.

## The Problem
The contract appears to be double-counting burns by adding both:
1. The amount from `BuyAndBurn` events (947 TORUS)
2. The amount from `TorusBurned` events (1,127 TORUS)

This results in `totalTorusBurnt` = 2,074 TORUS (947 + 1,127)

## Evidence

### Current State (Block 22977255)
- **Contract's `totalTorusBurnt`**: 2,074.072832579182357207 TORUS
- **Actual burns (Transfer to 0x0)**: 1,127.048383800751018968 TORUS
- **Contract's current balance**: 0.0 TORUS

### Event Analysis
- **Sum of all BuyAndBurn event `torusBurnt` parameters**: 947.024448778431338239 TORUS
- **Sum of all TorusBurned event amounts**: 1,127.048383800751018968 TORUS
- **Number of BuyAndBurn events**: 118
- **Number of TorusBurned events**: 156

### Key Finding
`totalTorusBurnt` (2,074) = BuyAndBurn events (947) + TorusBurned events (1,127)

## Likely Cause
The contract is incrementing `totalTorusBurnt` twice:
1. Once when recording the intended burn amount (from BuyAndBurn)
2. Again when actually burning (TorusBurned event)

## Recommendation
The `totalTorusBurnt` should only track actual burns. Either:
- Only increment it when `TorusBurned` event is emitted (recommended)
- Or only increment it with the `torusBurnt` parameter from `BuyAndBurn` events

The current implementation counts both, causing the inflated total.

## Verification Method
```javascript
// To verify this issue:
const totalTorusBurnt = await contract.totalTorusBurnt();
const actualBurns = // Sum of all Transfer events from contract to 0x0
const buyAndBurnSum = // Sum of all BuyAndBurn event torusBurnt parameters
const torusBurnedSum = // Sum of all TorusBurned event amounts

console.log(totalTorusBurnt == buyAndBurnSum + torusBurnedSum); // Currently true, should be false
```

## Impact
- Dashboard and any integrations relying on `totalTorusBurnt` show inflated burn numbers
- The actual burned amount is 54.3% of what the contract reports
- No TORUS is missing - it's purely an accounting error