# Shared Constants for TORUS Dashboard Scripts

## Overview

The `contractConstants.js` file is the single source of truth for all contract-related constants used across the TORUS dashboard scripts.

## Why Use Shared Constants?

1. **Prevent ABI Mismatches**: The Staked event ABI was wrong in 20+ scripts, causing all stake events to fail decoding
2. **Single Source of Truth**: Fix a constant in one place, it's fixed everywhere
3. **Consistency**: All scripts use the same addresses, ABIs, and calculations
4. **Maintainability**: Easy to update when contracts change

## What's Included

### Contract Addresses
- `TORUS`: Main TORUS token contract
- `CREATE_STAKE`: Contract for creating positions and staking
- `BUY_PROCESS`: Contract for buy & burn/build operations
- `TITANX`: TitanX token contract
- `POSITION_MANAGER`: Uniswap V3 position manager
- `WETH`: Wrapped ETH contract

### Event ABIs
All event signatures are verified from Etherscan:
- `CREATED`: For new TORUS positions
- `STAKED`: For TitanX staking (⚠️ Only `user` is indexed, not `stakeIndex`)
- `BUY_AND_BUILD`: For liquidity building events
- `BUY_AND_BURN`: For token burning events
- Plus standard ERC20 and Uniswap events

### Helper Functions
- `getProtocolDay(timestamp)`: Calculate protocol day from timestamp
- `getAddress(address)`: Get lowercase address for comparisons

## How to Use

```javascript
// Import what you need
const { 
  CONTRACT_ADDRESSES, 
  EVENT_ABIS,
  getProtocolDay 
} = require('./shared/contractConstants');

// Use constants instead of hardcoding
const contract = new ethers.Contract(
  CONTRACT_ADDRESSES.CREATE_STAKE,
  [EVENT_ABIS.CREATED, EVENT_ABIS.STAKED],
  provider
);

// Use helper functions
const protocolDay = getProtocolDay(blockTimestamp);
```

## Important Notes

1. **Don't modify constants directly** - If you need to update an ABI or address, update it in `contractConstants.js`
2. **Test after updates** - Run `node scripts/test-shared-constants.js` to verify constants are valid
3. **Check Etherscan** - Always verify ABIs against the actual contract on Etherscan

## Common Mistakes to Avoid

❌ **DON'T hardcode ABIs in scripts**
```javascript
// Bad - Don't do this
const abi = ['event Staked(address indexed user, uint256 indexed stakeIndex, ...)'];
```

✅ **DO import from shared constants**
```javascript
// Good - Do this
const { EVENT_ABIS } = require('./shared/contractConstants');
const abi = [EVENT_ABIS.STAKED];
```

## Maintenance

When updating constants:
1. Verify the new value on Etherscan
2. Update in `contractConstants.js`
3. Run the test script
4. Update any affected scripts
5. Test the dashboard functionality