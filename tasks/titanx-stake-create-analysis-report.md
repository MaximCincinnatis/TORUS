# TitanX Stake vs Create Analysis Report

## Executive Summary

After comprehensive analysis of the TORUS dashboard data, the massive difference in TitanX amounts between stake and create events is **genuine and expected**, not a data parsing error. The protocol uses two distinct mechanisms:

1. **Staking**: Small amounts of TitanX (average ~47 TitanX) for earning rewards
2. **Creating**: Massive amounts of TitanX (average ~2.3 billion TitanX) for minting TORUS tokens

## Key Findings

### 1. Data Integrity Verified
- All decimal conversions are correct (18 decimals for TitanX)
- The `titanAmount` field matches `rawCostTitanX` in all events
- The `costTitanX` field correctly represents human-readable values

### 2. Scale of Difference
- **Total TitanX in Stakes**: 6,435.3 TitanX
- **Total TitanX in Creates**: 3,073,868,037,042.9 TitanX
- **Ratio**: Creates use 477,657,302x more TitanX than stakes
- **Percentage**: Stakes represent only 0.0002% of total TitanX usage

### 3. Distribution Patterns

#### Stake Events (137 total)
- Range: 0.3 to 383 TitanX
- Most common: 10-100 TitanX (67.9% of stakes)
- Average: 46.97 TitanX per stake

#### Create Events (1,352 total)
- Range: 0 to 362,570,000,000 TitanX
- Most common: <1M TitanX (42.1%) and 100M-10B TitanX (47.5%)
- Average: 2,273,571,033 TitanX per create

### 4. Protocol Design Insights

The data reveals the TORUS protocol's dual-purpose design:

1. **Staking Function**: Users stake small amounts of TitanX to earn rewards over time
   - Similar to traditional staking mechanisms
   - Accessible to smaller holders
   - Generates yield through the protocol

2. **Create Function**: Users burn massive amounts of TitanX to mint TORUS tokens
   - Creates deflationary pressure on TitanX supply
   - High barrier to entry (requires significant TitanX)
   - Exchange rates vary (16M to 880M TitanX per TORUS)

## Technical Verification

### Sample Data Points

**Stake Example**:
```
User: 0x8a91055c...
Raw TitanX: 29000000000000000000 (wei)
Parsed: 29.0 TitanX
Principal: 29000000000000000000 (matches raw)
```

**Create Example**:
```
User: 0x5f13db1d...
Raw TitanX: 10000000000000000000000000000 (wei)
Parsed: 10,000,000,000.0 TitanX
TORUS Created: 22.73 tokens
Rate: 440,000,000 TitanX per TORUS
```

## Recommendations

1. **Dashboard Display**: Consider separate visualizations for stakes vs creates due to the massive scale difference

2. **User Education**: Add tooltips or info sections explaining the difference between staking (earning) and creating (minting)

3. **Scale Handling**: Use logarithmic scales or separate charts when displaying both types together

4. **Metrics Separation**: Track and display stake vs create metrics separately for clarity

## Conclusion

The data is accurate and reflects the intended protocol design. The TORUS ecosystem uses TitanX in two fundamentally different ways:
- Small-scale staking for rewards
- Large-scale burning for TORUS creation

This creates a unique economic model where the vast majority (99.98%) of TitanX usage comes from the create/burn mechanism, establishing strong deflationary pressure on the TitanX supply while allowing smaller participants to earn through staking.