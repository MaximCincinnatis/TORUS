#!/bin/bash

# Clean Rebuild Script
# Simple approach: Copy data to public/data, run scripts, copy back

echo "=== CLEAN DATA REBUILD ==="
echo "Starting at: $(date)"

# Backup current data
echo "1. Backing up current data..."
mkdir -p ./backup-before-clean
cp ./public/data/*.json ./backup-before-clean/ 2>/dev/null || true

# Copy our clean data to public/data
echo "2. Installing clean data..."
cp ./clean-rebuild/data/*.json ./public/data/

# Run the main update script
echo "3. Running full dashboard update..."
cd ..
node scripts/data-updates/update-all-dashboard-data.js

# Run payment matching
echo "4. Running payment matching..."
node comprehensive-payment-matching.js

# Run buy process update
echo "5. Running buy process update..."
node scripts/update-buy-process-data.js

# Copy results back to clean-rebuild
echo "6. Copying results..."
cp ./public/data/*.json ./clean-rebuild/data/

echo ""
echo "=== COMPLETE ==="
echo "Results are in: ./clean-rebuild/data/"
echo "Backup of original is in: ./backup-before-clean/"

# Quick check of results
echo ""
echo "=== DATA CHECK ==="
node -e "
const data = JSON.parse(require('fs').readFileSync('./clean-rebuild/data/cached-data.json'));
console.log('Total creates:', data.stakingData?.createEvents?.length || 0);
console.log('Creates with eventId:', data.stakingData?.createEvents?.filter(c => c.eventId).length || 0);
console.log('Creates with protocolDay:', data.stakingData?.createEvents?.filter(c => c.protocolDay).length || 0);
console.log('Day 21 creates:', data.stakingData?.createEvents?.filter(c => c.protocolDay === 21).length || 0);
"