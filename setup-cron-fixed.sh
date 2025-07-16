#!/bin/bash

# TORUS Dashboard - Fixed Cron Setup Script
# Sets up automatic updates every 30 minutes with data preservation

echo "🕐 Setting up TORUS Dashboard automatic updates (FIXED VERSION)"
echo "=============================================================="

# Get the current directory
DASHBOARD_DIR=$(pwd)
NODE_PATH=$(which node)

# Create logs directory if it doesn't exist
mkdir -p logs

# Create the cron command using the FIXED auto-update script
CRON_CMD="*/30 * * * * cd $DASHBOARD_DIR && $NODE_PATH auto-update-fixed.js >> logs/auto-update-fixed.log 2>&1"

echo ""
echo "📝 This will add the following cron job:"
echo "   $CRON_CMD"
echo ""
echo "✨ Features of the fixed version:"
echo "   - Preserves existing LP positions"
echo "   - Uses smart incremental updates"
echo "   - Creates backups before updates"
echo "   - Minimal RPC calls (1-10 per update)"
echo "   - No data loss!"
echo ""

read -p "Do you want to add this cron job? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Check if old cron job exists and remove it
    OLD_CRON_EXISTS=$(crontab -l 2>/dev/null | grep -c "smart-update.js")
    if [ $OLD_CRON_EXISTS -gt 0 ]; then
        echo "⚠️  Removing old smart-update.js cron job..."
        (crontab -l 2>/dev/null | grep -v "smart-update.js") | crontab -
    fi
    
    OLD_AUTO_EXISTS=$(crontab -l 2>/dev/null | grep -c "auto-update.js")
    if [ $OLD_AUTO_EXISTS -gt 0 ]; then
        echo "⚠️  Removing old auto-update.js cron job..."
        (crontab -l 2>/dev/null | grep -v "auto-update.js") | crontab -
    fi
    
    # Add new cron job
    (crontab -l 2>/dev/null | grep -v "auto-update-fixed.js"; echo "$CRON_CMD") | crontab -
    
    echo "✅ Fixed cron job added successfully!"
    echo ""
    echo "📊 Monitor updates in:"
    echo "   - logs/auto-update-fixed.log (update output)"
    echo "   - update-log.json (update statistics)"
    echo "   - public/data/backups/ (automatic backups)"
    echo ""
    echo "🔧 Useful commands:"
    echo "   crontab -l                    # List current cron jobs"
    echo "   crontab -e                    # Edit cron jobs"
    echo "   tail -f logs/auto-update-fixed.log  # Watch live updates"
    echo "   node auto-update-fixed.js     # Run manually"
    echo ""
    echo "⏰ Next automatic update will run within 30 minutes"
else
    echo "❌ Cron setup cancelled"
    echo ""
    echo "To set up manually, add this line to your crontab:"
    echo "$CRON_CMD"
fi