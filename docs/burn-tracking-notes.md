# TORUS Burn Tracking Documentation

## Overview
This document explains how TORUS burns are tracked and displayed in the dashboard.

## Key Findings

### 1. TorusBuyAndProcess Contract Bug
The TorusBuyAndProcess smart contract (0xaa390a37006e22b5775a34f2147f81ebd6a63641) has an accounting bug where it double-counts burns:

- **Contract's `totalTorusBurnt`**: 2,111 TORUS (incorrect)
- **Actual burns (Transfer to 0x0)**: 1,145 TORUS (correct)
- **Discrepancy**: 966 TORUS

The contract appears to increment `totalTorusBurnt` twice:
1. When recording the intended burn amount (from BuyAndBurn events)
2. When actually burning (TorusBurned events)

### 2. LP Fee Burns
LP fee burns are executed through the same TorusBuyAndProcess contract and are already included in the daily burn totals. They should NOT be added separately to avoid double-counting.

Example:
- July 11: 164.38 TORUS daily total includes 161.53 TORUS LP fee burn
- July 16: 63.55 TORUS daily total includes 18.50 TORUS LP fee burn

## Implementation Details

### Data Structure
```json
{
  "totals": {
    "torusBurnt": "1145.578245614535783241",  // Actual burns
    "torusBurntContract": "2111.132556206751885753"  // Contract's inflated value (preserved for reference)
  }
}
```

### Chart Calculations

1. **Daily Burns Chart**: Shows `day.torusBurned` which includes all burns for that day
2. **Cumulative Burns Chart**: Sums daily burns progressively
3. **Total Burned Metric**: Shows `totals.torusBurnt` (actual burns)

### Important Notes

- Always use Transfer events to 0x0 to verify actual burns
- The contract's `totalTorusBurnt` is unreliable due to double-counting
- LP burns are already in the daily totals - do not add separately
- The burn address (0x0) always shows balance of 0 (tokens are destroyed, not stored)

## Testing

Run `node scripts/test-burn-calculations.js` to verify:
- Dashboard totals match blockchain
- No double-counting of LP burns
- Cumulative calculations are correct

## Future Considerations

When the TorusBuyAndProcess contract bug is fixed:
1. Update `scripts/update-buy-process-data.js` to use contract state
2. Remove the `torusBurntContract` field
3. Update this documentation