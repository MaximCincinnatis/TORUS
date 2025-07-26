#!/usr/bin/env node

/**
 * Fix protocol days in buy-process-data.json
 * Combines entries that should be on the same protocol day
 */

const fs = require('fs');
const path = require('path');

function fixProtocolDays() {
  console.log('🔧 Fixing protocol days in buy-process-data.json...\n');
  
  const dataPath = path.join(__dirname, '../public/data/buy-process-data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  
  // Group data by protocol day
  const groupedByProtocolDay = new Map();
  
  data.dailyData.forEach(day => {
    const protocolDay = day.protocolDay;
    
    if (!groupedByProtocolDay.has(protocolDay)) {
      groupedByProtocolDay.set(protocolDay, {
        date: day.date, // Keep the first date for this protocol day
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
      });
    }
    
    const combined = groupedByProtocolDay.get(protocolDay);
    
    // Sum all values
    combined.buyAndBurnCount += day.buyAndBurnCount || 0;
    combined.buyAndBuildCount += day.buyAndBuildCount || 0;
    combined.fractalCount += day.fractalCount || 0;
    combined.torusBurned += day.torusBurned || 0;
    combined.titanXUsed += day.titanXUsed || 0;
    combined.ethUsed += day.ethUsed || 0;
    combined.titanXUsedForBurns += day.titanXUsedForBurns || 0;
    combined.ethUsedForBurns += day.ethUsedForBurns || 0;
    combined.titanXUsedForBuilds += day.titanXUsedForBuilds || 0;
    combined.ethUsedForBuilds += day.ethUsedForBuilds || 0;
    combined.torusPurchased += day.torusPurchased || 0;
    combined.fractalTitanX += day.fractalTitanX || 0;
    combined.fractalETH += day.fractalETH || 0;
    
    // Update date to be the earliest date for this protocol day
    if (day.date < combined.date) {
      combined.date = day.date;
    }
  });
  
  // Convert back to array and sort by protocol day
  const fixedDailyData = Array.from(groupedByProtocolDay.values())
    .sort((a, b) => a.protocolDay - b.protocolDay);
  
  // Show what we're fixing
  console.log('Protocol Day Summary:');
  fixedDailyData.forEach(day => {
    console.log(`  Day ${day.protocolDay}: ${day.date} - ${day.torusBurned.toFixed(2)} TORUS burned`);
  });
  
  // Update the data
  data.dailyData = fixedDailyData;
  data.lastUpdated = new Date().toISOString();
  
  // Save the fixed data
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  
  console.log('\n✅ Protocol days fixed successfully');
  console.log(`📊 Total protocol days: ${fixedDailyData.length}`);
}

// Run the fix
fixProtocolDays();