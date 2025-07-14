# TORUS Dashboard Cache Update Guide

## Overview
The TORUS Dashboard now supports a JSON caching system that allows manual updates to pre-load data, significantly improving page load speeds. When cached data is available and fresh, the dashboard loads instantly without RPC calls.

## Cache File Location
```
/public/data/cached-data.json
```

## How It Works
1. **Fast Loading**: Dashboard checks for cached data first
2. **Automatic Fallback**: If cache is missing/expired, falls back to RPC calls
3. **Cache Expiry**: Data expires after 5 minutes by default
4. **Manual Control**: You can disable fallback to force cache-only mode

## Cache Status Indicators
- 🟢 **Fresh Cache** (< 5 minutes old)
- 🟡 **Stale Cache** (5-15 minutes old)  
- 🔴 **Expired Cache** (> 15 minutes old)
- 🔄 **Live RPC** (no cache, using blockchain calls)

## Updating the Cache

### 1. Get Current Blockchain Data
Use these commands to fetch fresh data:

```bash
# Get current pool state
cast call 0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F "slot0()" --rpc-url https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# Get specific LP position
cast call 0xC36442b4a4522E871399CD717aBDD847Ab11FE88 "positions(uint256)" 780889 --rpc-url https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
```

Or use the RPC calls to get data, then manually update the JSON.

### 2. Update JSON Structure

```json
{
  "lastUpdated": "2025-07-14T21:00:00.000Z", // UPDATE THIS
  "version": "1.0.0",
  "poolData": {
    "sqrtPriceX96": "79228162514264337593543950336", // Current pool price
    "currentTick": 0, // Current pool tick
    "token0": "0xb47f575807fc5466285e1277ef8acfbb5c6686e8",
    "token1": "0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1"
  },
  "lpPositions": [
    {
      "owner": "0xCe32E10b205FBf49F3bB7132f7378751Af1832b6",
      "tokenId": "780889",
      "liquidity": "1000000000000000000", // UPDATE: Position liquidity
      "tickLower": -887200, // Position range
      "tickUpper": 887200,
      "amount0": 100.5, // UPDATE: Calculated TORUS amount
      "amount1": 50000.25, // UPDATE: Calculated TitanX amount
      "inRange": true, // UPDATE: Is position in range?
      "claimableTorus": 0.1234, // UPDATE: Claimable TORUS fees
      "claimableTitanX": 1500.5, // UPDATE: Claimable TitanX fees
      "estimatedAPR": 25.8, // UPDATE: Calculated APR
      "aprDisplay": "25.9% 🟢" // UPDATE: Formatted APR display
    }
    // Add more positions as needed
  ],
  "historicalData": {
    "sevenDay": [
      {
        "date": "2025-07-14", // UPDATE: Each day's data
        "volumeUSD": "1200000", // UPDATE: Daily volume
        "feesUSD": "3600", // UPDATE: Daily fees
        "tvlUSD": "2500000", // UPDATE: Total value locked
        "liquidity": "50000000000000000000" // UPDATE: Total liquidity
      }
      // Add 6 more days for 7-day data
    ]
  },
  "metadata": {
    "fallbackToRPC": true, // Set to false to force cache-only
    "cacheExpiryMinutes": 5 // Adjust expiry time
  }
}
```

### 3. Critical Fields to Update

**Must Update Every Time:**
- `lastUpdated` - Current timestamp
- `lpPositions[].claimableTorus` - Current claimable TORUS fees
- `lpPositions[].claimableTitanX` - Current claimable TitanX fees
- `lpPositions[].amount0` - Current TORUS amount in position
- `lpPositions[].amount1` - Current TitanX amount in position
- `poolData.sqrtPriceX96` - Current pool price
- `poolData.currentTick` - Current pool tick

**Update Daily:**
- `historicalData.sevenDay[]` - Add new day, remove oldest
- `lpPositions[].estimatedAPR` - Recalculated APR
- `lpPositions[].aprDisplay` - Formatted APR display

### 4. Quick Update Script
Create this script to semi-automate updates:

```javascript
// update-cache.js
const fs = require('fs');

// Load current cache
const cache = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));

// Update timestamp
cache.lastUpdated = new Date().toISOString();

// TODO: Add your RPC calls here to fetch fresh data
// Example:
// const newPoolData = await fetchPoolState();
// cache.poolData = newPoolData;

// Save updated cache
fs.writeFileSync('public/data/cached-data.json', JSON.stringify(cache, null, 2));
console.log('Cache updated!');
```

## Deployment
After updating `cached-data.json`:

1. **Test Locally**: Verify the JSON is valid and data looks correct
2. **Deploy to Vercel**: The updated JSON will be served immediately
3. **Monitor**: Check the cache status indicator on the dashboard

## Benefits
- ⚡ **10x Faster Loading**: Instant data display instead of 10-20 second RPC calls
- 💰 **Reduced RPC Costs**: Fewer blockchain calls = lower Alchemy/Infura costs  
- 🔄 **Always Available**: Dashboard works even if RPC is down
- 📊 **Consistent Data**: All users see the same data snapshot

## Best Practices
1. **Update Frequency**: Update every 2-5 minutes during active periods
2. **Data Accuracy**: Always fetch fresh claimable amounts
3. **Backup Strategy**: Keep `fallbackToRPC: true` for reliability
4. **Version Control**: Track changes to the cache file
5. **Monitoring**: Watch the cache status indicator for issues

## Troubleshooting

### Cache Not Loading
- Check JSON syntax with a validator
- Verify file is in `/public/data/cached-data.json`
- Check browser console for fetch errors

### Stale Data Warning
- Update `lastUpdated` timestamp
- Verify data freshness
- Consider shorter `cacheExpiryMinutes`

### RPC Fallback Issues
- Set `fallbackToRPC: true`
- Check RPC endpoint connectivity
- Verify smart contract addresses

## Example Update Workflow
```bash
# 1. Fetch fresh LP data (use your preferred method)
node scripts/fetch-lp-data.js > temp-data.json

# 2. Update cache file with new data
node scripts/update-cache.js temp-data.json

# 3. Validate JSON
cat public/data/cached-data.json | jq '.'

# 4. Deploy to Vercel
vercel --prod

# 5. Verify cache status on dashboard
# Check for 🟢 indicator
```

The cache system provides a perfect balance of speed and reliability - fast loading with automatic fallback to ensure the dashboard always works.