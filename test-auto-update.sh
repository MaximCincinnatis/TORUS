#!/bin/bash

echo "=== Testing Auto-Update System ==="
echo "Current time: $(date)"
echo "Working directory: $(pwd)"
echo ""

# Check if logs directory exists
if [ -d "logs" ]; then
    echo "✓ Logs directory exists"
else
    echo "✗ Logs directory missing - creating it"
    mkdir -p logs
fi

# Check last update time
if [ -f "logs/auto-update-fixed.log" ]; then
    echo "✓ Log file exists"
    echo "Last update entry:"
    tail -1 logs/auto-update-fixed.log
else
    echo "✗ No log file found"
fi

echo ""
echo "Testing manual run..."
/home/wsl/projects/TORUSspecs/torus-dashboard/run-auto-update.sh

echo ""
echo "=== Test Complete ==="