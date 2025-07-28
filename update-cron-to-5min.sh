#!/bin/bash

# Script to update TORUS dashboard cron job from 30 minutes to 5 minutes

echo "🔄 Updating TORUS dashboard cron job to run every 5 minutes..."

# Backup current crontab
echo "📦 Backing up current crontab..."
crontab -l > crontab.backup.$(date +%Y%m%d_%H%M%S)

# Get current crontab, modify the interval, and install new crontab
crontab -l | sed 's|^\*/30 \* \* \* \* /home/wsl/projects/TORUSspecs/torus-dashboard/run-auto-update.sh|*/5 * * * * /home/wsl/projects/TORUSspecs/torus-dashboard/run-auto-update.sh|' | crontab -

echo "✅ Cron job updated!"
echo ""
echo "📋 New cron schedule:"
crontab -l | grep run-auto-update.sh
echo ""
echo "ℹ️  The dashboard will now update every 5 minutes instead of every 30 minutes."
echo "💡 To revert, restore from backup: crontab crontab.backup.*"