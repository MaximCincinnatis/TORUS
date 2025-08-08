#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, 'public/data/cached-data.json');

// Load data
const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));

console.log(`Original stake events: ${data.stakingData.stakeEvents.length}`);
console.log(`Original create events: ${data.stakingData.createEvents.length}`);

// Remove duplicate stakes
const seenStakes = new Set();
const uniqueStakes = [];

data.stakingData.stakeEvents.forEach(stake => {
  // Create a unique key based on all relevant fields
  // Since many have undefined IDs, we need to use other fields
  const key = `${stake.user}-${stake.principal}-${stake.shares}-${stake.maturityDate}-${stake.timestamp || ''}`;
  
  if (!seenStakes.has(key)) {
    seenStakes.add(key);
    uniqueStakes.push(stake);
  } else {
    console.log(`Removing duplicate stake from ${stake.user} with ${(parseFloat(stake.shares)/1e18/1e6).toFixed(2)}M shares`);
  }
});

// Remove duplicate creates (if any)
const seenCreates = new Set();
const uniqueCreates = [];

data.stakingData.createEvents.forEach(create => {
  // Create a unique key
  let key;
  if (create.transactionHash) {
    key = create.transactionHash;
  } else {
    key = `${create.user}-${create.id || create.stakeIndex || 'noid'}-${create.torusAmount}-${create.shares}-${create.maturityDate}`;
  }
  
  if (!seenCreates.has(key)) {
    seenCreates.add(key);
    uniqueCreates.push(create);
  } else {
    console.log(`Removing duplicate create: ${key.substring(0, 50)}...`);
  }
});

// Update the data
data.stakingData.stakeEvents = uniqueStakes;
data.stakingData.createEvents = uniqueCreates;

console.log(`\nUnique stake events: ${uniqueStakes.length} (removed ${data.stakingData.stakeEvents.length - uniqueStakes.length} duplicates)`);
console.log(`Unique create events: ${uniqueCreates.length} (removed ${data.stakingData.createEvents.length - uniqueCreates.length} duplicates)`);

// Save the cleaned data
fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
console.log('\n✅ Duplicates removed and data saved!');