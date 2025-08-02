#!/bin/bash

# Proper Clean Rebuild
# Creates temporary symlinks so scripts work unmodified

echo "=== CLEAN REBUILD WITH PROPER PATHS ==="
echo "Starting at: $(date)"
echo ""

cd /home/wsl/projects/TORUSspecs/torus-dashboard

# Create a temporary public/data symlink to clean-rebuild/data
echo "Setting up clean data directory..."
mv public/data public/data-original
ln -s ../clean-rebuild/data public/data

echo "✓ Data directory redirected to clean-rebuild"
echo ""

# Run the original scripts unmodified
echo "1. Running full dashboard update..."
node scripts/data-updates/update-all-dashboard-data.js

echo ""
echo "2. Running payment matching..."
node comprehensive-payment-matching.js

echo ""
echo "3. Running buy process update..."
node scripts/update-buy-process-data.js

# Restore original data directory
echo ""
echo "Restoring original data directory..."
rm public/data
mv public/data-original public/data

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
console.log('- Day 21 creates:', data.stakingData?.createEvents?.filter(c => c.protocolDay === 21).length || 0);
"