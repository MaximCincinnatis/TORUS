# Day 19 ETH Investigation Report

## Summary
The two transactions that were reported as showing ETH value but not being tracked in our JSON are **NOT related to the TORUS Buy & Process contract**. They are unrelated transactions that happen to be on Day 19/20.

## Transaction Investigation Results

### Transaction 1: `0x0b87e939008878822d0460e08d6ce114fd854c7471602361b306a968989ace30`
- **Block Number**: 23020156
- **Date**: 2025-07-28T20:54:59.000Z
- **Protocol Day**: 20 (NOT Day 19)
- **From**: 0xc0ffeebabe5d496b2dde509f9fa189c25cf29671
- **To**: 0xe08d97e151473a848c3d9ca3f323cb720472d015 (NOT Buy & Process contract)
- **ETH Value**: 0.0000000000000004 ETH (negligible amount)
- **Method ID**: 0x8cbf8566
- **Status**: Success
- **BuyAndBuild Events**: None

### Transaction 2: `0xfc57bfeb9bf565de5fd4ebbc4d2a02c7f74623910ed48eb9acd230270068c74b`
- **Block Number**: 23021212
- **Date**: 2025-07-29T00:27:47.000Z
- **Protocol Day**: 20 (NOT Day 19)
- **From**: 0xfa0253943c3ff0e43898cba5a7a0da9d17c27995
- **To**: 0x043dfa52deb97ed9886c8a4d766442b6ee3756cb (NOT Buy & Process contract)
- **ETH Value**: 0.000000000000001826 ETH (negligible amount)
- **Method ID**: 0x000002ef
- **Status**: Success
- **BuyAndBuild Events**: None

## Key Findings

1. **Wrong Contract**: Neither transaction interacted with the Buy & Process contract (0xaa390a37006e22b5775a34f2147f81ebd6a63641)
2. **Wrong Day**: Both transactions are from Protocol Day 20, not Day 19
3. **No Events**: Neither transaction emitted BuyAndBuild events
4. **Negligible ETH**: The ETH values are dust amounts (less than 0.000000000000002 ETH)
5. **Different Contracts**: The transactions went to completely different contracts:
   - 0xe08d97e151473a848c3d9ca3f323cb720472d015
   - 0x043dfa52deb97ed9886c8a4d766442b6ee3756cb

## Conclusion

These transactions are **NOT** missing from our dashboard data because they are **NOT** Buy & Process transactions. They are unrelated Ethereum transactions that happen to have tiny ETH values. Our event tracking is working correctly by not including these transactions in the TORUS dashboard data.

## Recommendation

No action needed. The dashboard is correctly tracking only Buy & Process contract events. These transactions should not be included in the TORUS dashboard as they are not related to the TORUS ecosystem.