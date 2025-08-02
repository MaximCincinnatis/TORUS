#!/bin/bash

# Run original scripts with environment variable to redirect output

echo "=== CLEAN REBUILD WITH ENV VARIABLE ==="
echo "Starting at: $(date)"
echo ""

cd /home/wsl/projects/TORUSspecs/torus-dashboard

# Set environment variable to redirect data writes
export TORUS_DATA_DIR="/home/wsl/projects/TORUSspecs/torus-dashboard/clean-rebuild/data"

# Create clean data files
cp clean-rebuild/data/*.json public/data/

echo "1. Running full dashboard update..."
node scripts/data-updates/update-all-dashboard-data.js

echo ""
echo "2. Running payment matching..."  
node comprehensive-payment-matching.js

echo ""
echo "3. Running buy process update..."
node scripts/update-buy-process-data.js

# Copy results to clean-rebuild
cp public/data/*.json clean-rebuild/data/

# Restore original data
cp backup-before-clean/*.json public/data/

echo ""
echo "=== COMPLETE ==="
echo "Clean data saved to: clean-rebuild/data/"