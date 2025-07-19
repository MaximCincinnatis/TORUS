# TORUS Dashboard Data Flow Architecture

## Current State (As of July 19, 2025)

### Primary Update Flow (Production)

```
Every 10 minutes (cron):
└── run-auto-update.sh
    └── auto-update-fixed.js
        ├── smart-update-fixed.js (incremental updates)
        │   ├── Updates pool data
        │   ├── Updates token prices
        │   ├── Checks for new LP positions
        │   └── Falls back to full update if major changes detected
        ├── incremental-lp-updater.js (if needed)
        │   └── Updates LP position calculations
        ├── force-vercel-rebuild.js
        │   └── Updates buildTimestamp.ts
        └── git commit & push
            └── Triggers Vercel deployment
```

### Data Sources
1. **Ethereum RPC Endpoints**
   - Primary: eth.drpc.org, rpc.payload.de
   - Fallback: Multiple providers with rotation

2. **Smart Contracts**
   - TORUS Token: 0xb47f575807fc5466285e1277ef8acfbb5c6686e8
   - Create & Stake: 0xc7cc775b21f9df85e043c7fdd9dac60af0b69507
   - Uniswap V3 Pool: 0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F
   - NFT Position Manager: 0xC36442b4a4522E871399CD717aBDD847Ab11FE88

### Data Storage
- **Primary**: `/public/data/cached-data.json`
- **Update Log**: `update-log.json`
- **Build Timestamp**: `/src/constants/buildTimestamp.ts`

## Key Scripts Analysis

### 1. **smart-update-fixed.js** (PRIMARY)
- **Purpose**: Lightweight incremental updates
- **Frequency**: Every 10 minutes via cron
- **Behavior**:
  - Preserves existing LP positions
  - Updates pool data and prices
  - Falls back to full update when detecting new events
  - **ISSUE**: Falls back too often, triggering data loss

### 2. **update-all-dashboard-data.js** (PROBLEM SCRIPT)
- **Purpose**: Complete data rebuild
- **When Used**: As fallback from smart-update
- **Major Issue**: Lines 943-944 completely overwrite lpPositions array
  ```javascript
  cachedData.lpPositions = allPositions; // ❌ Destroys existing data!
  ```
- **Impact**: Loses manually added positions and historical data

### 3. **incremental-lp-updater.js** (GOOD PATTERN)
- **Purpose**: Updates LP positions incrementally
- **Behavior**: Properly merges with existing data
- **When Used**: Called by auto-update-fixed.js when needed

### 4. **auto-update.js** (DEPRECATED)
- **Purpose**: Original automation script
- **Status**: Replaced by auto-update-fixed.js
- **Still References**: update-all-dashboard-data.js (problematic)

## Field Mapping Issues

### Backend Data Structure
```javascript
{
  tokenId: "123456",
  amount0: 1000.5,      // TORUS amount
  amount1: 2000.75,     // TitanX amount
  liquidity: "1000000",
  tickLower: -100,
  tickUpper: 100
}
```

### Frontend Expects
```javascript
{
  tokenId: "123456",
  torusAmount: 1000.5,   // ❌ Different field name!
  titanxAmount: 2000.75, // ❌ Different field name!
  liquidity: "1000000",
  tickLower: -100,
  tickUpper: 100
}
```

### Mapping Logic (Missing in Some Scripts)
```javascript
// Some scripts do this correctly:
torusAmount: position.amount0,
titanxAmount: position.amount1

// Others set to 0 with comment "Frontend will calculate"
torusAmount: 0,  // ❌ Causes display issues
titanxAmount: 0  // ❌ Causes display issues
```

## Script Redundancy Analysis

### Duplicate Functionality Groups

1. **Full Update Scripts** (7 variants):
   - update-all-dashboard-data.js
   - update-complete-dashboard-data.js
   - update-complete-json.js
   - update-dashboard.js
   - update-all-dashboard-data-complete.js
   - update-json-with-real-data.js
   - update-dashboard-data.js

2. **Smart Update Scripts** (3 variants):
   - smart-update.js
   - smart-update-fixed.js
   - enhance-smart-update.js

3. **LP Position Scripts** (4 variants):
   - incremental-lp-updater.js
   - update-with-uniswap-values.js
   - rpc-update-real-amounts.js
   - update-claimable-simple.js

4. **Automation Scripts** (2 variants):
   - auto-update.js
   - auto-update-fixed.js

## Data Loss Root Causes

1. **Overwriting Instead of Merging**
   - Full update scripts replace entire arrays
   - No preservation of existing data
   - No unique ID tracking for positions

2. **Inconsistent Field Names**
   - Backend/frontend mismatch
   - No validation layer
   - Scripts handle mapping differently

3. **Fallback Logic Too Aggressive**
   - Smart update falls back to full update frequently
   - Any new event triggers complete rebuild
   - Cascading data loss

4. **No Data Contracts**
   - No TypeScript interfaces enforced
   - No runtime validation
   - Silent failures when data structure changes

## Recommendations

### Immediate Fixes
1. Change line 943-944 in update-all-dashboard-data.js to merge instead of replace
2. Add field mapping to all scripts that touch LP positions
3. Create shared calculation module for consistency

### Architecture Improvements
1. Consolidate to 2 scripts: UpdateEngine with strategies
2. Add data validation layer
3. Implement proper logging and monitoring
4. Create comprehensive test suite

### Best Practices from Industry
1. **Netflix Pattern**: Single service, multiple strategies
2. **Stripe Pattern**: Strong data contracts with validation
3. **Google SRE**: Observability and monitoring first