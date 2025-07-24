# LP Position Monitoring

## Overview
This directory contains monitoring tools and dashboards for the enhanced LP position tracking system.

## Structure
- `dashboards/` - HTML dashboards and status files
- `alerts/` - Alert checking scripts and configurations
- `reports/` - Daily and weekly reports

## Accessing the Dashboard
1. Serve the monitoring directory with a web server:
   ```bash
   cd monitoring/dashboards
   python3 -m http.server 8080
   ```
2. Open http://localhost:8080 in your browser

## Monitoring Commands
- Real-time monitoring: `node scripts/monitor-lp-updates.js watch`
- Generate report: `node scripts/monitor-lp-updates.js report`
- Check data validity: `node scripts/validate-lp-data.js check`

## Alert Configuration
Edit `alerts/check-alerts.js` to modify alert thresholds.

## Cron Jobs
The following monitoring jobs are scheduled:
- Hourly status snapshots
- Daily summary reports
- Weekly detailed reports
- Twice-daily data validation
- Log archival and cleanup
