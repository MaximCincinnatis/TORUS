#!/bin/bash

# TORUS Dashboard - Reboot Cron Setup
# Ensures updates continue after system restart

echo "🔄 Setting up TORUS Dashboard reboot auto-start"
echo "=============================================="

DASHBOARD_DIR=$(pwd)
NODE_PATH=$(which node)

# Remove old reboot job if exists
echo "Cleaning up old reboot jobs..."
(crontab -l 2>/dev/null | grep -v "@reboot.*run-auto-updates.js") | crontab -

# Add new reboot job
REBOOT_CMD="@reboot cd $DASHBOARD_DIR && nohup $NODE_PATH run-updater-service.js >> logs/reboot-service.log 2>&1 &"

echo ""
echo "📝 Adding reboot cron job:"
echo "   $REBOOT_CMD"
echo ""

# Add to crontab
(crontab -l 2>/dev/null | grep -v "@reboot.*run-updater-service.js"; echo "$REBOOT_CMD") | crontab -

echo "✅ Reboot auto-start configured!"
echo ""
echo "📊 The updater will:"
echo "   - Start automatically on system reboot"
echo "   - Run updates every 30 minutes"
echo "   - Log output to logs/reboot-service.log"
echo ""
echo "🔧 Test with: node run-updater-service.js"
echo ""

# Also show systemd option
echo "💡 For production servers, consider using systemd:"
echo "   sudo cp torus-updater.service /etc/systemd/system/"
echo "   sudo systemctl enable torus-updater"
echo "   sudo systemctl start torus-updater"