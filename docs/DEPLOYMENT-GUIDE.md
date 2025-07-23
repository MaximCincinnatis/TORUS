# Enhanced LP Tracking Deployment Guide

## Overview
This guide provides step-by-step instructions for deploying the enhanced LP position tracking system into production.

## Prerequisites
- Node.js v18+ installed
- Access to production server
- Git repository access
- Backup of current production data

## Deployment Steps

### 1. Pre-Deployment Backup
```bash
# Create full backup of production data
mkdir -p backups/pre-deployment-$(date +%Y%m%d)
cp -r public/data backups/pre-deployment-$(date +%Y%m%d)/
cp -r data backups/pre-deployment-$(date +%Y%m%d)/ 2>/dev/null || true
cp update-log.json backups/pre-deployment-$(date +%Y%m%d)/
```

### 2. Test Deployment
Run the deployment in test mode first:
```bash
./scripts/deploy-enhanced-lp.sh test
```

This creates an isolated test environment where you can verify:
- Enhanced updater works correctly
- No errors during execution
- Data is properly preserved

### 3. Staging Deployment
Deploy to staging for parallel testing:
```bash
./scripts/deploy-enhanced-lp.sh stage
```

This will:
- Deploy enhanced updater alongside existing system
- Run both in parallel for comparison
- Log outputs to `logs/enhanced-update.log`

Monitor staging for 24-48 hours:
```bash
# Watch logs
tail -f logs/enhanced-update.log

# Compare with original
diff <(jq .lpPositions public/data/cached-data.json) <(jq .lpPositions public/data/cached-data-enhanced.json)
```

### 4. Production Deployment
Once staging is stable, deploy to production:
```bash
./scripts/deploy-enhanced-lp.sh prod
```

This will:
- Backup current production script
- Replace smart-update-fixed.js with enhanced version
- Remove staging parallel runs

### 5. Post-Deployment Monitoring

#### Set up monitoring infrastructure:
```bash
./scripts/setup-enhanced-monitoring.sh
```

#### Start real-time monitoring:
```bash
node scripts/monitor-lp-updates.js watch
```

#### View monitoring dashboard:
```bash
cd monitoring/dashboards
python3 -m http.server 8080
# Open http://localhost:8080 in browser
```

## Rollback Procedure

If issues occur, rollback immediately:

```bash
# 1. Stop cron jobs
crontab -e
# Comment out auto-update line

# 2. Restore original script
cp smart-update-fixed.backup.*.js smart-update-fixed.js

# 3. Restore data if needed
cp backups/pre-deployment-*/public/data/cached-data.json public/data/

# 4. Re-enable cron
crontab -e
# Uncomment auto-update line
```

## Verification Checklist

After deployment, verify:

- [ ] Auto-update runs without errors
- [ ] LP positions are being updated
- [ ] Closed positions are preserved
- [ ] No data loss occurs
- [ ] Git commits work correctly
- [ ] Vercel deployments trigger
- [ ] Frontend displays data correctly

## Monitoring Metrics

Track these metrics post-deployment:

1. **Update Success Rate**
   ```bash
   grep "Update completed" logs/lp-updates-*.log | wc -l
   ```

2. **Error Rate**
   ```bash
   grep "ERROR" logs/lp-updates-*.log | wc -l
   ```

3. **Position Counts**
   ```bash
   jq '.lpPositions | length' public/data/cached-data.json
   ```

4. **Closed Positions**
   ```bash
   jq '.lpPositions | map(select(.status == "closed")) | length' public/data/cached-data.json
   ```

## Troubleshooting

### Common Issues

1. **"EnhancedLPUpdater is not a constructor"**
   - Fix: Ensure module.exports = { EnhancedLPUpdater }

2. **Missing logs directory**
   - Fix: mkdir -p logs

3. **RPC timeouts**
   - Check RPC provider status
   - Reduce scan block range

4. **Memory issues**
   - Monitor with: `top -p $(pgrep -f smart-update)`
   - Increase Node.js memory: `NODE_OPTIONS="--max-old-space-size=4096"`

## Support

For issues or questions:
1. Check logs in `logs/` directory
2. Review monitoring dashboard
3. Check deployment records in `deployments/`

## Maintenance

### Weekly Tasks
- Review monitoring reports
- Check log sizes and rotate if needed
- Verify backup integrity

### Monthly Tasks
- Analyze performance metrics
- Optimize if needed
- Update documentation