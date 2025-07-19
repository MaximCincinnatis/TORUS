# TORUS Dashboard Data Structures Documentation

## Primary Data File: cached-data.json

### Root Structure
```typescript
interface CachedData {
  lastUpdated: string;           // ISO timestamp
  version: string;               // Semantic version
  poolData: PoolData;           // Uniswap V3 pool state
  lpPositions: LPPosition[];    // Array of LP positions
  stakingData: StakingData;     // Staking metrics
  contractData: ContractData;   // Contract addresses and info
  totals: TotalsData;          // Aggregated totals
  metadata?: Metadata;         // Optional metadata
  tokenPrices?: TokenPrices;   // Price data
}
```

### LP Position Structure (Current)
```typescript
interface LPPosition {
  // Core identifiers
  tokenId: string;              // NFT token ID
  owner: string;                // Wallet address
  
  // Liquidity data
  liquidity: string;            // Raw liquidity amount
  tickLower: number;            // Lower price bound
  tickUpper: number;            // Upper price bound
  
  // Backend fields (from smart contracts)
  amount0: number;              // Token0 (TORUS) amount
  amount1: number;              // Token1 (TitanX) amount
  
  // Frontend fields (expected by UI)
  torusAmount: number;          // Same as amount0
  titanxAmount: number;         // Same as amount1
  
  // Claimable amounts
  claimableTorus: number;       // Unclaimed TORUS fees
  claimableTitanX: number;      // Unclaimed TitanX fees
  claimableYield: number;       // Total claimable value
  
  // Fee data
  tokensOwed0: string;          // Owed token0 from contract
  tokensOwed1: string;          // Owed token1 from contract
  fee: number;                  // Fee tier (e.g., 10000 = 1%)
  
  // Display fields
  lowerTitanxPerTorus: string;  // Formatted lower price
  upperTitanxPerTorus: string;  // Formatted upper price
  currentTitanxPerTorus: string; // Formatted current price
  priceRange: string;           // Human-readable range
  
  // Status
  inRange: boolean;             // Is position in active range?
  estimatedAPR: string;         // Calculated APR
  lastChecked: string;          // ISO timestamp
}
```

### Field Mapping Requirements
```javascript
// CRITICAL: All scripts MUST include this mapping
const mapLPPosition = (position) => ({
  ...position,
  // Map backend fields to frontend expectations
  torusAmount: position.amount0 || 0,
  titanxAmount: position.amount1 || 0,
  // Ensure claimable fields exist
  claimableYield: position.claimableYield || 0,
  claimableTorus: position.claimableTorus || 0,
  claimableTitanX: position.claimableTitanX || 0
});
```

### Pool Data Structure
```typescript
interface PoolData {
  sqrtPriceX96: string;         // Square root price (X96 format)
  currentTick: number;          // Current tick
  token0: string;               // TORUS address
  token1: string;               // TitanX address
  liquidity: string;            // Total pool liquidity
  feeGrowthGlobal0X128: string; // Accumulated fees token0
  feeGrowthGlobal1X128: string; // Accumulated fees token1
}
```

### Staking Data Structure
```typescript
interface StakingData {
  stakeEvents: StakeEvent[];    // All stake transactions
  createEvents: CreateEvent[];  // All create transactions
  rewardPoolData: RewardPool[]; // Daily reward pools
  currentProtocolDay: number;   // Current day since launch
  totalSupply: number;          // Total TORUS supply
  burnedSupply: number;         // Burned TORUS
  lastUpdated: string;          // ISO timestamp
  metadata: {
    currentBlock: number;       // Latest block processed
    lastIncrementalUpdate: string;
    incrementalUpdatesApplied: boolean;
  };
}
```

