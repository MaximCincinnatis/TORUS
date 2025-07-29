#!/bin/bash

# Add LP gap monitoring to cron (runs every hour)
echo "Adding LP gap monitoring to cron..."

# Check if monitoring already exists
if crontab -l 2>/dev/null | grep -q "monitor-lp-gaps"; then
  echo "LP gap monitoring already in cron"
else
  # Add to existing cron
  (crontab -l 2>/dev/null; echo "0 * * * * cd $(pwd) && node monitor-lp-gaps.js >> logs/lp-monitoring.log 2>&1") | crontab -
  echo "✅ Added LP gap monitoring to cron (hourly)"
fi

# Check if validation already exists  
if crontab -l 2>/dev/null | grep -q "validate-automation"; then
  echo "Automation validation already in cron"
else
  # Add validation check (daily at 6 AM)
  (crontab -l 2>/dev/null; echo "0 6 * * * cd $(pwd) && node validate-automation.js >> logs/validation.log 2>&1") | crontab -
  echo "✅ Added automation validation to cron (daily)"
fi

echo "✅ Cron setup complete"
crontab -l | grep -E "(monitor-lp|validate-automation)"
