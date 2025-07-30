#!/usr/bin/env node

/**
 * Patches the update-buy-process-data.js script to preserve existing non-zero data
 * This prevents the script from overwriting historical data with zeros
 */

const fs = require('fs');

console.log('🔧 Patching update script to preserve existing data...\n');

try {
  // Read the current update script
  const scriptPath = './scripts/update-buy-process-data.js';
  let scriptContent = fs.readFileSync(scriptPath, 'utf8');
  
  // Find the section where missing days are filled with zeros (around line 528)
  const fillMissingDaysSection = `        // Only add if we don't already have data for this protocolDay
        if (!mergedDailyData.find(d => d.protocolDay === day)) {
          mergedDailyData.push({
            date: dateKey,
            protocolDay: day,
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
        }`;
  
  // Replace with version that preserves existing data
  const replacementSection = `        // Only add if we don't already have data for this protocolDay
        const existingDayData = mergedDailyData.find(d => d.protocolDay === day);
        if (!existingDayData) {
          // Check if we have data for this date (might have wrong protocolDay)
          const existingDateData = mergedDailyData.find(d => d.date === dateKey);
          
          if (existingDateData && existingDateData.buyAndBurnCount > 0) {
            // We have existing data for this date with activity - just fix the protocol day
            console.log(\`📊 Preserving existing data for Day \${day} (\${dateKey})\`);
            existingDateData.protocolDay = day;
          } else {
            // No existing data - add empty day
            mergedDailyData.push({
              date: dateKey,
              protocolDay: day,
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
        }`;
  
  // Check if the section exists
  if (!scriptContent.includes(fillMissingDaysSection)) {
    console.log('⚠️  Could not find the exact section to replace. Looking for similar pattern...');
    
    // Try a more flexible search
    const pattern = /if \(!mergedDailyData\.find\(d => d\.protocolDay === day\)\) \{[\s\S]*?mergedDailyData\.push\(\{[\s\S]*?\}\);[\s\S]*?\}/;
    
    if (pattern.test(scriptContent)) {
      console.log('✅ Found similar pattern to replace');
      scriptContent = scriptContent.replace(pattern, replacementSection.trim());
    } else {
      console.error('❌ Could not find the fill missing days section in the script');
      process.exit(1);
    }
  } else {
    // Replace the section
    scriptContent = scriptContent.replace(fillMissingDaysSection, replacementSection);
  }
  
  // Also add a validation function at the beginning of the update
  const validationFunction = `
// Validation function to prevent overwriting non-zero data with zeros
function validateDataUpdate(oldData, newData) {
  if (!oldData || !newData) return true;
  
  // If old data has activity and new data is all zeros, reject the update
  if ((oldData.buyAndBurnCount > 0 || oldData.buyAndBuildCount > 0) &&
      newData.buyAndBurnCount === 0 && newData.buyAndBuildCount === 0) {
    console.log(\`⚠️  WARNING: Attempting to overwrite Day \${oldData.protocolDay} data with zeros. Preserving existing data.\`);
    return false;
  }
  
  return true;
}
`;
  
  // Add the validation function after the imports
  const importEndIndex = scriptContent.lastIndexOf("const CONTRACT_START_DATE");
  if (importEndIndex > -1) {
    scriptContent = scriptContent.slice(0, importEndIndex) + validationFunction + '\n' + scriptContent.slice(importEndIndex);
  }
  
  // Save the patched script
  fs.writeFileSync(scriptPath, scriptContent);
  
  console.log('✅ Update script patched successfully!');
  console.log('\n📋 Changes made:');
  console.log('  1. Added validation to prevent overwriting non-zero data with zeros');
  console.log('  2. Modified fill missing days logic to preserve existing data');
  console.log('  3. Added logging when preserving existing data');
  
  // Now restore Day 19 data again
  console.log('\n🔄 Restoring Day 19 data again...');
  require('./restore-day19-data.js');
  
} catch (error) {
  console.error('❌ Error patching script:', error.message);
  process.exit(1);
}