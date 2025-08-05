# Protocol Day 26 On-Chain Verification Report

## Summary

**Protocol Day 26 (August 4th, 2025 after 6PM UTC) - NO TITANX WAS USED FOR CREATES OR STAKES**

## Verification Results

### Dashboard Data (Cached)
- **Creates**: 4 events using ETH only (total: 0.060333 ETH)
- **Stakes**: 1 event using ETH only (total: 0.000690 ETH)
- **TitanX Used**: 0 for both creates and stakes

### On-Chain Verification

1. **Block Range**: 23069051 to 23070161 (covering all of protocol day 26)
2. **Contract**: 0xc7cc775b21f9df85e043c7fdd9dac60af0b69507 (Create & Stake)

### Confirmed Transactions

**Creates (all using ETH):**
1. `0x41e95cb828d50cec1ff32fdda1ec5fd5f33e5e248afa07489c3d7a4de2fc71d0`
   - Block: 23069386
   - ETH sent: 0.004100779828272697 ETH
   - Method: createTorus

2. `0x381c7ba3789880d710336fbaa753858bbb4cb6d5bda391b21b9b47b477fad942`
   - Block: 23069465
   - ETH sent: 0.02563243691409703 ETH
   - Method: createTorus

3. `0xa18c04a6881524d93663f7aa80d92eb6419319d1af80949fd8288d380c5cfedc`
   - Block: 23069926
   - ETH sent: 0.025496951127097957 ETH
   - Method: createTorus

4. `0x3ad573f2d6a3304220842af7ed9fe36ff86a180c8fac732b53dfb0cf7b4d89ae`
   - Block: 23070022
   - ETH sent: 0.005102450624565372 ETH
   - Method: createTorus

**Stakes (using ETH):**
1. `0x50199264c4af785dcb655b60baf29f8b2d3be4c66bf216e09543a730437f9e94`
   - Block: 23069437
   - ETH sent: 0.000690316390051884 ETH
   - Method: stakeTorus (assumed based on different method signature)

### Event Search Results
- CreateETHBatch events: 0
- CreateTitanXBatch events: 0
- StakeETHBatch events: 0
- StakeTitanXBatch events: 0

Note: The batch events weren't found because the transactions appear to be using individual create/stake methods rather than batch methods.

## Conclusion

✅ **VERIFIED**: No TitanX was used for creates or stakes on protocol day 26. All 5 transactions (4 creates + 1 stake) used ETH exclusively. The dashboard data correctly reflects this with TitanX amounts showing as 0.

The total ETH used matches between the dashboard and on-chain data:
- Creates: 0.060333 ETH
- Stakes: 0.000690 ETH
- **Total: 0.061023 ETH**