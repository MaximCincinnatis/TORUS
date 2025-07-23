# LP Fee Burns from Buy & Process Contract - Summary

## Overview

The Buy & Process contract (`0xaa390a37006e22b5775a34f2147f81ebd6a63641`) owns a Uniswap V3 NFT position (#1029195) and collects LP fees periodically. These fees are then burned, creating a different type of burn than regular buy & burn operations.

## Key Findings

### 1. **Events Emitted**

When LP fees are collected and burned, the following events are emitted:

1. **Collect Event** (from Uniswap V3 NFT Position Manager)
   - Contract: `0xC36442b4a4522E871399CD717aBDD847Ab11FE88`
   - Event Signature: `0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0`
   - Structure:
     ```
     event Collect(
       address indexed nftManager,  // Always the NFT Position Manager address
       int256 indexed amount0Delta, // Negative value indicating amount collected
       int256 indexed amount1Delta, // Negative value indicating amount collected
       address recipient,           // Who receives the fees (Buy & Process contract)
       uint256 amount0,            // TORUS amount collected
       uint256 amount1             // TitanX amount collected
     )
     ```

2. **Transfer Event** (TORUS burn)
   - Contract: `0xb47f575807fc5466285e1277ef8acfbb5c6686e8` (TORUS token)
   - Event: `Transfer(address from, address to, uint256 value)`
   - For burns: `from` = Buy & Process contract, `to` = `0x0000000000000000000000000000000000000000`

### 2. **Distinguishing LP Fee Burns from Regular Burns**

LP fee burns can be distinguished from regular buy & burn operations by:

1. **Transaction Pattern**: LP fee burns always have a `Collect` event in the same transaction
2. **Function Called**: Regular burns call `swapETHForTorusAndBurn()` or `swapTitanXForTorusAndBurn()`, while fee burns come from collect operations
3. **Event Sequence**: 
   - LP Fee Burn: Collect → Transfer (to 0x0)
   - Regular Burn: BuyAndBurn event → Transfer (to 0x0)

### 3. **Confirmed LP Fee Collections**

We've confirmed at least 2 LP fee collection and burn transactions:

1. **Transaction 1** (Block 22898872, 2025-07-11)
   - Hash: `0x65f4d4d6450701c3c9c44e4913c7434ad423587366c323654782580e53514669`
   - TORUS collected & burned: 161.527971146914771679
   - TitanX collected: 5486363450.15269801997
   - Burn rate: 100%

2. **Transaction 2** (Block 22929138, 2025-07-16)
   - Hash: `0x7e22b18f2d79f88f20ec6fbd380b65a69167e3d1e4dbb54350a74ce8be39ca03`
   - TORUS collected & burned: 18.49596387540490905
   - TitanX collected: 1724715963.487654343574775275
   - Burn rate: 100%

### 4. **Dashboard Integration Requirements**

To properly track LP fee burns separately:

1. **Monitoring**: Set up monitoring for `Collect` events where recipient is the Buy & Process contract
2. **Data Structure**: Add a new category for "LP Fee Burns" separate from regular burns
3. **Tracking**: Track:
   - Total TORUS collected from LP fees
   - Total TORUS burned from LP fees (should be 100%)
   - Total TitanX collected from LP fees
   - Number of fee collection events
   - Dates and amounts of each collection

### 5. **Implementation Approach**

```javascript
// Event filter for LP fee collections
const collectFilter = {
  address: NFT_POSITION_MANAGER,
  topics: [
    '0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0' // Collect event
  ]
};

// Decode Collect event
function decodeCollectEvent(log) {
  const data = log.data;
  const recipient = '0x' + data.slice(26, 66);
  const amount0 = ethers.BigNumber.from('0x' + data.slice(66, 130));  // TORUS
  const amount1 = ethers.BigNumber.from('0x' + data.slice(130, 194)); // TitanX
  
  return { recipient, amount0, amount1 };
}

// Check if it's a Buy & Process fee collection
function isBuyProcessFeeCollection(recipient) {
  return recipient.toLowerCase() === '0xaa390a37006e22b5775a34f2147f81ebd6a63641'.toLowerCase();
}
```

## Conclusion

LP fee burns are a distinct type of TORUS burn that should be tracked separately from regular buy & burn operations. They represent fees collected from the protocol's own liquidity position and are burned at a 100% rate, contributing to the deflationary mechanics of TORUS without being part of the regular buy & burn events.