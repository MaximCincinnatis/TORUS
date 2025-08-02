#!/bin/bash

# Isolated Clean Rebuild
# Runs copied scripts that write to clean-rebuild/data

echo "=== ISOLATED CLEAN REBUILD ==="
echo "Starting at: $(date)"
echo ""

cd /home/wsl/projects/TORUSspecs/torus-dashboard/clean-rebuild

# First, modify the scripts to use clean-rebuild/data instead of public/data
echo "Modifying scripts to use clean-rebuild/data directory..."

# Replace all instances of public/data with clean-rebuild/data in the scripts
sed -i 's|public/data|clean-rebuild/data|g' scripts/*.js
sed -i 's|./public/data|./clean-rebuild/data|g' scripts/*.js
sed -i 's|"./public/data"|"./clean-rebuild/data"|g' scripts/*.js

# Also fix the shared directory references
sed -i 's|shared/|../shared/|g' scripts/*.js 2>/dev/null || true
sed -i 's|scripts/|clean-rebuild/scripts/|g' scripts/*.js 2>/dev/null || true

echo "✓ Scripts modified to use isolated data directory"
echo ""

# Now run the scripts
echo "1. Running full dashboard update..."
cd ..
node clean-rebuild/scripts/update-all-dashboard-data.js

echo ""
echo "2. Running payment matching..."
node clean-rebuild/scripts/comprehensive-payment-matching.js

echo ""
echo "3. Running buy process update..."
node clean-rebuild/scripts/update-buy-process-data.js

echo ""
echo "=== REBUILD COMPLETE ==="
echo "Clean data is in: ./clean-rebuild/data/"
echo ""

# Check results
echo "=== DATA CHECK ==="
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./clean-rebuild/data/cached-data.json'));
console.log('Clean rebuild results:');
console.log('- Total creates:', data.stakingData?.createEvents?.length || 0);
console.log('- Creates with eventId:', data.stakingData?.createEvents?.filter(c => c.eventId).length || 0);
console.log('- Creates with protocolDay:', data.stakingData?.createEvents?.filter(c => c.protocolDay).length || 0);
console.log('- Day 21 creates:', data.stakingData?.createEvents?.filter(c => c.protocolDay === 21).length || 0);
"