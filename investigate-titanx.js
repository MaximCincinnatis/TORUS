// Investigate TitanX amounts to see if they're too low
const fs = require('fs');

const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
const createEvents = data.stakingData.createEvents;

console.log('🔍 INVESTIGATING TITANX AMOUNTS...');
console.log(`Total create events: ${createEvents.length}`);

// Analyze TitanX distribution
let totalTitanX = 0;
let createsWithTitanX = 0;
let createsWithoutTitanX = 0;
let titanXAmounts = [];

createEvents.forEach((create, i) => {
  if (create.titanAmount && create.titanAmount !== '0') {
    const amount = parseFloat(create.titanAmount) / 1e18;
    totalTitanX += amount;
    titanXAmounts.push(amount);
    createsWithTitanX++;
    
    // Show first few and some large ones
    if (i < 10 || amount > 100000) {
      console.log(`Create ${i}: ${amount.toLocaleString()} TitanX`);
    }
  } else {
    createsWithoutTitanX++;
  }
});

console.log(`\n📊 TITANX DISTRIBUTION:`);
console.log(`Creates with TitanX: ${createsWithTitanX}`);
console.log(`Creates without TitanX: ${createsWithoutTitanX}`);
console.log(`Total TitanX: ${totalTitanX.toLocaleString()}`);

if (titanXAmounts.length > 0) {
  titanXAmounts.sort((a, b) => b - a); // Sort descending
  console.log(`\nTop 10 TitanX amounts:`);
  titanXAmounts.slice(0, 10).forEach((amount, i) => {
    console.log(`  ${i + 1}. ${amount.toLocaleString()} TitanX`);
  });
  
  console.log(`\nTitanX Statistics:`);
  console.log(`  Largest: ${titanXAmounts[0].toLocaleString()}`);
  console.log(`  Smallest: ${titanXAmounts[titanXAmounts.length - 1].toLocaleString()}`);
  console.log(`  Average: ${(totalTitanX / titanXAmounts.length).toLocaleString()}`);
  console.log(`  Median: ${titanXAmounts[Math.floor(titanXAmounts.length / 2)].toLocaleString()}`);
}

// Check if recent events might be missing
console.log(`\n📅 EVENT TIMELINE:`);
const sortedByTimestamp = [...createEvents].sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp));
console.log(`Earliest create: ${new Date(parseInt(sortedByTimestamp[0].timestamp) * 1000).toISOString().split('T')[0]}`);
console.log(`Latest create: ${new Date(parseInt(sortedByTimestamp[sortedByTimestamp.length - 1].timestamp) * 1000).toISOString().split('T')[0]}`);

// Show recent creates with TitanX amounts
console.log(`\nRecent creates with TitanX (last 5):`);
const recentWithTitanX = sortedByTimestamp
  .filter(c => c.titanAmount && c.titanAmount !== '0')
  .slice(-5);

recentWithTitanX.forEach((create, i) => {
  const amount = parseFloat(create.titanAmount) / 1e18;
  const date = new Date(parseInt(create.timestamp) * 1000).toISOString().split('T')[0];
  console.log(`  ${date}: ${amount.toLocaleString()} TitanX`);
});

console.log(`\n🤔 ANALYSIS:`);
console.log(`Current total: ${totalTitanX.toLocaleString()} TitanX`);
console.log(`Expected: Hundreds of millions or billions`);
console.log(`Ratio: Current is ${(totalTitanX / 1000000).toFixed(1)}M (expecting 100M-1B+)`);

if (totalTitanX < 100000000) { // Less than 100M
  console.log(`\n🚨 CONCLUSION: TitanX amounts ARE too low!`);
  console.log(`Possible causes:`);
  console.log(`1. Missing create events (not fetching all historical data)`);
  console.log(`2. Wrong contract being queried`);
  console.log(`3. TitanX amounts in events don't include all sources`);
  console.log(`4. Cache is outdated and missing recent high-value creates`);
} else {
  console.log(`\n✅ TitanX amounts appear reasonable`);
}