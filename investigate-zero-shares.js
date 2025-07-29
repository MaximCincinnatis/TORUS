const fs = require('fs');

// Load the cached data
const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));

// Extract stake and create data
const stakeData = cachedData.stakingData?.stakeEvents || [];
const createData = cachedData.stakingData?.createEvents || [];

console.log('INVESTIGATION: WHY DO DAY 106 POSITIONS HAVE ZERO SHARES?');
console.log('=======================================================\n');

// Helper function to get date from protocol day
function getDateFromProtocolDay(protocolDay) {
  const CONTRACT_START_DATE = new Date('2025-07-09T18:00:00.000Z');
  const targetDate = new Date(CONTRACT_START_DATE);
  targetDate.setUTCDate(targetDate.getUTCDate() + protocolDay);
  return targetDate.toISOString().split('T')[0];
}

const day106Date = getDateFromProtocolDay(106);

// Find creates ending on Day 106 with zero shares
const day106Creates = createData.filter(create => {
  const maturityDate = create.maturityDate instanceof Date ? create.maturityDate : new Date(create.maturityDate);
  const dateKey = maturityDate.toISOString().split('T')[0];
  return dateKey === day106Date;
});

console.log(`Day 106 (${day106Date}) Create Positions Analysis:`);
console.log(`Total positions: ${day106Creates.length}`);

// Analyze the zero shares positions
console.log('\n=== SAMPLE ZERO SHARES POSITIONS ===');
day106Creates.slice(0, 5).forEach((pos, i) => {
  console.log(`\nPosition ${i + 1}:`);
  console.log(`  User: ${pos.user}`);
  console.log(`  Principal: ${pos.principal}`);
  console.log(`  Shares: ${pos.shares}`);
  console.log(`  Start Date: ${pos.startDate}`);
  console.log(`  Maturity Date: ${pos.maturityDate}`);
  console.log(`  Amount: ${pos.amount}`);
  console.log(`  Term: ${pos.term}`);
  
  if (pos.principal) {
    const principalETH = parseFloat(pos.principal) / 1e18;
    console.log(`  Principal (ETH): ${principalETH.toFixed(6)}`);
  }
});

// Compare with positions that DO have shares
console.log('\n=== COMPARISON WITH POSITIONS THAT HAVE SHARES ===');

// Find creates with non-zero shares from nearby days
const daysToCheck = [104, 105, 107];
for (const day of daysToCheck) {
  const dateKey = getDateFromProtocolDay(day);
  const createsOnDay = createData.filter(create => {
    const maturityDate = create.maturityDate instanceof Date ? create.maturityDate : new Date(create.maturityDate);
    return maturityDate.toISOString().split('T')[0] === dateKey;
  });
  
  const withShares = createsOnDay.filter(c => c.shares && parseFloat(c.shares) > 0);
  
  if (withShares.length > 0) {
    console.log(`\nDay ${day} (${dateKey}) - Sample position WITH shares:`);
    const sample = withShares[0];
    console.log(`  User: ${sample.user}`);
    console.log(`  Principal: ${sample.principal}`);
    console.log(`  Shares: ${sample.shares}`);
    console.log(`  Start Date: ${sample.startDate}`);
    console.log(`  Term: ${sample.term}`);
    
    if (sample.principal && sample.shares) {
      const principalETH = parseFloat(sample.principal) / 1e18;
      const sharesAmount = parseFloat(sample.shares) / 1e18;
      const ratio = sharesAmount / principalETH;
      console.log(`  Principal (ETH): ${principalETH.toFixed(6)}`);
      console.log(`  Shares: ${sharesAmount.toFixed(2)}`);
      console.log(`  Shares/Principal Ratio: ${ratio.toFixed(0)}`);
    }
    break; // Only need one example
  }
}

// Check if Day 106 positions have very small principals
console.log('\n=== PRINCIPAL AMOUNT ANALYSIS ===');
const principalAmounts = day106Creates
  .filter(pos => pos.principal)
  .map(pos => parseFloat(pos.principal) / 1e18)
  .sort((a, b) => b - a);

