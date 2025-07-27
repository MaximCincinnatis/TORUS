# TorusBuyAndProcess Contract Address Verification

## Todo List

- [x] Search codebase for references to TorusBuyAndProcess contract address
- [x] Check Etherscan for TORUS token contract to find active buy/process interactions  
- [x] Verify which contract is actually burning TORUS tokens
- [x] Update contract address in code/documentation if needed
- [x] Add review section to todo.md

## Review

### Summary of Changes Made

1. **Searched the codebase** and found the TorusBuyAndProcess contract address `0xaa390a37006e22b5775a34f2147f81ebd6a63641` is used throughout the project in:
   - `/scripts/update-buy-process-data.js`
   - Multiple other scripts in the `/scripts` directory
   - Referenced in `CLAUDE.md` documentation

2. **Verified on Etherscan** that:
   - The TORUS token contract at `0xb47f575807fc5466285e1277ef8acfbb5c6686e8` creates the TorusBuyAndProcess contract in its constructor
   - The contract at `0xaa390a37006e22b5775a34f2147f81ebd6a63641` is active and has burn functionality
   - The contract includes `burnTorus()` function and tracks `totalTorusBurnt`

3. **Created verification script** (`/scripts/verify-buy-process-address.js`) that:
   - Queries the TORUS token contract for the actual buyAndProcess address
   - Confirms the address matches (case-insensitive): `0xAa390a37006E22b5775A34f2147F81eBD6a63641`
   - The address in our code `0xaa390a37006e22b5775a34f2147f81ebd6a63641` is correct

### Important Findings

- The TorusBuyAndProcess contract address `0xaa390a37006e22b5775a34f2147f81ebd6a63641` is **correct** and actively burning TORUS tokens
- No updates to the contract address are needed
- The address is properly referenced throughout the codebase
- The CLAUDE.md documentation already notes an issue with the contract's `totalTorusBurnt()` function double-counting burns, which has been addressed in the update scripts

### Next Steps

No further action required - the contract address is verified as correct.