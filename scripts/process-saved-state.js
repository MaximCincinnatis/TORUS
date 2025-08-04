#!/usr/bin/env node

/**
 * Processes the saved state from rebuild-buy-process-data-corrected.js
 * This handles the case where all events were fetched but processing failed
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Contract start date for protocol day calculation
const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');

// Helper function to calculate protocol day from timestamp
function getProtocolDay(timestamp) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const timeSinceStart = (timestamp * 1000) - CONTRACT_START_DATE.getTime();
  return Math.floor(timeSinceStart / msPerDay) + 1;
}

// Helper function to get date string for a protocol day
function getDateForProtocolDay(protocolDay) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const dayStart = new Date(CONTRACT_START_DATE.getTime() + ((protocolDay - 1) * msPerDay));
  return dayStart.toISOString().split('T')[0];
}

async function processSavedState() {
  console.log('Processing saved state...\n');
  
  const STATE_FILE = path.join(__dirname, '.rebuild-state-corrected.json');
  
  if (!fs.existsSync(STATE_FILE)) {
    console.error('No state file found!');
    process.exit(1);
  }
  
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  
  console.log(`Loaded state with:`);
  console.log(`- ${state.buyAndBurnEvents.length} Buy & Burn events`);
  console.log(`- ${state.buyAndBuildEvents.length} Buy & Build events`);
  console.log(`- ${state.fractalEvents.length} Fractal events`);
  console.log(`- ${state.burnTransfers.length} burn transfers`);
  
  // Process events into daily data grouped by PROTOCOL DAY
  console.log('\nProcessing events by protocol day...');
  
  const dailyData = {};
  
  // First, process TORUS burn transfers to get accurate burn amounts by protocol day
  const burnsByDay = {};
  
  for (const transfer of state.burnTransfers) {
    const timestamp = state.blockTimestamps[transfer.blockNumber];
    if (!timestamp) {
      console.warn(`Missing timestamp for block ${transfer.blockNumber}`);
      continue;
    }
    
    const protocolDay = getProtocolDay(timestamp);
    
    if (!burnsByDay[protocolDay]) {
      burnsByDay[protocolDay] = ethers.BigNumber.from(0);
    }
    
    // Check if transfer has valid data
    if (transfer.data && transfer.data !== '0x') {
      burnsByDay[protocolDay] = burnsByDay[protocolDay].add(transfer.data);
    } else if (transfer.args && transfer.args.value) {
      burnsByDay[protocolDay] = burnsByDay[protocolDay].add(transfer.args.value);
    } else {
      console.warn(`Invalid transfer data for tx ${transfer.transactionHash}`);
    }
  }
  
  // Process Buy & Burn events
  for (const event of state.buyAndBurnEvents) {
    const timestamp = state.blockTimestamps[event.blockNumber];
    if (!timestamp) continue;
    
    const protocolDay = getProtocolDay(timestamp);
    const dateKey = getDateForProtocolDay(protocolDay);
    
    if (!dailyData[dateKey]) {
      dailyData[dateKey] = {
        date: dateKey,
        protocolDay: protocolDay,
        buyAndBurnCount: 0,
        buyAndBuildCount: 0,
        fractalCount: 0,
        torusBurned: 0,
        titanXUsed: 0,
        ethUsed: 0,
        titanXUsedForBurns: 0,
        ethUsedForBurns: 0,
        titanXUsedForBuilds: 0,
        ethUsedForBuilds: 0,
        torusPurchased: 0,
        fractalTitanX: 0,
        fractalETH: 0
      };
    }
    
    dailyData[dateKey].buyAndBurnCount++;
    
    // Extract titanX amount from topics
    let titanXAmount;
    if (event.topics && event.topics[1]) {
      titanXAmount = ethers.BigNumber.from(event.topics[1]);
    } else if (event.args && event.args.titanXAmount) {
      titanXAmount = event.args.titanXAmount;
    } else {
      console.warn(`Missing titanX amount for event at block ${event.blockNumber}`);
      continue;
    }
    
    const titanXFormatted = parseFloat(ethers.utils.formatEther(titanXAmount));
    dailyData[dateKey].titanXUsed += titanXFormatted;
    dailyData[dateKey].titanXUsedForBurns += titanXFormatted;
  }
  
  // Process Buy & Build events
  for (const event of state.buyAndBuildEvents) {
    const timestamp = state.blockTimestamps[event.blockNumber];
    if (!timestamp) continue;
    
    const protocolDay = getProtocolDay(timestamp);
    const dateKey = getDateForProtocolDay(protocolDay);
    
    if (!dailyData[dateKey]) {
      dailyData[dateKey] = {
        date: dateKey,
        protocolDay: protocolDay,
        buyAndBurnCount: 0,
        buyAndBuildCount: 0,
        fractalCount: 0,
        torusBurned: 0,
        titanXUsed: 0,
        ethUsed: 0,
        titanXUsedForBurns: 0,
        ethUsedForBurns: 0,
        titanXUsedForBuilds: 0,
        ethUsedForBuilds: 0,
        torusPurchased: 0,
        fractalTitanX: 0,
        fractalETH: 0
      };
    }
    
    dailyData[dateKey].buyAndBuildCount++;
    
    // Extract amounts from topics
    let tokenAllocated, torusPurchased;
    if (event.topics && event.topics[1] && event.topics[2]) {
      tokenAllocated = ethers.BigNumber.from(event.topics[1]);
      torusPurchased = ethers.BigNumber.from(event.topics[2]);
    } else if (event.args) {
      tokenAllocated = event.args.tokenAllocated;
      torusPurchased = event.args.torusPurchased;
    } else {
      console.warn(`Missing data for build event at block ${event.blockNumber}`);
      continue;
    }
    
    dailyData[dateKey].torusPurchased += parseFloat(ethers.utils.formatEther(torusPurchased));
    
    // Default to TitanX for now
    const amount = parseFloat(ethers.utils.formatEther(tokenAllocated));
    dailyData[dateKey].titanXUsed += amount;
    dailyData[dateKey].titanXUsedForBuilds += amount;
  }
  
  // Set actual TORUS burned amounts from Transfer events
  for (const [protocolDay, burnAmount] of Object.entries(burnsByDay)) {
    const dateKey = getDateForProtocolDay(protocolDay);
    if (!dailyData[dateKey]) {
      dailyData[dateKey] = {
        date: dateKey,
        protocolDay: parseInt(protocolDay),
        buyAndBurnCount: 0,
        buyAndBuildCount: 0,
        fractalCount: 0,
        torusBurned: 0,
        titanXUsed: 0,
        ethUsed: 0,
        titanXUsedForBurns: 0,
        ethUsedForBurns: 0,
        titanXUsedForBuilds: 0,
        ethUsedForBuilds: 0,
        torusPurchased: 0,
        fractalTitanX: 0,
        fractalETH: 0
      };
    }
    
    // Use actual burn amount from Transfer events
    dailyData[dateKey].torusBurned = parseFloat(ethers.utils.formatEther(burnAmount));
  }
  
  // Convert to array and sort
  const dailyDataArray = Object.values(dailyData).sort((a, b) => a.protocolDay - b.protocolDay);
  
  // Calculate totals from actual Transfer events
  let totalTorusBurnt = ethers.BigNumber.from(0);
  for (const burnAmount of Object.values(burnsByDay)) {
    totalTorusBurnt = totalTorusBurnt.add(burnAmount);
  }
  
  // Calculate current protocol day
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const currentProtocolDay = getProtocolDay(currentTimestamp);
  
  // Calculate other totals from daily data
  const totals = dailyDataArray.reduce((acc, day) => {
    acc.titanXUsedForBurns += day.titanXUsedForBurns;
    acc.ethUsedForBurns += day.ethUsedForBurns;
    acc.ethUsedForBuilds += day.ethUsedForBuilds;
    return acc;
  }, { titanXUsedForBurns: 0, ethUsedForBurns: 0, ethUsedForBuilds: 0 });
  
  // Build final data structure
  const outputData = {
    lastUpdated: new Date().toISOString(),
    currentDay: currentProtocolDay,
    totals: {
      torusBurnt: ethers.utils.formatEther(totalTorusBurnt),
      titanXBurnt: "0.0", // Would need contract call
      ethBurn: totals.ethUsedForBurns.toString(),
      titanXUsedForBurns: totals.titanXUsedForBurns.toString(),
      ethUsedForBurns: totals.ethUsedForBurns.toString(),
      ethUsedForBuilds: totals.ethUsedForBuilds.toString()
    },
    dailyData: dailyDataArray,
    eventCounts: {
      buyAndBurn: state.buyAndBurnEvents.length,
      buyAndBuild: state.buyAndBuildEvents.length,
      fractal: state.fractalEvents.length
    },
    metadata: {
      lastBlock: state.lastProcessedBlock,
      rebuiltWithCorrectProtocolDays: true,
      processedFromSavedState: true
    }
  };
  
  // Save the corrected data
  const outputPath = path.join(__dirname, '../public/data/buy-process-data-corrected.json');
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
  
  console.log('\n✅ Successfully processed saved state!');
  console.log(`Output saved to: ${outputPath}`);
  console.log(`Total TORUS burned: ${ethers.utils.formatEther(totalTorusBurnt)} TORUS`);
  console.log(`Protocol days with data: ${dailyDataArray.length}`);
  
  // Show summary
  console.log('\nDaily summary:');
  for (const day of dailyDataArray.slice(0, 5)) {
    console.log(`Day ${day.protocolDay}: ${day.torusBurned.toFixed(2)} TORUS burned`);
  }
  console.log('...');
}

processSavedState().catch(console.error);