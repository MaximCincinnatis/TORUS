# TORUS Dashboard - Active Scripts Documentation

**Last Updated:** 2025-08-25  
**Classification System:** See `SCRIPT_CLASSIFICATION_TEMPLATE.js` for details

## 🟢 ACTIVE Production Scripts

These scripts are currently running in production and should NOT be modified without thorough testing.

### Core Automation Pipeline

| Script | Purpose | Execution | Dependencies |
|--------|---------|-----------|--------------|
| `run-auto-update.sh` | Shell wrapper for cron job | Every 5 minutes via cron | auto-update-fixed.js |
| `auto-update-fixed.js` | Main orchestrator for all updates | Called by run-auto-update.sh | smart-update-fixed.js, Git |
| `smart-update-fixed.js` | Incremental data update logic | Called by auto-update-fixed.js | Multiple data scripts |
| `run-updater-service.js` | Service wrapper for reboot | @reboot via cron | auto-update-fixed.js |

### Data Update Scripts

| Script | Purpose | Called By | Updates |
|--------|---------|-----------|---------|
| `scripts/update-creates-stakes-incremental.js` | Updates stake/create events | smart-update-fixed.js | cached-data.json |
| `scripts/update-buy-process-data.js` | Updates buy & burn/build data | smart-update-fixed.js | buy-process-data.json |
| `comprehensive-payment-matching.js` | Matches ETH payments to burns | smart-update-fixed.js | Payment data |
| `scripts/data-updates/update-all-dashboard-data.js` | Full data rebuild (fallback) | smart-update-fixed.js on error | All JSON files |

### Support Scripts

| Script | Purpose | Called By | Status |
|--------|---------|-----------|--------|
| `incremental-lp-updater.js` | Updates LP positions | auto-update-fixed.js (conditional) | Optional |
| `update-lp-fee-burns.js` | Tracks LP fee burns | auto-update-fixed.js | Required |
| `force-vercel-rebuild.js` | Forces deployment | auto-update-fixed.js | Optional |
| `scripts/generate-future-supply-projection-fixed.js` | Generates supply projections | smart-update-fixed.js | Required |

## 🟡 UTILITY Scripts (On-Demand)

These scripts are run manually for maintenance, debugging, or analysis.

### Shared Modules (Always Active)

| Module | Purpose | Used By |
|--------|---------|---------|
| `scripts/shared/contractConstants.js` | Contract ABIs and addresses | All scripts |
| `scripts/shared/titanXHelpers.js` | TitanX calculations | Data scripts |
| `scripts/shared/totalSharesCalculator.js` | Share calculations | Data scripts |
| `scripts/shared/ethTransferTracker.js` | ETH payment tracking | Payment scripts |
| `shared/lpCalculations.js` | LP position calculations | LP scripts |
| `shared/rpcUtils.js` | RPC provider utilities | All blockchain scripts |

### Validation Scripts

| Script | Purpose | When to Run |
|--------|---------|-------------|
| `scripts/validate-no-duplicates.js` | Validates no duplicate events | After updates |
| `scripts/data-validator.js` | Validates data integrity | Before deployment |
| `scripts/pre-commit-lp-check.js` | Pre-commit LP validation | Git pre-commit hook |
| `scripts/generate-chart-docs.js` | Generates chart documentation | Documentation updates |

## 🔴 DEPRECATED Scripts

**WARNING:** These scripts are no longer used and will be archived. Do NOT use for production.

### Replaced Scripts
- `auto-update.js` → Replaced by `auto-update-fixed.js`
- `smart-update.js` → Replaced by `smart-update-fixed.js`
- All `fix-*.js` scripts → One-time fixes, no longer needed
- All `audit-*.js` scripts → One-time audits, use validation scripts instead
- All `analyze-*.js` scripts → Analysis complete, results documented

## Script Execution Flow

```
Cron (every 5 minutes)
    ↓
run-auto-update.sh
    ↓
auto-update-fixed.js
    ↓
smart-update-fixed.js
    ├── scripts/update-creates-stakes-incremental.js
    ├── scripts/update-buy-process-data.js
    ├── comprehensive-payment-matching.js
    └── scripts/generate-future-supply-projection-fixed.js
    ↓
Git commit & push
    ↓
Vercel deployment (automatic)
```

## Critical Files Updated

| File | Purpose | Update Frequency |
|------|---------|------------------|
| `public/data/cached-data.json` | Main dashboard data | Every 5 minutes |
| `public/data/buy-process-data.json` | Buy & burn data | Every 5 minutes |
| `update-log.json` | Update history | Every update |
| `src/constants/buildTimestamp.ts` | Build timestamp | Every commit |

## Monitoring & Logs

### Log Files
- Main log: `logs/auto-update-fixed.log`
- Service log: `logs/reboot-service.log`
- Update history: `update-log.json`

### Monitoring Commands
```bash
# Watch live updates
tail -f logs/auto-update-fixed.log

# Check cron status
crontab -l | grep torus

# Check last update
cat update-log.json | jq '.lastUpdateTime'

# Verify data integrity
node scripts/data-validator.js
```

## Emergency Procedures

### If Updates Stop Working

1. **Check cron is running:**
   ```bash
   systemctl status cron
   ```

2. **Check for errors in logs:**
   ```bash
   tail -100 logs/auto-update-fixed.log
   ```

3. **Run manual update:**
   ```bash
   node auto-update-fixed.js
   ```

4. **Force full rebuild (last resort):**
   ```bash
   node scripts/data-updates/update-all-dashboard-data.js
   ```

### Before Making Changes

1. **Always backup current data:**
   ```bash
   cp -r public/data public/data.backup.$(date +%Y%m%d)
   ```

2. **Test changes locally:**
   ```bash
   node [script-name] --dry-run
   ```

3. **Monitor after deployment:**
   ```bash
   watch -n 60 'tail -20 logs/auto-update-fixed.log'
   ```

## Notes

- Never delete scripts without checking dependencies
- Always test changes in a non-production environment first
- Keep backups of JSON data files before major updates
- Document any new scripts added to the pipeline