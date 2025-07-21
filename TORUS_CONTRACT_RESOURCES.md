# TORUS Contract Resources for Buy & Burn Automation

## Smart Contract Addresses

### Main Contracts
- **TORUS Token Contract**: `0xb47f575807fc5466285e1277ef8acfbb5c6686e8`
  - Etherscan: https://etherscan.io/address/0xb47f575807fc5466285e1277ef8acfbb5c6686e8#code
  
- **Create & Stake Contract**: `0xc7cc775b21f9df85e043c7fdd9dac60af0b69507`
  - Etherscan: https://etherscan.io/address/0xc7cc775b21f9df85e043c7fdd9dac60af0b69507#code
  
- **Buy & Process Contract**: `0xaa390a37006e22b5775a34f2147f81ebd6a63641`
  - Etherscan: https://etherscan.io/address/0xaa390a37006e22b5775a34f2147f81ebd6a63641#code

### Related Contracts
- **TitanX Token**: `0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1`
- **Uniswap V3 TORUS/WETH Pool**: `0x7629C68615Ab5898c2871FBfdeD1cAdFc0bbCf1B`
  - Pool Created: Block 22717088 (Sat Apr 13 2024 03:22:11 GMT+0000)
  - Fee Tier: 1% (10000)

## Uniswap V3 Pool Information
- **TORUS Token0**: `0xb47f575807fc5466285e1277ef8acfbb5c6686e8`
- **WETH Token1**: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
- **Pool Fee**: 10000 (1%)
- **NFT Position Manager**: `0xC36442b4a4522E871399CD717aBDD847Ab11FE88`

## RPC Endpoints (Public)
```javascript
const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://rpc.payload.de',
  'https://eth-mainnet.public.blastapi.io',
  'https://rpc.flashbots.net',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth'
];
```

## Contract ABIs

### TORUS Token ABI (Key Functions)
```javascript
// Total Supply
{
  "inputs": [],
  "name": "totalSupply",
  "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
  "stateMutability": "view",
  "type": "function"
}

// Balance Of
{
  "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
  "name": "balanceOf",
  "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
  "stateMutability": "view",
  "type": "function"
}

// Transfer Event
{
  "anonymous": false,
  "inputs": [
    {"indexed": true, "internalType": "address", "name": "from", "type": "address"},
    {"indexed": true, "internalType": "address", "name": "to", "type": "address"},
    {"indexed": false, "internalType": "uint256", "name": "value", "type": "uint256"}
  ],
  "name": "Transfer",
  "type": "event"
}
```

### Create & Stake Contract ABI (Key Functions)
```javascript
// Get Current Day Index
{
  "inputs": [],
  "name": "getCurrentDayIndex",
  "outputs": [{"internalType": "uint24", "name": "", "type": "uint24"}],
  "stateMutability": "view",
  "type": "function"
}

// Reward Pool
{
  "inputs": [{"internalType": "uint24", "name": "day", "type": "uint24"}],
  "name": "rewardPool",
  "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
  "stateMutability": "view",
  "type": "function"
}

// Total Shares
{
  "inputs": [{"internalType": "uint24", "name": "day", "type": "uint24"}],
  "name": "totalShares",
  "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
  "stateMutability": "view",
  "type": "function"
}
```

## Buy & Process Contract Functions (Need to verify on Etherscan)
**Note**: The Buy & Process contract ABI is not available in our codebase. You'll need to:
1. Visit https://etherscan.io/address/0xaa390a37006e22b5775a34f2147f81ebd6a63641#code
2. Check if the contract is verified
3. Extract the `buyAndBurn` and `buyAndBuild` function signatures
4. Look for gas estimation functions

## Key Implementation Notes

### Gas Monitoring
- Monitor current gas prices using: `provider.getGasPrice()`
- Estimate transaction gas using: `contract.estimateGas.functionName(params)`
- Consider MEV protection using Flashbots RPC

### Profitability Calculation
```javascript
// Example profitability check
const calculateProfitability = async (gasPrice, estimatedGas) => {
  const gasCostInETH = gasPrice.mul(estimatedGas);
  const gasCostInUSD = gasCostInETH.mul(ethPriceInUSD).div(1e18);
  
  // Compare against expected rewards/benefits
  // Factor in slippage and MEV protection
  return expectedBenefit.gt(gasCostInUSD.mul(120).div(100)); // 20% buffer
};
```

### Dashboard Data Endpoints
- Cached Data: `/public/data/cached-data.json`
- LP Positions: Stored in cached data under `lpPositions`
- Price Data: TORUS price available in cached data

### Auto-Update Scripts Reference
- `smart-update-fixed.js` - Main data update script
- `incremental-lp-updater.js` - LP position updater
- Both scripts run every 30 minutes via cron

## Additional Resources
- Contract deployment block: ~22717088
- Protocol start date: April 11, 2024
- TORUS decimals: 18
- TitanX decimals: 18

## Security Considerations
1. Always use try-catch blocks for contract calls
2. Implement circuit breakers for repeated failures
3. Monitor for contract pauses/halts
4. Use multiple RPC endpoints for redundancy
5. Consider implementing a maximum gas price threshold
6. Add transaction simulation before execution

## Next Steps for Implementation
1. Verify the Buy & Process contract on Etherscan to get exact function signatures
2. Implement gas price monitoring system
3. Create profitability calculation engine
4. Set up transaction simulation
5. Implement execution logic with safety checks
6. Add monitoring and alerting system
7. Consider MEV protection strategies