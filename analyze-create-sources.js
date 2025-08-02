const fs = require('fs');

const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));

// Get all creates from day 22
const day22Creates = cachedData.stakingData.createEvents.filter(c => c.protocolDay === 22);

console.log('Day 22 Creates Analysis:');
console.log('========================\n');

// Group by presence of transaction hash
const withHash = day22Creates.filter(c => c.transactionHash);
const withoutHash = day22Creates.filter(c => !c.transactionHash);

console.log(`Total: ${day22Creates.length}`);
console.log(`With txHash: ${withHash.length}`);
console.log(`Without txHash: ${withoutHash.length}\n`);

// Check for patterns in creates without hash
console.log('Analyzing creates WITHOUT txHash:');
console.log('Block range:', Math.min(...withoutHash.map(c => c.blockNumber)), '-', Math.max(...withoutHash.map(c => c.blockNumber)));
console.log('ID range:', Math.min(...withoutHash.map(c => parseInt(c.createId || c.id))), '-', Math.max(...withoutHash.map(c => parseInt(c.createId || c.id))));

// Check if they're all 88-day creates
const durations = {};
withoutHash.forEach(c => {
  const duration = c.stakingDays || c.createDays;
  durations[duration] = (durations[duration] || 0) + 1;
});
console.log('\nDurations for creates without txHash:', durations);

// Check if these might be duplicates
console.log('\nChecking for potential duplicates...');
const createIds = new Set();
let duplicates = 0;

day22Creates.forEach(c => {
  const id = c.createId || c.id;
  if (createIds.has(id)) {
    duplicates++;
    console.log(`Duplicate ID found: ${id}`);
  }
  createIds.add(id);
});

if (duplicates === 0) {
  console.log('No duplicate IDs found');
}

// Sample comparison
console.log('\nComparing first create WITH and WITHOUT txHash:');
console.log('\nWith txHash:', JSON.stringify(withHash[0], null, 2).slice(0, 500));
console.log('\nWithout txHash:', JSON.stringify(withoutHash[0], null, 2).slice(0, 500));