const fs = require('fs');

// Load the actual data
const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
const stakes = data.stakingData?.stakeEvents || [];
const creates = data.stakingData?.createEvents || [];

console.log('=== TRACING MAX SUPPLY CALCULATION LOGIC ===\n');

console.log('Current Supply:', data.totalSupply, 'TORUS');
console.log('Current Protocol Day:', data.currentProtocolDay);
console.log('Total Stakes:', stakes.length);
console.log('Total Creates:', creates.length);

// Contract start: July 10, 2025 6PM UTC
const contractStart = new Date(2025, 6, 10, 18);

console.log('\n=== ANALYZING THE LOGIC ===');

// The key question: What does the calculation ACTUALLY do?
// From the code: it loops through days minDay to maxDay
// For each day, it checks if any position matures on THAT SPECIFIC DAY
// If yes, it adds principal/tokens + accumulated rewards to cumulative totals

let cumulativeFromStakes = 0;
let cumulativeFromCreates = 0;

console.log('\n=== DAY-BY-DAY BREAKDOWN ===');

// Check what happens on each day from 1 to 17
for (let day = 1; day <= 17; day++) {
  let dailyFromStakes = 0;
  let dailyFromCreates = 0;
  
  // Check stakes maturing on this specific day
  const stakesOnDay = stakes.filter(s => {
    if (!s.maturityDate) return false;
    const matDate = new Date(s.maturityDate);
    const daysSince = Math.floor((matDate - contractStart) / (24 * 60 * 60 * 1000)) + 1;
    return daysSince === day;
  });
  
  // Check creates maturing on this specific day
  const createsOnDay = creates.filter(c => {
    if (!c.maturityDate) return false;
    const matDate = new Date(c.maturityDate);
    const daysSince = Math.floor((matDate - contractStart) / (24 * 60 * 60 * 1000)) + 1;
    return daysSince === day;
  });
  
  // Add principal/tokens from positions maturing today
  stakesOnDay.forEach(s => {
    const principal = parseFloat(s.principal || '0') / 1e18;
    dailyFromStakes += principal;
  });
  
  createsOnDay.forEach(c => {
    const tokens = parseFloat(c.torusAmount || '0') / 1e18;
    dailyFromCreates += tokens;
  });
  
  // Accumulate (this is the key!)
  cumulativeFromStakes += dailyFromStakes;
  cumulativeFromCreates += dailyFromCreates;
  
  // Calculate max supply for this day
  const dayMaxSupply = data.totalSupply + cumulativeFromStakes + cumulativeFromCreates;
  
  if (dailyFromStakes > 0 || dailyFromCreates > 0 || day === 17) {
    console.log(`Day ${day}: ${stakesOnDay.length} stakes, ${createsOnDay.length} creates`);
    console.log(`  Daily: +${dailyFromStakes.toFixed(2)} stakes, +${dailyFromCreates.toFixed(2)} creates`);
    console.log(`  Cumulative: ${cumulativeFromStakes.toFixed(2)} stakes, ${cumulativeFromCreates.toFixed(2)} creates`);
    console.log(`  Max Supply: ${dayMaxSupply.toFixed(2)} TORUS`);
    console.log('');
  }
}

console.log('=== CRITICAL INSIGHT ===');
console.log('The calculation is CUMULATIVE ACROSS ALL DAYS');
console.log('Day 17 max supply = Current Supply + ALL matured positions from days 1-17');
console.log('NOT just positions maturing on day 17 specifically');
console.log('');
console.log('So "previously matured positions" means:');
console.log('- All stakes that matured on days 1-16 are added to day 17 calculation');
console.log('- Plus stakes/creates maturing on day 17 itself');
console.log('- This assumes NO positions have been claimed yet (max possible scenario)');