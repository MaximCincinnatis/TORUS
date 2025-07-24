const fs = require('fs');
const { ethers } = require('ethers');

// Read the cached data
const data = JSON.parse(fs.readFileSync('public/data/cached-data-complete-with-titanx.json', 'utf8'));

// Partial addresses to search for
const partialAddresses = [
  '0x43fdeb73',
  '0xfd5bc7f6',
  '0x44cb99a5'
];

console.log('Searching for creates matching partial addresses...\n');

// Search through all create events
const matches = [];

data.stakingData.createEvents.forEach(event => {
  partialAddresses.forEach(partial => {
    if (event.user.toLowerCase().includes(partial.toLowerCase())) {
      matches.push({
        ...event,
        matchedPartial: partial
      });
    }
  });
});

if (matches.length > 0) {
  console.log(`Found ${matches.length} matching creates:\n`);
  
  matches.forEach(match => {
    const date = new Date(parseInt(match.timestamp) * 1000);
    console.log(`User: ${match.user} (matched ${match.matchedPartial})`);
    console.log(`  Date: ${date.toISOString()}`);
    console.log(`  Block: ${match.blockNumber}`);
    console.log(`  TORUS Amount: ${match.amount || 'N/A'}`);
    console.log(`  TitanX Payment: ${match.costTitanX || '0'}`);
    console.log(`  ETH Payment: ${match.costETH || '0'}`);
    console.log('');
  });
} else {
  console.log('No matches found in existing data.');
  
  // Show some sample creates to understand the data structure
  console.log('\nSample creates from the data:');
  data.stakingData.createEvents.slice(-10).forEach(event => {
    const date = new Date(parseInt(event.timestamp) * 1000);
    console.log(`User: ${event.user}`);
    console.log(`  Date: ${date.toISOString()}`);
    console.log(`  TORUS Amount: ${event.amount || 'N/A'}`);
    console.log('');
  });
}

// Check if we have any data for July 23, 2025
const july23Start = new Date('2025-07-23T00:00:00Z').getTime() / 1000;
const july23End = new Date('2025-07-24T00:00:00Z').getTime() / 1000;

const july23Creates = data.stakingData.createEvents.filter(e => {
  const ts = parseInt(e.timestamp);
  return ts >= july23Start && ts < july23End;
});

console.log(`\nJuly 23, 2025 creates in data: ${july23Creates.length}`);