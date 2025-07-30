# Moralis LP Integration Plan

## Overview
Integrate Moralis API to improve LP position discovery and tracking, addressing current limitations with event-based scanning.

## Current Issues
1. Event scanning can miss positions outside search window
2. Data overwriting bug loses historical positions  
3. Limited to positions created through Mint events
4. No real-time position updates

## Moralis Benefits
- Direct NFT lookups by owner address
- No need for event scanning
- Real-time webhook support
- 40,000 compute units/month free tier (sufficient for our needs)
- 25 requests/second rate limit

## Implementation Plan

### Phase 1: Create Moralis LP Updater Script
Create `scripts/moralis-lp-updater.js` that:
1. Fetches NFTs for known LP addresses using Moralis
2. Checks position details on-chain (to verify TORUS pool)
3. Merges with existing positions (never overwrites)
4. Updates `cached-data.json` incrementally

### Phase 2: Integrate with Smart Update
Modify `smart-update.js` to:
1. Call moralis-lp-updater.js alongside other updates
2. Use Moralis as primary source, RPC as fallback
3. Maintain backwards compatibility

### Phase 3: Add Webhook Support (Future)
1. Set up Moralis webhooks for NFT transfers
2. Real-time position updates
3. Reduce polling frequency

## Simple Implementation Example

```javascript
// moralis-lp-updater.js
async function updateLPsWithMoralis() {
  const knownLPProviders = [
    '0xAa390a37006E22b5775A34f2147F81eBD6a63641',
    '0x9BBb45e12c4a75f7406Cb38e858Fa6C68A88f30d',
    '0x16221e4ea7B456C7083A29d43b452F7b6edA2466'
  ];

  const positions = new Map();
  
  // Load existing positions
  const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json'));
  cachedData.lpPositions.forEach(p => positions.set(p.tokenId, p));

  // Fetch NFTs for each address
  for (const address of knownLPProviders) {
    const nfts = await fetchNFTsForAddress(address);
    
    for (const nft of nfts) {
      const position = await checkIfTorusPosition(nft.token_id);
      if (position) {
        positions.set(nft.token_id, position);
      }
    }
  }

  // Save merged positions
  cachedData.lpPositions = Array.from(positions.values());
  fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
}
```

## API Usage Estimate
- 10 known addresses × 1 call = 10 compute units
- 20 position checks × 5 CU = 100 compute units  
- Total per update: ~110 CU
- Daily usage (288 updates): ~32,000 CU
- Well within free tier limit of 40,000 CU/month

## Benefits
1. **Reliability**: No more missing positions
2. **Simplicity**: Direct API calls vs complex event scanning
3. **Performance**: Faster updates with less RPC load
4. **Accuracy**: Always shows complete LP position list
5. **Future-proof**: Ready for webhooks and real-time updates

## Next Steps
1. Create moralis-lp-updater.js with simple incremental updates
2. Test with known LP addresses
3. Integrate into smart-update.js
4. Monitor API usage to ensure within limits
5. Consider adding more LP addresses as discovered