#!/usr/bin/env node

/**
 * Merge Perfect JSON Structure with Working Event Data
 * 
 * This script takes the working event data and merges it with the perfect JSON structure
 * to create a complete dashboard JSON with accurate cost calculations.
 */

const fs = require('fs');
const { ethers } = require('ethers');

// Load the working data (has events but wrong structure)
const workingData = JSON.parse(fs.readFileSync('./temp-working-data.json', 'utf8'));

// Load the perfect structure (has structure but no events)
const perfectStructure = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));

console.log('🔄 Merging perfect structure with working event data...');

// Take events from working data but fix the cost calculation
const stakeEvents = workingData.stakingData.stakeEvents;
const createEvents = workingData.stakingData.createEvents;

console.log(`📊 Found ${stakeEvents.length} stake events and ${createEvents.length} create events`);

// Calculate correct totals by examining the actual costETH and costTitanX values
let totalStakedETH = 0;
let totalCreatedETH = 0;
let totalStakedTitanX = 0;
let totalCreatedTitanX = 0;

// Process stake events
let stakesWithETH = 0;
let stakesWithTitanX = 0;

stakeEvents.forEach(event => {
  if (event.costETH && event.costETH !== "0" && event.costETH !== 0) {
    // Convert from wei to ETH
    const ethAmount = parseFloat(event.costETH) / 1e18;
    totalStakedETH += ethAmount;
    stakesWithETH++;
  }
  
  if (event.costTitanX && event.costTitanX !== "0" && event.costTitanX !== 0) {
    // Convert from TitanX base units to TitanX tokens
    const titanXAmount = parseFloat(event.costTitanX) / 1e18;
    totalStakedTitanX += titanXAmount;
    stakesWithTitanX++;
  }
});

// Process create events
let createsWithETH = 0;
let createsWithTitanX = 0;

createEvents.forEach(event => {
  if (event.costETH && event.costETH !== "0" && event.costETH !== 0) {
    // Convert from wei to ETH
    const ethAmount = parseFloat(event.costETH) / 1e18;
    totalCreatedETH += ethAmount;
    createsWithETH++;
  }
  
  if (event.costTitanX && event.costTitanX !== "0" && event.costTitanX !== 0) {
    // Convert from TitanX base units to TitanX tokens
    const titanXAmount = parseFloat(event.costTitanX) / 1e18;
    totalCreatedTitanX += titanXAmount;
    createsWithTitanX++;
  }
});

const totalETH = totalStakedETH + totalCreatedETH;
const totalTitanX = totalStakedTitanX + totalCreatedTitanX;

console.log(`💰 Calculated totals:
  Stakes with ETH: ${stakesWithETH}
  Stakes with TitanX: ${stakesWithTitanX}
  Creates with ETH: ${createsWithETH}
  Creates with TitanX: ${createsWithTitanX}
  
  Total ETH: ${totalETH.toFixed(6)}
  Total TitanX: ${totalTitanX.toFixed(2)}
  Staked ETH: ${totalStakedETH.toFixed(6)}
  Created ETH: ${totalCreatedETH.toFixed(6)}
  Staked TitanX: ${totalStakedTitanX.toFixed(2)}
  Created TitanX: ${totalCreatedTitanX.toFixed(2)}`);

// Create the merged perfect JSON
const mergedJson = {
  ...perfectStructure,
  stakingData: {
    ...perfectStructure.stakingData,
    stakeEvents: stakeEvents,
    createEvents: createEvents
  },
  totals: {
    totalETH: totalETH.toFixed(6),
    totalTitanX: totalTitanX.toFixed(2),
    totalStakedETH: totalStakedETH.toFixed(6),
    totalCreatedETH: totalCreatedETH.toFixed(6),
    totalStakedTitanX: totalStakedTitanX.toFixed(2),
    totalCreatedTitanX: totalCreatedTitanX.toFixed(2)
  },
  version: "3.1.0",
  metadata: {
    ...perfectStructure.metadata,
    dataSource: "Merged perfect structure with working event data"
  }
};

// Save the merged JSON
fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(mergedJson, null, 2));

console.log('✅ Merged JSON created successfully!');
console.log(`📄 Final summary:
  - Version: 3.1.0
  - Stake events: ${stakeEvents.length}
  - Create events: ${createEvents.length}
  - Total ETH: ${totalETH.toFixed(6)}
  - Total TitanX: ${totalTitanX.toFixed(2)}
  - Reward pool days: ${mergedJson.stakingData.rewardPoolData.length}
  - Complete structure: ✅`);