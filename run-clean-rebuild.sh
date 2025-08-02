#!/bin/bash

# Simple clean rebuild - backup, run, save

echo "=== SIMPLE CLEAN REBUILD ==="
echo "Starting at: $(date)"
echo ""

# 1. Backup current data
echo "1. Backing up current data..."
mkdir -p backup-$(date +%Y%m%d-%H%M%S)
cp public/data/*.json backup-$(date +%Y%m%d-%H%M%S)/

# 2. Clear data for clean rebuild
echo "2. Clearing data for clean rebuild..."
echo '{"lastUpdated":"","version":"1.0.0","poolData":{},"lpPositions":[],"stakingData":{"stakeEvents":[],"createEvents":[],"rewardPoolData":[],"currentProtocolDay":21,"totalSupply":"0","burnedSupply":"0","lastUpdated":"","metadata":{},"lastBlock":0},"metadata":{}}' > public/data/cached-data.json
echo '{"lastUpdated":"","currentDay":21,"totals":{"torusBurnt":"0","titanXBurnt":"0","ethBurn":"0","titanXUsedForBurns":"0","ethUsedForBurns":"0","ethUsedForBuilds":"0"},"dailyData":[],"eventCounts":{"buyAndBurn":0,"buyAndBuild":0,"fractal":0},"metadata":{"lastBlock":0}}' > public/data/buy-process-data.json
echo '{"lastUpdated":"","lastBlock":0,"nftPosition":{},"feeDrivenBurns":[],"totals":{"feeCollections":0,"torusCollected":"0","torusBurned":"0","titanxCollected":"0","averageBurnRate":"0"}}' > public/data/buy-process-burns.json

# 3. Run full update
echo "3. Running full update (this will take HOURS)..."
node scripts/data-updates/update-all-dashboard-data.js

echo ""
echo "4. Running payment matching..."
node comprehensive-payment-matching.js

echo ""
echo "5. Running buy process update..."
node scripts/update-buy-process-data.js

# 4. Save clean results
echo ""
echo "6. Saving clean results..."
mkdir -p clean-rebuild-results
cp public/data/*.json clean-rebuild-results/

echo ""
echo "=== COMPLETE ==="
echo "Clean data saved to: clean-rebuild-results/"
echo "Backup saved to: backup-*/"

# Quick check
echo ""
echo "=== RESULTS ==="
node -e "
const data = JSON.parse(require('fs').readFileSync('./clean-rebuild-results/cached-data.json'));
console.log('- Total creates:', data.stakingData?.createEvents?.length || 0);
console.log('- Creates with eventId:', data.stakingData?.createEvents?.filter(c => c.eventId).length || 0);
console.log('- Day 21 creates:', data.stakingData?.createEvents?.filter(c => c.protocolDay === 21).length || 0);
"