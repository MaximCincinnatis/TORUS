#!/bin/bash

# TORUS Dashboard - Cron Setup Script
# Sets up automatic updates every 30 minutes

echo "🕐 Setting up TORUS Dashboard automatic updates"
echo "=============================================="

# Get the current directory
DASHBOARD_DIR=$(pwd)
NODE_PATH=$(which node)

# Create the cron command
CRON_CMD="*/30 * * * * cd $DASHBOARD_DIR && $NODE_PATH smart-update.js >> smart-update.log 2>&1"

echo ""
echo "📝 This will add the following cron job:"
echo "   $CRON_CMD"
echo ""
echo "This runs the smart update script every 30 minutes."
echo ""

read -p "Do you want to add this cron job? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Add to crontab
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
    
    echo "✅ Cron job added successfully!"
    echo ""
    echo "📊 You can monitor updates in:"
    echo "   - smart-update.log (update output)"
    echo "   - update-log.json (update statistics)"
    echo ""
    echo "🔧 Useful commands:"
    echo "   crontab -l        # List current cron jobs"
    echo "   crontab -e        # Edit cron jobs"
    echo "   tail -f smart-update.log  # Watch live updates"
    echo ""
else
    echo "❌ Cron setup cancelled"
    echo ""
    echo "To set up manually, add this line to your crontab:"
    echo "$CRON_CMD"
fi