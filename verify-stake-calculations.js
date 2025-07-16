const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
const stakes = data.stakingData?.stakeEvents || [];

console.log('Verifying stake maturity calculations:\n');

let correct = 0;
let incorrect = 0;

stakes.slice(0, 10).forEach((s, i) => {
  // Calculate expected maturity date
  const timestamp = parseInt(s.timestamp);
  const duration = parseInt(s.duration || s.stakingDays);
  const expectedMaturity = new Date((timestamp + (duration * 86400)) * 1000);
  
  // Parse stored maturity date
  const storedMaturity = new Date(s.maturityDate);
  
  // Compare
  const diff = Math.abs(expectedMaturity.getTime() - storedMaturity.getTime());
  const isCorrect = diff < 1000; // Less than 1 second difference
  
  if (isCorrect) {
    correct++;
  } else {
    incorrect++;
    console.log(`Stake ${i} mismatch:`);
    console.log(`  Timestamp: ${timestamp} (${new Date(timestamp * 1000).toISOString()})`);
    console.log(`  Duration: ${duration} days`);
    console.log(`  Expected: ${expectedMaturity.toISOString()}`);
    console.log(`  Stored: ${storedMaturity.toISOString()}`);
    console.log(`  Difference: ${diff / 1000} seconds\n`);
  }
});

console.log(`\nSummary for first 10 stakes:`);
console.log(`Correct: ${correct}`);
console.log(`Incorrect: ${incorrect}`);

// Check all duration values
const durations = new Set(stakes.map(s => s.duration || s.stakingDays));
console.log(`\nUnique durations: ${Array.from(durations).join(', ')}`);