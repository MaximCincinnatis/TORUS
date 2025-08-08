#!/usr/bin/env node

const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));

// Import the projection functions
const { calculateFutureMaxSupply, convertToPositions } = require('./src/utils/maxSupplyProjection');

const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
const currentProtocolDay = 29;

// Convert events to positions
const positions = convertToPositions(
  data.stakingData.stakeEvents || [],
  data.stakingData.createEvents || []
);

console.log('Total positions:', positions.length);

// Get reward pool data
const rewardPoolData = data.stakingData.rewardPoolData;
console.log('Reward pool data days:', rewardPoolData.length);

// Run the projection
const projections = calculateFutureMaxSupply(
  positions,
  rewardPoolData,
  data.stakingData.totals.totalSupply,
  CONTRACT_START_DATE,
  currentProtocolDay
);

// Find the days with issues
const problemDays = [111, 112, 116];
problemDays.forEach(day => {
  const projection = projections.find(p => p.day === day);
  if (projection) {
    console.log(`\nDay ${day}:`);
    console.log(`  Total Max Supply: ${projection.totalMaxSupply.toFixed(2)}`);
    console.log(`  Active Positions: ${projection.activePositions}`);
    console.log(`  Daily Reward Pool: ${projection.dailyRewardPool.toFixed(2)}`);
    console.log(`  Total Shares: ${(projection.totalShares/1e6).toFixed(2)}M`);
    console.log(`  From Stakes: ${projection.breakdown.fromStakes.toFixed(2)}`);
    console.log(`  From Creates: ${projection.breakdown.fromCreates.toFixed(2)}`);
  }
});