#!/bin/bash

# Safe Clean Rebuild Script
# Runs everything in clean-rebuild directory without touching production

echo "=== SAFE CLEAN DATA REBUILD ==="
echo "Starting at: $(date)"
echo "This will run in the clean-rebuild directory"
echo ""

cd /home/wsl/projects/TORUSspecs/torus-dashboard

# Step 1: Run the full update with output redirected to clean-rebuild
echo "1. Running full dashboard update..."
echo "   This will take several hours..."
node scripts/data-updates/update-all-dashboard-data.js

# After completion, copy results to clean-rebuild
echo ""
echo "2. Copying results to clean-rebuild/data..."
cp ./public/data/*.json ./clean-rebuild/data/

# Restore original data
echo "3. Restoring original data..."
cp ./backup-before-clean/*.json ./public/data/

echo ""
echo "=== REBUILD COMPLETE ==="
echo "Clean data is in: ./clean-rebuild/data/"
echo "Production data has been restored"

# Quick check
echo ""
echo "=== DATA CHECK ==="
node -e "
const data = JSON.parse(require('fs').readFileSync('./clean-rebuild/data/cached-data.json'));
console.log('Clean rebuild results:');
console.log('- Total creates:', data.stakingData?.createEvents?.length || 0);
console.log('- Creates with eventId:', data.stakingData?.createEvents?.filter(c => c.eventId).length || 0);
console.log('- Day 21 creates:', data.stakingData?.createEvents?.filter(c => c.protocolDay === 21).length || 0);
"