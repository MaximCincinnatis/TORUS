// Fix the contract day calculation to match protocol days
const fs = require('fs');

console.log('🔧 FIXING CONTRACT DAY CALCULATION...');

// Get the actual protocol day from cached data
const data = JSON.parse(fs.readFileSync('public/data/cached-data-complete.json', 'utf8'));
const currentProtocolDay = data.stakingData.currentProtocolDay;

console.log(`Current protocol day from contract: ${currentProtocolDay}`);

const today = new Date();
today.setHours(0, 0, 0, 0);
console.log(`Today: ${today.toISOString().split('T')[0]}`);

// Calculate the correct contract start date
// If today is protocol day X, then start date was X days ago
const correctStartDate = new Date(today);
correctStartDate.setDate(correctStartDate.getDate() - (currentProtocolDay - 1));
correctStartDate.setHours(0, 0, 0, 0);

console.log(`Calculated contract start date: ${correctStartDate.toISOString().split('T')[0]}`);

// Verify the calculation
const getCorrectContractDay = (date) => {
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.floor((date.getTime() - correctStartDate.getTime()) / msPerDay) + 1;
  return daysDiff;
};

const calculatedProtocolDay = getCorrectContractDay(today);
console.log(`Verification: Today should be protocol day ${calculatedProtocolDay} (matches ${currentProtocolDay}: ${calculatedProtocolDay === currentProtocolDay})`);

// Test with future dates to see max possible contract days
console.log('\n📊 TESTING FUTURE CONTRACT DAYS:');
for (let i = 0; i <= 90; i += 10) {
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + i);
  const contractDay = getCorrectContractDay(futureDate);
  console.log(`  +${i} days (${futureDate.toISOString().split('T')[0]}): Contract day ${contractDay}`);
}

// Check if any stakes would be beyond the corrected range
const stakeEvents = data.stakingData.stakeEvents;
const createEvents = data.stakingData.createEvents;

console.log('\n🔍 CHECKING STAKES WITH CORRECTED DAYS:');
const futureStakes = stakeEvents.filter(stake => {
  const maturityDate = new Date(stake.maturityDate);
  return maturityDate > today;
});

const stakesWithBadDays = futureStakes.filter(stake => {
  const maturityDate = new Date(stake.maturityDate);
  const contractDay = getCorrectContractDay(maturityDate);
  const daysFromToday = Math.ceil((maturityDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  return daysFromToday > 88 || contractDay > (currentProtocolDay + 88);
});

console.log(`Stakes ending beyond 88 days: ${stakesWithBadDays.length}`);

if (stakesWithBadDays.length > 0) {
  console.log('Sample problematic stakes:');
  stakesWithBadDays.slice(0, 3).forEach((stake, i) => {
    const maturityDate = new Date(stake.maturityDate);
    const contractDay = getCorrectContractDay(maturityDate);
    const daysFromToday = Math.ceil((maturityDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    console.log(`  Stake ${i + 1}: ${daysFromToday} days from today, contract day ${contractDay}, duration: ${stake.stakingDays}`);
  });
}

console.log('\n🔍 CHECKING CREATES WITH CORRECTED DAYS:');
const futureCreates = createEvents.filter(create => {
  const maturityDate = new Date(create.maturityDate);
  return maturityDate > today;
});

const createsWithBadDays = futureCreates.filter(create => {
  const maturityDate = new Date(create.maturityDate);
  const contractDay = getCorrectContractDay(maturityDate);
  const daysFromToday = Math.ceil((maturityDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  return daysFromToday > 88 || contractDay > (currentProtocolDay + 88);
});

console.log(`Creates ending beyond 88 days: ${createsWithBadDays.length}`);

if (createsWithBadDays.length > 0) {
  console.log('Sample problematic creates:');
  createsWithBadDays.slice(0, 3).forEach((create, i) => {
    const maturityDate = new Date(create.maturityDate);
    const contractDay = getCorrectContractDay(maturityDate);
    const daysFromToday = Math.ceil((maturityDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    console.log(`  Create ${i + 1}: ${daysFromToday} days from today, contract day ${contractDay}, duration: ${create.stakingDays}`);
  });
}

console.log('\n🎯 PROPOSED FIX FOR APP.TSX:');
console.log(`Change CONTRACT_START_DATE from '2025-07-10' to '${correctStartDate.toISOString().split('T')[0]}'`);
console.log('This will align bar chart contract days with the actual protocol days from the smart contract.');

console.log('\n✅ Contract day calculation analysis complete!');