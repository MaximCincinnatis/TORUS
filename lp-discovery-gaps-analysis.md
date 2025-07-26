# LP Position Discovery Gaps Analysis

## Current Discovery Method

Based on code analysis, the current method in `update-all-dashboard-data.js` uses:

1. **Pool Mint Events** - Scans from pool creation block (22890272) for Mint events in the TORUS/TitanX pool
2. **IncreaseLiquidity Events** - Looks for corresponding NFT Position Manager events within ±2 blocks of each Mint
3. **Hardcoded Known IDs** - Fallback list of known token IDs: ['1029195', '1030759', '1032346']

## Potential Gaps

### 1. **Positions Created Without Pool Mint Events**
- **Gap**: If someone adds liquidity to an existing position (only IncreaseLiquidity, no Mint), we might miss it
- **Risk**: LOW - Most LPs create new positions rather than adding to existing ones
- **Example**: Someone could buy an NFT position on secondary market and add liquidity

### 2. **Timing Window Mismatch**
- **Gap**: The ±2 block window between Mint and IncreaseLiquidity might be too narrow
- **Risk**: MEDIUM - Complex transactions or MEV bots might have larger gaps
- **Impact**: Could miss positions created in multi-step transactions

### 3. **Positions Created via Router Contracts**
- **Gap**: Different routers/aggregators might create positions in ways that don't follow the expected pattern
- **Risk**: MEDIUM - Advanced users might use custom contracts
- **Example**: 1inch, Uniswap Universal Router, or custom contracts

### 4. **Transferred Positions**
- **Gap**: Positions transferred between wallets won't emit new Mint/IncreaseLiquidity events
- **Risk**: LOW - We track by token ID, not owner, so transfers don't affect discovery
- **Note**: This is actually handled correctly in current implementation

### 5. **Positions with Zero Liquidity**
- **Gap**: Positions that had liquidity removed but NFT still exists
- **Risk**: NONE - Current code correctly filters for `liquidity > 0`
- **Status**: ✅ Properly handled

### 6. **Rate Limiting and Missed Blocks**
- **Gap**: RPC failures or rate limits might cause us to skip block ranges
- **Risk**: HIGH - We've seen this happen with the free RPC endpoints
- **Impact**: Could miss entire chunks of positions

### 7. **Pool Fee Tier Confusion**
- **Gap**: Multiple TORUS/TitanX pools with different fee tiers
- **Risk**: LOW - Currently only one pool exists (10000 fee tier)
- **Verification**: Pool address 0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F

### 8. **Direct NFT Minting**
- **Gap**: Positions created by directly calling NFT Position Manager without going through the pool
- **Risk**: MEDIUM - This is the standard way to create positions
- **Current Handling**: We rely on IncreaseLiquidity events, which should catch these

## Recommended Improvements

### 1. **Expand Event Search Window**
```javascript
// Current: ±2 blocks
const searchStart = Math.max(mintEvent.blockNumber - 2, chunkStart);
const searchEnd = Math.min(mintEvent.blockNumber + 2, chunkEnd);

// Recommended: ±10 blocks
const searchStart = Math.max(mintEvent.blockNumber - 10, chunkStart);
const searchEnd = Math.min(mintEvent.blockNumber + 10, chunkEnd);
```

### 2. **Add Direct IncreaseLiquidity Scanning**
```javascript
// Add a second pass that looks for IncreaseLiquidity events 
// without corresponding Mint events
const allIncreaseLiquidityEvents = await positionManager.queryFilter(
  positionManager.filters.IncreaseLiquidity(),
  chunkStart,
  chunkEnd
);
```

### 3. **Implement Transfer Event Monitoring**
```javascript
// Track Transfer events TO non-zero addresses (catches secondary market)
const transferFilter = {
  address: NFT_POSITION_MANAGER,
  topics: [
    ethers.utils.id('Transfer(address,address,uint256)'),
    null, // from any address
    null, // to any address (but not zero)
    null  // any token ID
  ]
};
```

### 4. **Add Periodic Full Scan**
- Once per day, scan a wider range of token IDs around known positions
- Check token IDs in ranges like [1029000-1033000] in batches

### 5. **Better RPC Error Handling**
- Implement retry logic with exponential backoff
- Use multiple RPC endpoints with fallback
- Track failed block ranges and retry them

## Current Status Assessment

**Coverage: ~95% Confident**

We're likely catching most positions because:
- ✅ We scan from pool creation
- ✅ We check known token IDs
- ✅ We filter for active liquidity
- ✅ Pool Mint + IncreaseLiquidity is the standard pattern

Main risk is missing positions created through:
- Non-standard routers
- Delayed IncreaseLiquidity events
- RPC failures during scanning

## Verification Steps

1. Check total liquidity in pool vs sum of our positions
2. Monitor for new IncreaseLiquidity events daily
3. Periodically scan wider token ID ranges
4. Compare our position count with Uniswap Info dashboard