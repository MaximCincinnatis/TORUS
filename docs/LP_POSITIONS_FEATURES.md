# Uniswap V3 LP Positions - Features & Specifications

## Overview
The Uniswap V3 Liquidity Providers table displays all active liquidity positions in the TORUS/TitanX pool, providing comprehensive data about each position's status, holdings, and performance.

## Table Columns

### 1. **Position ID**
- **Type**: Clickable link
- **Purpose**: NFT token ID for the Uniswap V3 position
- **Feature**: Links directly to Uniswap app for position management
- **Format**: Numeric ID (e.g., "813053")

### 2. **LP Provider**
- **Type**: Ethereum address
- **Purpose**: Owner of the liquidity position
- **Feature**: Clickable link to Etherscan
- **Format**: Truncated (0x1234...5678)

### 3. **TitanX Amount**
- **Type**: Numeric with icon
- **Purpose**: Current TitanX tokens in position
- **Features**:
  - TitanX logo icon
  - Formatted with commas
  - 2 decimal places
  - Handles small amounts (< 0.001) with 6 decimals
- **Critical**: This field must always be present (requiredField)

### 4. **TORUS Amount**
- **Type**: Numeric with styled text
- **Purpose**: Current TORUS tokens in position
- **Features**:
  - "TORUS" text with special styling
  - Smart formatting based on amount size
  - 3-6 decimal places depending on value
- **Critical**: This field must always be present (requiredField)

### 5. **Claimable Yield**
- **Type**: Numeric
- **Purpose**: Estimated unclaimed fees
- **Format**: "$X.XX"
- **Note**: Calculated based on position's share of trading fees

### 6. **Est. APR (24hr)**
- **Type**: Percentage
- **Purpose**: Estimated annual percentage rate based on last 24hr fees
- **Format**: "X.XX%"
- **Note**: Not compounded, simple APR calculation

### 7. **TitanX Price Range (Millions per TORUS)**
- **Type**: Range or text
- **Purpose**: Price boundaries for concentrated liquidity
- **Features**:
  - Full range positions show "Full Range V3"
  - Concentrated positions show "X.XX - Y.YY"
  - Values in millions of TitanX per TORUS
  - Formatted with commas

### 8. **Status**
- **Type**: Badge
- **Purpose**: Shows if position is in active trading range
- **States**:
  - "In Range" (green badge) - Currently earning fees
  - "Out of Range" (red badge) - Not earning fees
- **Visual**: Color-coded badges for quick identification

## Key Features

### Data Sources
- **Primary**: Cached JSON data from backend updates
- **Fallback**: Direct blockchain queries if cache miss
- **Update Frequency**: Every 30 minutes via cron job

### Field Mappings
- **amount0** → **torusAmount** (automatic mapping)
- **amount1** → **titanxAmount** (automatic mapping)
- **Handles token order**: Automatically detects if token0 is TORUS or TitanX

### Sorting & Display
- **Default Sort**: By TORUS amount (descending)
- **Pagination**: 10 positions per page
- **Position Count**: Shows total positions at top

### Special Formatting

#### Amount Formatting Rules
```
TitanX: 
- 0: "0"
- < 1: X.XX (2 decimals)
- >= 1: X,XXX.XX (with commas)

TORUS:
- 0: "0"
- < 0.001: X.XXXXXX (6 decimals)
- < 1: X.XXXX (4 decimals)
- < 1000: X.XXX (3 decimals)
- >= 1000: X,XXX.XXX (with commas)
```

#### Price Range Formatting
```
Full Range: "Full Range V3"
Concentrated: "X,XXX.XX - Y,YYY.YY"
Invalid: "Invalid Range"
```

### Visual Elements
- **Token Icons**: TitanX logo in header
- **TORUS Styling**: Special color/font for TORUS text
- **Status Badges**: Green/red color coding
- **Clickable Links**: Blue underlined for external links

### Data Validation
- **Required Fields**: tokenId, torusAmount, titanxAmount, owner
- **Zero Amount Check**: Positions with 0 liquidity filtered out
- **Address Validation**: Ensures valid Ethereum addresses
- **Token ID Validation**: Ensures valid NFT IDs

### Loading States
- Shows skeleton loader while fetching data
- Displays position count when loaded
- Graceful error handling if data unavailable

### Additional Features
- **Disclaimer**: Explains APR calculation methodology
- **Responsive Design**: Table scrolls horizontally on mobile
- **Export Ready**: Data structure supports CSV export
- **Real-time Updates**: Can refresh without page reload

## Technical Implementation

### Component Props
```typescript
interface LPPositionsTableProps {
  positions: SimpleLPPosition[];
  loading: boolean;
  tokenInfo: {
    token0IsTorus: boolean;
    token0IsTitanX: boolean;
  };
}
```

### Position Data Structure
```typescript
interface SimpleLPPosition {
  tokenId: string;
  owner: string;
  amount0: number;
  amount1: number;
  torusAmount: number;    // Mapped from amount0/1
  titanxAmount: number;   // Mapped from amount0/1
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  isActive: boolean;
  inRange?: boolean;
  priceRange?: string;
  claimableYield?: number;
  estimatedAPR?: number;
}
```

## Dashboard Integration
- Located in expandable section at bottom of dashboard
- Shows key metrics: Total Positions, Total TORUS Locked, Total TitanX Locked
- Auto-updates when new positions detected
- Preserves existing data during updates (no data loss)

## Future Enhancements (Planned)
- Search/filter by address
- Historical position tracking
- Fee earnings breakdown
- Position performance charts
- CSV export functionality
- Mobile-optimized view