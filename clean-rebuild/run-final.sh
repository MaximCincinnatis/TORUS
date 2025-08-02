#!/bin/bash

# Final Clean Rebuild Script
# Runs the modified scripts that write to clean-rebuild/data

echo "=== CLEAN REBUILD - FINAL VERSION ==="
echo "Starting at: $(date)"
echo "Data will be written to: clean-rebuild/data/"
echo ""

cd /home/wsl/projects/TORUSspecs/torus-dashboard

# Run the scripts in order
echo "1. Running full dashboard update..."
echo "   This will take HOURS..."
node clean-rebuild/scripts/update-all-dashboard-data.js

echo ""
echo "2. Running comprehensive payment matching..."  
node clean-rebuild/scripts/comprehensive-payment-matching.js

echo ""
echo "3. Running buy process update..."
node clean-rebuild/scripts/update-buy-process-data.js

echo ""
echo "4. Running creates/stakes incremental..."
node clean-rebuild/scripts/update-creates-stakes-incremental.js

echo ""
echo "=== REBUILD COMPLETE ==="
echo "Finished at: $(date)"
echo ""

# Check results
echo "=== DATA CHECK ==="
if [ -f clean-rebuild/data/cached-data.json ]; then
  node -e "
  const data = JSON.parse(require('fs').readFileSync('./clean-rebuild/data/cached-data.json'));
  console.log('Clean rebuild results:');
  console.log('- Total creates:', data.stakingData?.createEvents?.length || 0);
  console.log('- Creates with eventId:', data.stakingData?.createEvents?.filter(c => c.eventId).length || 0);
  console.log('- Creates with protocolDay:', data.stakingData?.createEvents?.filter(c => c.protocolDay).length || 0);
  console.log('- Day 21 creates:', data.stakingData?.createEvents?.filter(c => c.protocolDay === 21).length || 0);
  console.log('- LP positions:', data.lpPositions?.length || 0);
  console.log('- Buy & burn events:', data.buyProcessData?.eventCounts?.buyAndBurn || 'N/A');
  "
else
  echo "ERROR: cached-data.json not found!"
fi