# TORUS Dashboard Scripts Documentation

## Overview
This document tracks all active production scripts and their purposes. Scripts are marked as ACTIVE, DEPRECATED, or DEVELOPMENT.

## Active Production Scripts

### Primary Update Chain (Runs every 30 minutes)

#### 1. `run-auto-update.sh`
- **Status**: ACTIVE
- **Type**: Shell script (cron job)
- **Schedule**: Every 30 minutes
- **Purpose**: Entry point for automated updates
- **Location**: Root directory

#### 2. `auto-update-fixed.js`
- **Status**: ACTIVE  
- **Called by**: run-auto-update.sh
- **Purpose**: Orchestrates the update process
- **Key Actions**:
  - Calls smart-update-fixed.js
  - Forces Vercel rebuild
  - Commits and pushes to Git
  - Handles deployment

#### 3. `smart-update-fixed.js`
- **Status**: ACTIVE
- **Called by**: auto-update-fixed.js
- **Purpose**: Performs incremental data updates
- **Key Features**:
  - Fetches latest blockchain data
  - Updates pool prices and volumes
  - Preserves existing LP positions
  - Falls back to full update if needed

#### 4. `scripts/data-updates/update-all-dashboard-data.js`
- **Status**: ACTIVE (with known issues)
- **Called by**: smart-update-fixed.js (as fallback)
- **Purpose**: Complete data rebuild from blockchain
- **⚠️ Known Issues**:
  - Can be slow (multiple blockchain calls)
  - High RPC usage
- **✅ Fixed Issues**:
  - LP position overwrite bug (now uses safeMergeLPPositions)

### Supporting Scripts

#### 5. `incremental-lp-updater.js`
- **Status**: ACTIVE
- **Called by**: smart-update-fixed.js (when LP changes detected)
- **Purpose**: Updates only LP position data

#### 6. `shared/lpCalculations.js`
- **Status**: ACTIVE
- **Type**: Utility module
- **Used by**: All update scripts
- **Purpose**: Centralized LP calculation logic

## Service Scripts

### `run-updater-service.js`
- **Status**: ACTIVE (backup service)
- **Runs**: On system startup and continuously
- **Purpose**: Ensures updates run even if cron fails

## Development/Manual Scripts

### Package.json Scripts
```json
{
  "validate:specs": "Validates dashboard specifications",
  "validate:lp-data": "Pre-commit LP data validation", 
  "test:lp-positions": "Tests LP position calculations"
}
```

## Deprecated Scripts

The following scripts are NO LONGER ACTIVE and should not be used:

### Root Directory (to be archived)
- `auto-update.js` → Replaced by `auto-update-fixed.js`
- `smart-update.js` → Replaced by `smart-update-fixed.js`
- `update-all-dashboard-data.js` → Moved to scripts/data-updates/
- `update-blockchain-data.js` → Functionality merged into smart-update-fixed.js
- `update-complete-json.js` → Redundant
- `update-dashboard.js` → Redundant
- `update-with-correct-fees.js` → Fixed in main scripts
- `update-with-uniswap-values.js` → Integrated into main flow

## Update Flow Diagram

```
┌─────────────────────┐
│   Cron Job (30m)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ run-auto-update.sh  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     ┌──────────────────────┐
│ auto-update-fixed.js│────▶│ Force Vercel Rebuild │
└──────────┬──────────┘     └──────────────────────┘
           │
           ▼
┌─────────────────────┐     ┌──────────────────────────┐
│smart-update-fixed.js│────▶│update-all-dashboard-data │
└─────────────────────┘     │    (fallback only)       │
                            └──────────────────────────┘
           │
           ▼
┌─────────────────────┐
│   Git Push → Vercel │
└─────────────────────┘
```

## Critical Files

### Data Files
- `public/data/cached-data.json` - Main data cache
- `src/constants/buildTimestamp.ts` - Triggers Vercel rebuilds

### Configuration
- Contract addresses and ABIs are hardcoded in scripts
- RPC endpoints defined in each script

## Best Practices

### When Adding New Scripts
1. Add STATUS header comment
2. Document in this file
3. Test thoroughly before adding to automation
4. Consider if functionality can be added to existing scripts

### When Deprecating Scripts
1. Update STATUS to DEPRECATED
2. Move to scripts/DEPRECATED/ folder
3. Update this documentation
4. Remove from any automation

## Known Issues & TODOs

1. **Reward Pool Data**: Only showing rewards for days 1-8 (should be 1-88)
2. **Script Consolidation**: Too many scripts doing similar things
3. **Error Handling**: Need better error recovery in update chain
4. **Monitoring**: No alerting when updates fail

## Emergency Procedures

### If Updates Stop Working
1. Check cron job: `crontab -l`
2. Check logs: `pm2 logs run-updater-service`
3. Run manually: `node auto-update-fixed.js`
4. Check Git status: Updates won't run if uncommitted changes

### If Data Gets Corrupted
1. Backups are created before updates
2. Check `public/data/` for backup files
3. Restore: `cp public/data/cached-data-backup-*.json public/data/cached-data.json`

---

*Last Updated: July 21, 2025*
*Maintainer: TORUS Dashboard Team*