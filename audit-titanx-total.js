// Audit current TitanX total and estimate if we're missing data
const fs = require('fs');

console.log('🔍 AUDITING CURRENT TITANX TOTAL...');

// Load current cached data
const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
const createEvents = data.stakingData.createEvents;
const stakeEvents = data.stakingData.stakeEvents;

console.log(`📊 Total events: ${createEvents.length + stakeEvents.length}`);
console.log(`📊 Create events: ${createEvents.length}`);
console.log(`📊 Stake events: ${stakeEvents.length}`);

// Calculate current TitanX totals
let totalTitanX = 0;
let eventsWithTitanX = 0;
let eventsWithoutTitanX = 0;

// Check create events
createEvents.forEach(event => {
  if (event.costTitanX && event.costTitanX !== "0") {
    totalTitanX += parseFloat(event.costTitanX) / 1e18;
    eventsWithTitanX++;
  } else {
    eventsWithoutTitanX++;
  }
});

// Check stake events
stakeEvents.forEach(event => {
  if (event.costTitanX && event.costTitanX !== "0") {
    totalTitanX += parseFloat(event.costTitanX) / 1e18;
    eventsWithTitanX++;
  } else {
    eventsWithoutTitanX++;
  }
});

console.log(`\n📊 CURRENT TITANX ANALYSIS:`);
console.log(`  Total TitanX: ${totalTitanX.toLocaleString()} TitanX`);
console.log(`  Events with TitanX: ${eventsWithTitanX}`);
console.log(`  Events without TitanX: ${eventsWithoutTitanX}`);
console.log(`  Coverage: ${((eventsWithTitanX / (eventsWithTitanX + eventsWithoutTitanX)) * 100).toFixed(1)}%`);

// Estimate if we're missing data
const totalEvents = eventsWithTitanX + eventsWithoutTitanX;
const missingDataPercentage = (eventsWithoutTitanX / totalEvents) * 100;

console.log(`\n🔍 MISSING DATA ANALYSIS:`);
console.log(`  Missing TitanX data: ${missingDataPercentage.toFixed(1)}%`);

if (missingDataPercentage > 50) {
  console.log(`  🚨 SIGNIFICANT DATA MISSING - Over 50% of events lack TitanX data`);
  
  // Estimate total based on current average
  const avgTitanXPerEvent = totalTitanX / eventsWithTitanX;
  const estimatedTotal = avgTitanXPerEvent * totalEvents;
  
  console.log(`  📊 Estimated total if all events had data: ${estimatedTotal.toLocaleString()} TitanX`);
  console.log(`  📊 Average TitanX per event: ${avgTitanXPerEvent.toLocaleString()} TitanX`);
  
  if (estimatedTotal > 2000000000000) { // 2T
    console.log(`  ✅ Estimated total (${(estimatedTotal / 1e12).toFixed(1)}T) matches expectation of 2T+`);
  } else {
    console.log(`  ❌ Estimated total (${(estimatedTotal / 1e12).toFixed(1)}T) is below expected 2T+`);
  }
} else {
  console.log(`  ✅ Good data coverage - Only ${missingDataPercentage.toFixed(1)}% missing`);
  
  if (totalTitanX > 2000000000000) { // 2T
    console.log(`  ✅ Current total (${(totalTitanX / 1e12).toFixed(1)}T) meets expectation of 2T+`);
  } else {
    console.log(`  ❌ Current total (${(totalTitanX / 1e12).toFixed(1)}T) is below expected 2T+`);
  }
}

// Show largest TitanX amounts
console.log(`\n💰 LARGEST TITANX AMOUNTS:`);
const eventsWithAmounts = [...createEvents, ...stakeEvents]
  .filter(event => event.costTitanX && event.costTitanX !== "0")
  .map(event => ({
    user: event.user,
    amount: parseFloat(event.costTitanX) / 1e18,
    type: event.torusAmount ? 'create' : 'stake'
  }))
  .sort((a, b) => b.amount - a.amount);

eventsWithAmounts.slice(0, 10).forEach((event, i) => {
  console.log(`  ${i + 1}. ${event.user.substring(0, 10)}... ${event.amount.toLocaleString()} TitanX (${event.type})`);
});

console.log(`\n🎯 RECOMMENDATION:`);
if (eventsWithoutTitanX > 100) {
  console.log(`Need to extract TitanX data for ${eventsWithoutTitanX} missing events`);
  console.log(`This could potentially add ${((totalTitanX / eventsWithTitanX) * eventsWithoutTitanX / 1e12).toFixed(1)}T more TitanX`);
} else {
  console.log(`Data coverage is good, current total should be accurate`);
}