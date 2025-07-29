#!/bin/bash

# Setup monitoring for TORUS dashboard updates
# Run this script to add monitoring to crontab

echo "🔧 Setting up TORUS Dashboard monitoring..."

# Create logs directory if it doesn't exist
mkdir -p /home/wsl/projects/TORUSspecs/torus-dashboard/logs

# Add monitoring job to crontab (runs every 15 minutes)
(crontab -l 2>/dev/null; echo "*/15 * * * * cd /home/wsl/projects/TORUSspecs/torus-dashboard && /usr/bin/node scripts/monitor-updates.js >> logs/monitor.log 2>&1") | crontab -

echo "✅ Monitoring setup complete!"
echo "📊 Monitor will run every 15 minutes"
echo "📝 Logs will be saved to: logs/monitor.log"
echo ""
echo "To view current status, run: node scripts/monitor-updates.js"
echo "To view alerts, check: logs/data-alerts.log"