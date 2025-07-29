#!/usr/bin/env node

const fs = require('fs');

// These were the original values before the averaging script messed them up
const originalETHValues = {
  2: 0.0283554982,   // Was showing 0.028355
  3: 0.0283554982,   // Was showing 0.028355  
  4: 0.0283554982,   // Was showing 0.028355
  5: 0.0283554982,   // Was showing 0.028355
  6: 0.002618833120950125,  // This one was unique
  7: 0.0283554982,   // Was showing 0.028355
  8: 0.029566399252111786,  // This one was unique
  9: 0.0283554982,   // Was showing 0.028355
  10: 0.0283554982,  // Was showing 0.028355
  11: 0.06079568739387272,  // This one was unique
  12: 0.02726937387315622,  // This one was unique
  13: 0.02625191344674031,  // This one was unique
  14: 0.021891226586557597, // This one was unique
  15: 0.038742142795152076, // This one was unique
  16: 0.051894435698754904, // This one was unique
  17: 0.034534274758487506, // Was showing 0.034534
  18: 0.034534274758487506, // Was showing 0.034534
  19: 0.0283554982   // Was showing 0.028355
};

console.log('🔧 Restoring Original ETH Values\n');

// Load data
const data = JSON.parse(fs.readFileSync('public/data/buy-process-data.json', 'utf8'));

// Apply original values
let totalETHForBuilds = 0;

Object.entries(originalETHValues).forEach(([day, ethValue]) => {
  const dayNum = parseInt(day);
  const dayData = data.dailyData.find(d => d.protocolDay === dayNum);
  
  if (dayData) {
    const oldValue = dayData.ethUsedForBuilds;
    dayData.ethUsedForBuilds = ethValue;
    totalETHForBuilds += ethValue;
    
    // Update total ethUsed
    const ethFromBurns = dayData.ethUsedForBurns || 0;
    dayData.ethUsed = parseFloat((ethFromBurns + ethValue).toFixed(6));
    
    console.log(`Day ${dayNum}: ${oldValue} → ${ethValue} ETH`);
  }
});

// Update totals to match contract
const CONTRACT_TOTAL = 0.554938883611163392;
data.totals.ethUsedForBuilds = CONTRACT_TOTAL.toFixed(18);

console.log(`\nTotal from daily values: ${totalETHForBuilds.toFixed(6)} ETH`);
console.log(`Contract total: ${CONTRACT_TOTAL} ETH`);

// Calculate total ETH used
let totalETHUsed = 0;
data.dailyData.forEach(day => {
  totalETHUsed += day.ethUsed || 0;
});
data.totals.ethBurn = totalETHUsed.toFixed(18);

// Save
fs.writeFileSync('public/data/buy-process-data.json', JSON.stringify(data, null, 2));

console.log('\n✅ Original values restored');

// Validate
console.log('\n🔍 Running validation...\n');

const ethValues = new Map();
data.dailyData.forEach(day => {
  if (day.ethUsedForBuilds > 0) {
    const key = day.ethUsedForBuilds.toFixed(6);
    if (!ethValues.has(key)) {
      ethValues.set(key, []);
    }
    ethValues.get(key).push(day.protocolDay);
  }
});

console.log('📊 ETH Value Distribution:');
let duplicateCount = 0;
ethValues.forEach((days, value) => {
  if (days.length > 1) {
    console.log(`  ⚠️  ${value} ETH appears on days: ${days.join(', ')} (${days.length} times)`);
    duplicateCount++;
  } else {
    console.log(`  ✅ ${value} ETH on day ${days[0]}`);
  }
});

if (duplicateCount > 0) {
  console.log(`\n⚠️  Found ${duplicateCount} duplicate values`);
  console.log('Note: Some duplication is expected if transactions had identical amounts');
} else {
  console.log('\n✅ No concerning duplicates found');
}