### Stake Event Structure
```typescript
interface StakeEvent {
  user: string;                 // Staker address
  id: string;                   // Stake ID
  blockNumber: number;          // Block number
  timestamp: string;            // Unix timestamp
  costETH: string;              // ETH cost
  costTitanX: string;           // TitanX cost
  principal: string;            // Staked amount
  shares: string;               // Shares received
  duration: string;             // Stake duration
  stakingDays: number;          // Days staked
  maturityDate: string;         // ISO date
}
```

### Create Event Structure
```typescript
interface CreateEvent {
  user: string;                 // Creator address
  id: string;                   // Create ID
  blockNumber: number;          // Block number
  timestamp: string;            // Unix timestamp
  costETH: string;              // ETH cost
  costTitanX: string;           // TitanX cost
  torusAmount: string;          // TORUS created
  endTime: string;              // End timestamp
  stakingDays: number;          // Creation days
  maturityDate: string;         // ISO date
}
```

### Totals Structure
```typescript
interface TotalsData {
  totalETH: string;             // Total ETH used
  totalTitanX: string;          // Total TitanX used
  totalStakedETH: string;       // ETH used for staking
  totalCreatedETH: string;      // ETH used for creation
  totalStakedTitanX: string;    // TitanX used for staking
  totalCreatedTitanX: string;   // TitanX used for creation
}
```

## Data Validation Requirements

### Required Field Validation
```javascript
const validateLPPosition = (position) => {
  const required = [
    'tokenId',
    'owner',
    'liquidity',
    'tickLower',
    'tickUpper',
    'amount0',
    'amount1',
    'torusAmount',
    'titanxAmount'
  ];
  
  for (const field of required) {
    if (position[field] === undefined || position[field] === null) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  // Validate field mapping
  if (position.torusAmount !== position.amount0) {
    throw new Error('Field mapping error: torusAmount must equal amount0');
  }
  
  if (position.titanxAmount !== position.amount1) {
    throw new Error('Field mapping error: titanxAmount must equal amount1');
  }
  
  return true;
};
```

### Type Validation
```javascript
const validateTypes = (position) => {
  // Numbers
  const numberFields = [
    'amount0', 'amount1', 'torusAmount', 'titanxAmount',
    'tickLower', 'tickUpper', 'claimableYield'
  ];
  
  for (const field of numberFields) {
    if (typeof position[field] !== 'number') {
      throw new Error(`${field} must be a number`);
    }
  }
  
  // Strings
  const stringFields = ['tokenId', 'owner', 'liquidity'];
  
  for (const field of stringFields) {
    if (typeof position[field] !== 'string') {
      throw new Error(`${field} must be a string`);
    }
  }
  
  return true;
};
```

## Common Data Issues

### 1. Zero Amount Display
**Problem**: LP positions show 0 for claimable yield
**Cause**: Missing field mapping (amount0/1 → torusAmount/titanxAmount)
**Solution**: Always apply field mapping after fetching data

### 2. Data Loss on Update
**Problem**: LP positions disappear after updates
**Cause**: Full replacement instead of merging
**Solution**: Use merge strategy:
```javascript
const mergedPositions = [
  ...existingPositions.filter(p => 
    !newPositions.find(n => n.tokenId === p.tokenId)
  ),
  ...newPositions
];
```

### 3. Type Mismatches
**Problem**: BigInt/string values cause calculation errors
**Cause**: Inconsistent type handling
**Solution**: Standardize conversions:
```javascript
const normalizeAmount = (value) => {
  if (typeof value === 'bigint') {
    return Number(value) / 1e18;
  }
  if (typeof value === 'string') {
    return parseFloat(value);
  }
  return value || 0;
};
```

## Migration Path

### Phase 1: Add Validation
1. Add validation to all update scripts
2. Log warnings for invalid data
3. Apply automatic field mapping

### Phase 2: Standardize Types
1. Create TypeScript interfaces
2. Add runtime type checking
3. Standardize BigInt handling

### Phase 3: Merge Strategy
1. Implement proper data merging
2. Track positions by unique ID
3. Preserve manual additions