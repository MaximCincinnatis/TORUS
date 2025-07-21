# TORUS Dashboard Chart Specifications

Generated: 2025-07-21T15:59:06.631Z
Version: 1.0.0

## Overview

This document provides comprehensive specifications for all charts and components in the TORUS Dashboard.

## Table of Contents

- [Future TORUS Max Supply Projection](#max-supply-projection)
- [Future TORUS Supply Projection](#supply-projection)
- [TORUS Staked Per Contract Day](#torus-staked-per-day)
- [Stake Maturity Schedule](#stake-maturity)
- [Create Maturity Schedule](#create-maturity)
- [TORUS Release Amounts (Principal)](#torus-releases)
- [TORUS Release Schedule with Accrued Rewards](#torus-rewards)
- [TitanX Usage by End Date](#titanx-usage)
- [Shares Release Schedule](#shares-releases)
- [Uniswap V3 Liquidity Providers](#lp-positions-table)

## Charts

### Future TORUS Max Supply Projection {#max-supply-projection}

**ID**: `max-supply-projection`  
**Type**: line  
**Component**: `PannableLineChart`

#### Features
- ✅ **Drag/Pan**: Enabled
- ✅ **Zoom**: Enabled
- ❌ **Data Labels**: Hidden
- **Timeframes**: 7d, 30d, 60d, 88d, ALL
- **Tooltip**: unified
- ✅ **Exportable**: Yes

#### Data Configuration
- **Source Function**: `calculateFutureMaxSupply`
- **Max Days**: 365
- **Refresh Interval**: 300s

#### Display Settings
- **Height**: 600px
- **Y-Axis Format**: abbreviated
- **X-Axis Label**: "Protocol Day"
- **Y-Axis Label**: "TORUS Supply"



#### Validation Rules
- **Min Data Points**: 1
- **Max Data Points**: 365
- **Required Fields**: day, totalMaxSupply, breakdown

---

### Future TORUS Supply Projection {#supply-projection}

**ID**: `supply-projection`  
**Type**: line  
**Component**: `PannableLineChart`

#### Features
- ✅ **Drag/Pan**: Enabled
- ✅ **Zoom**: Enabled
- ❌ **Data Labels**: Hidden
- **Timeframes**: 7d, 30d, 60d, 88d, ALL
- **Tooltip**: standard
- ✅ **Exportable**: Yes

#### Data Configuration
- **Source Function**: `calculateSupplyProjection`
- **Max Days**: 365


#### Display Settings
- **Height**: 400px
- **Y-Axis Format**: abbreviated



- **Line Color**: #FBBF24

---

### TORUS Staked Per Contract Day {#torus-staked-per-day}

**ID**: `torus-staked-per-day`  
**Type**: bar  
**Component**: `PannableBarChart`

#### Features
- ✅ **Drag/Pan**: Enabled
- ✅ **Zoom**: Enabled
- ✅ **Data Labels**: Shown
- **Timeframes**: 7d, 30d, 60d, 88d, ALL
- **Tooltip**: standard


#### Data Configuration
- **Source Function**: `calculateTorusStakedPerDay`
- **Max Days**: 365


#### Display Settings
- **Height**: 400px



- **Bar Color**: #22C55E


#### Validation Rules
- **Min Data Points**: undefined
- **Max Data Points**: undefined
- **Required Fields**: day, amount

---

### Stake Maturity Schedule {#stake-maturity}

**ID**: `stake-maturity`  
**Type**: bar  
**Component**: `PannableBarChart`

#### Features
- ✅ **Drag/Pan**: Enabled
- ✅ **Zoom**: Enabled
- ✅ **Data Labels**: Shown
- **Timeframes**: 7d, 30d, 60d, 88d, ALL
- **Tooltip**: standard


#### Data Configuration
- **Source Function**: `calculateStakeReleases`
- **Max Days**: 365


#### Display Settings
- **Height**: 400px



- **Bar Color**: #EF4444


---

### Create Maturity Schedule {#create-maturity}

**ID**: `create-maturity`  
**Type**: bar  
**Component**: `PannableBarChart`

#### Features
- ✅ **Drag/Pan**: Enabled
- ✅ **Zoom**: Enabled
- ✅ **Data Labels**: Shown
- **Timeframes**: 7d, 30d, 60d, 88d, ALL
- **Tooltip**: standard


#### Data Configuration
- **Source Function**: `calculateCreateReleases`
- **Max Days**: 365


#### Display Settings
- **Height**: 400px



- **Bar Color**: #3B82F6


---

### TORUS Release Amounts (Principal) {#torus-releases}

**ID**: `torus-releases`  
**Type**: bar  
**Component**: `PannableBarChart`

#### Features
- ✅ **Drag/Pan**: Enabled
- ✅ **Zoom**: Enabled
- ❌ **Data Labels**: Hidden
- **Timeframes**: 7d, 30d, 60d, 88d, ALL
- **Tooltip**: standard


#### Data Configuration
- **Source Function**: `calculateTorusReleases`
- **Max Days**: 365


#### Display Settings
- **Height**: 400px



- **Bar Color**: #10B981


---

### TORUS Release Schedule with Accrued Rewards {#torus-rewards}

**ID**: `torus-rewards`  
**Type**: bar  
**Component**: `PannableBarChart`

#### Features
- ✅ **Drag/Pan**: Enabled
- ✅ **Zoom**: Enabled
- ❌ **Data Labels**: Hidden
- **Timeframes**: 7d, 30d, 60d, 88d, ALL
- **Tooltip**: enhanced


#### Data Configuration
- **Source Function**: `calculateTorusReleasesWithRewards`
- **Max Days**: 365


#### Display Settings
- **Height**: 400px






---

### TitanX Usage by End Date {#titanx-usage}

**ID**: `titanx-usage`  
**Type**: bar  
**Component**: `PannableBarChart`

#### Features
- ✅ **Drag/Pan**: Enabled
- ✅ **Zoom**: Enabled
- ❌ **Data Labels**: Hidden
- **Timeframes**: 7d, 30d, 60d, 88d, ALL
- **Tooltip**: standard


#### Data Configuration
- **Source Function**: `calculateTitanXUsage`
- **Max Days**: 365


#### Display Settings
- **Height**: 400px



- **Bar Color**: #8B5CF6


---

### Shares Release Schedule {#shares-releases}

**ID**: `shares-releases`  
**Type**: bar  
**Component**: `PannableBarChart`

#### Features
- ✅ **Drag/Pan**: Enabled
- ✅ **Zoom**: Enabled
- ❌ **Data Labels**: Hidden
- **Timeframes**: 7d, 30d, 60d, 88d, ALL
- **Tooltip**: standard


#### Data Configuration
- **Source Function**: `calculateSharesReleases`
- **Max Days**: 365


#### Display Settings
- **Height**: 400px



- **Bar Color**: #F59E0B


---

## Components

### Uniswap V3 Liquidity Providers {#lp-positions-table}

**ID**: `lp-positions-table`  
**Type**: table  
**Component**: `LPPositionsTable`

#### Required Columns
| Field | Header | Format | Required |
|-------|--------|--------|----------|
| `tokenId` | Token ID | string | ❌ |
| `torusAmount` | TORUS Amount | number | ✅ |
| `titanxAmount` | TitanX Amount | number | ✅ |
| `owner` | Owner | address | ❌ |
| `isActive` | Status | boolean | ❌ |

#### Features
- ✅ **Sortable**: Yes
- ✅ **Filterable**: Yes
- ✅ **Exportable**: Yes
- ✅ **Pagination**: 10 items/page
- ✅ **Searchable**: Yes

#### Field Mappings
- `amount0` → `torusAmount`
- `amount1` → `titanxAmount`

#### Data Integrity Rules
- noZeroAmounts: ✅ Enabled
- validTokenId: ✅ Enabled
- validAddress: ✅ Enabled

---

## Data Contracts

### Overview
Data contracts define the expected structure and validation rules for all data types used in the dashboard.

### LPPosition

Uniswap V3 liquidity position

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tokenId` | string | ✅ | NFT token ID for the position |
| `owner` | string | ✅ | Ethereum address of position owner |
| `amount0` | number | ✅ | Raw amount of token0 (TORUS) |
| `amount1` | number | ✅ | Raw amount of token1 (TitanX) |
| `torusAmount` | number | ✅ | Human-readable TORUS amount |
| `titanxAmount` | number | ✅ | Human-readable TitanX amount |
| `tickLower` | number | ✅ | Lower tick boundary |
| `tickUpper` | number | ✅ | Upper tick boundary |
| `liquidity` | string | ✅ | Position liquidity |
| `isActive` | boolean | ✅ | Whether position has liquidity |

### StakeEvent

TORUS staking event

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user` | string | ✅ |  |
| `principal` | string | ✅ | Staked amount in wei |
| `shares` | string | ✅ | Shares received |
| `stakingDays` | number | ✅ |  |
| `timestamp` | string | ✅ | Unix timestamp |
| `maturityDate` | string | ✅ |  |

### CreateEvent

TORUS creation event

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user` | string | ✅ |  |
| `titanxAmount` | string | ✅ | TitanX burned in wei |
| `torusAmount` | string | ✅ | TORUS created in wei |
| `creationDays` | number | ✅ |  |
| `timestamp` | string | ✅ |  |
| `endDate` | string | ✅ |  |

### RewardPoolData

Daily reward pool information

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `day` | number | ✅ |  |
| `rewardPool` | string | ✅ | Reward pool size in wei |
| `penaltiesInPool` | string | ✅ | Penalties added to pool in wei |
| `totalShares` | string | ✅ | Total shares for the day |

### ChartDataPoint

Generic chart data point

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `date` | string | ✅ |  |
| `value` | number | ✅ |  |
| `label` | string | ❌ |  |

## Implementation Notes

### Adding a New Chart

1. Add specification to `dashboard-specs/chart-specifications.json`
2. Implement using the specification:
   ```typescript
   const spec = chartSpecs.charts['your-chart-id'];
   <PannableBarChart
     title={spec.title}
     showDataLabels={spec.features.dataLabels}
     windowSize={selectedDays}
     // ... other props from spec
   />
   ```
3. Run validation: `npm run validate:specs`
4. Generate updated docs: `npm run docs:generate`

### Modifying Existing Charts

1. Update specification in `dashboard-specs/chart-specifications.json`
2. Increment version number
3. Update implementation to match new specification
4. Run validation to ensure compliance
5. Commit both specification and implementation changes together

### Testing Charts

Each chart should have tests that verify:
- Component renders with correct type
- Features match specification
- Data validation rules are enforced
- Visual regression tests pass

