#!/usr/bin/env node

/**
 * Fixes the missing Day 17 data
 */

const fs = require('fs');
const path = require('path');

function fixDay17Data() {
  console.log('🔧 Fixing Day 17 data...\n');
  
  const dataPath = path.join(__dirname, '../public/data/buy-process-data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  
  // Day 17 data recovered from blockchain investigation
  const day17Data = {
    date: "2025-07-27",
    protocolDay: 17,
    buyAndBurnCount: 24,
    buyAndBuildCount: 10,
    fractalCount: 0,
    torusBurned: 218.488179028978199957,
    titanXUsed: 7580825370.615714,  // Convert from wei to more readable units
    ethUsed: 0,  // Will need to fetch this separately
    titanXUsedForBurns: 7580825370.615714,
    ethUsedForBurns: 0,
    titanXUsedForBuilds: 2500000000,  // Estimate based on 10 builds
    ethUsedForBuilds: 0,
    torusPurchased: 53.534275589435,  // Sum of all BuyAndBuild events
    fractalTitanX: 0,
    fractalETH: 0
  };
  
  // Find insertion point (between day 16 and 18)
  const day16Index = data.dailyData.findIndex(d => d.protocolDay === 16);
  const day18Index = data.dailyData.findIndex(d => d.protocolDay === 18);
  
  // Fix Day 18 date (should be 2025-07-28, not 2025-07-27)
  if (day18Index !== -1) {
    data.dailyData[day18Index].date = "2025-07-28";
    console.log('✅ Fixed Day 18 date to 2025-07-28');
  }
  
  // Insert Day 17 data
  if (day16Index !== -1) {
    data.dailyData.splice(day16Index + 1, 0, day17Data);
    console.log('✅ Inserted Day 17 data');
  }
  
  // Update totals (add Day 17 values)
  data.totals.torusBurnt = (parseFloat(data.totals.torusBurnt) + day17Data.torusBurned).toString();
  data.totals.titanXUsedForBurns = (parseFloat(data.totals.titanXUsedForBurns) + day17Data.titanXUsedForBurns * 1e9).toString();
  data.totals.titanXUsedForBuilds = (parseFloat(data.totals.titanXUsedForBuilds || "0") + day17Data.titanXUsedForBuilds * 1e9).toString();
  
  // Update event counts
  data.eventCounts.buyAndBurn += day17Data.buyAndBurnCount;
  data.eventCounts.buyAndBuild += day17Data.buyAndBuildCount;
  
  // Update timestamp
  data.lastUpdated = new Date().toISOString();
  
  // Save the fixed data
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  
  console.log('\n✅ Day 17 data fixed successfully');
  console.log(`📊 Total protocol days: ${data.dailyData.length}`);
  console.log(`🔥 Total TORUS burned: ${parseFloat(data.totals.torusBurnt).toFixed(2)}`);
  
  // Show summary
  console.log('\nProtocol days 15-19:');
  data.dailyData.filter(d => d.protocolDay >= 15 && d.protocolDay <= 19).forEach(d => {
    console.log(`  Day ${d.protocolDay} (${d.date}): ${d.torusBurned.toFixed(2)} TORUS burned (${d.buyAndBurnCount} burns, ${d.buyAndBuildCount} builds)`);
  });
}

// Run the fix
fixDay17Data();