if (principalAmounts.length > 0) {
  console.log(`Principal amounts (ETH) for Day 106 positions:`);
  console.log(`  Count: ${principalAmounts.length}`);
  console.log(`  Largest: ${principalAmounts[0].toFixed(6)}`);
  console.log(`  Smallest: ${principalAmounts[principalAmounts.length - 1].toFixed(6)}`);
  console.log(`  Average: ${(principalAmounts.reduce((a, b) => a + b, 0) / principalAmounts.length).toFixed(6)}`);
  console.log(`  Median: ${principalAmounts[Math.floor(principalAmounts.length / 2)].toFixed(6)}`);
}

// Check shares calculation logic
console.log('\n=== SHARES CALCULATION INVESTIGATION ===');

// In TORUS staking, shares are typically calculated based on:
// 1. Principal amount
// 2. Term length  
// 3. Some multiplier or bonus structure

// Let's see if there's a pattern with the terms
const termCounts = {};
day106Creates.forEach(pos => {
  const term = pos.term || 'unknown';
  termCounts[term] = (termCounts[term] || 0) + 1;
});

console.log('Term distribution for Day 106 zero-shares positions:');
Object.entries(termCounts).forEach(([term, count]) => {
  console.log(`  ${term} days: ${count} positions`);
});

// Check start dates to see if there's a timing pattern
const startDates = day106Creates
  .map(pos => pos.startDate)
  .filter(date => date)
  .sort();

if (startDates.length > 0) {
  console.log(`\nStart date range:`);
  console.log(`  Earliest: ${startDates[0]}`);
  console.log(`  Latest: ${startDates[startDates.length - 1]}`);
  
  // Convert to protocol days to see when these were created
  const CONTRACT_START_DATE = new Date('2025-07-09T18:00:00.000Z');
  const startProtocolDays = startDates.map(dateStr => {
    const date = new Date(dateStr);
    const diffTime = date.getTime() - CONTRACT_START_DATE.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  });
  
  console.log(`  Protocol days when created: ${Math.min(...startProtocolDays)} to ${Math.max(...startProtocolDays)}`);
}

// Check if this could be a shares calculation bug or if zero shares is legitimate
console.log('\n=== POSSIBLE CAUSES FOR ZERO SHARES ===');
console.log('1. MINIMUM PRINCIPAL THRESHOLD: Positions below a certain ETH amount get zero shares');
console.log('2. TIMING ISSUE: Positions created at specific times have calculation problems');
console.log('3. TERM LENGTH ISSUE: Certain term lengths result in zero shares');
console.log('4. CALCULATION BUG: Shares calculation failed for these specific positions');
console.log('5. LEGITIMATE ZERO: These positions genuinely earn zero shares (e.g., penalty positions)');

// Final analysis
console.log('\n=== RECOMMENDATION ===');
if (principalAmounts.length > 0 && principalAmounts[0] > 0.001) {
  console.log('🚨 LIKELY BUG: Positions with significant principal (> 0.001 ETH) having zero shares suggests a calculation error.');
  console.log('   This explains why Day 106 shows unusually low values in the chart.');
  console.log('   Action needed: Fix shares calculation for affected positions.');
} else if (principalAmounts.length > 0 && principalAmounts[0] < 0.001) {
  console.log('💡 POSSIBLE DUST: All positions have very small principals, zero shares might be intentional.');
  console.log('   Need to verify if there\'s a minimum threshold for earning shares.');
} else {
  console.log('❓ UNCLEAR: Need more investigation into the shares calculation logic.');
}

// Let's also check Day 107 and 108 since they also showed zero
console.log('\n=== CHECKING OTHER ZERO DAYS (107, 108) ===');
[107, 108].forEach(day => {
  const dateKey = getDateFromProtocolDay(day);
  const createsOnDay = createData.filter(create => {
    const maturityDate = create.maturityDate instanceof Date ? create.maturityDate : new Date(create.maturityDate);
    return maturityDate.toISOString().split('T')[0] === dateKey;
  });
  
  const zeroShares = createsOnDay.filter(c => !c.shares || parseFloat(c.shares) === 0).length;
  const totalShares = createsOnDay.reduce((sum, c) => sum + (c.shares ? parseFloat(c.shares) / 1e18 : 0), 0);
  
  console.log(`Day ${day} (${dateKey}): ${createsOnDay.length} positions, ${zeroShares} with zero shares, total: ${totalShares.toFixed(2)}`);
});