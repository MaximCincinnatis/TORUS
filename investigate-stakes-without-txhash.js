const fs = require('fs');

// Load cached data
const data = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));

console.log('=== INVESTIGATING STAKES WITHOUT TRANSACTION HASHES ===\n');

// Get stakes without txHash
const stakesWithoutTxHash = data.stakingData.stakeEvents.filter(s => !s.transactionHash);

console.log(`Found ${stakesWithoutTxHash.length} stakes without transaction hashes\n`);

// Analyze their structure
if (stakesWithoutTxHash.length > 0) {
  console.log('Structure of stakes WITHOUT txHash:');
  const sample = stakesWithoutTxHash[0];
  console.log(`Fields: ${Object.keys(sample).join(', ')}\n`);
  
  // Show detailed info for first 5
  console.log('First 5 stakes without txHash:\n');
  stakesWithoutTxHash.slice(0, 5).forEach((stake, i) => {
    console.log(`Stake ${i + 1}:`);
    console.log(`  User: ${stake.user}`);
    console.log(`  ID: ${stake.id || stake.stakeIndex}`);
    console.log(`  Principal: ${stake.principal}`);
    console.log(`  Timestamp: ${stake.timestamp}`);
    console.log(`  Block: ${stake.blockNumber}`);
    console.log(`  Protocol Day: ${stake.protocolDay}`);
    console.log(`  Has "isCreate" field: ${stake.hasOwnProperty('isCreate')}`);
    console.log(`  Has "claimedStake" field: ${stake.hasOwnProperty('claimedStake')}`);
    console.log('');
  });
}

// Compare with stakes that have txHash
const stakesWithTxHash = data.stakingData.stakeEvents.filter(s => s.transactionHash);
console.log('\nStructure of stakes WITH txHash:');
if (stakesWithTxHash.length > 0) {
  const sample = stakesWithTxHash[0];
  console.log(`Fields: ${Object.keys(sample).join(', ')}\n`);
}

// Check for patterns
console.log('Pattern Analysis:');
console.log('================\n');

// Check protocol days
const daysWithoutTxHash = [...new Set(stakesWithoutTxHash.map(s => s.protocolDay))].sort((a,b) => a - b);
console.log(`Protocol days with stakes missing txHash: ${daysWithoutTxHash.join(', ')}`);

// Check block ranges
const blocksWithoutTxHash = stakesWithoutTxHash.map(s => s.blockNumber).filter(b => b);
if (blocksWithoutTxHash.length > 0) {
  console.log(`Block range: ${Math.min(...blocksWithoutTxHash)} - ${Math.max(...blocksWithoutTxHash)}`);
}

// Check if these might be from user positions
console.log('\nChecking for position-specific fields:');
const hasPositionFields = stakesWithoutTxHash.filter(s => 
  s.hasOwnProperty('claimedStake') || 
  s.hasOwnProperty('isCreate') ||
  s.hasOwnProperty('power') ||
  s.hasOwnProperty('rewards') ||
  s.hasOwnProperty('penalties')
);
console.log(`Stakes with position-specific fields: ${hasPositionFields.length}`);

// Check if any of these users have both types
console.log('\nChecking for users with both stake types:');
const usersWithoutTxHash = new Set(stakesWithoutTxHash.map(s => s.user));
let usersWithBoth = 0;

usersWithoutTxHash.forEach(user => {
  const hasWithTxHash = stakesWithTxHash.some(s => s.user === user);
  if (hasWithTxHash) {
    usersWithBoth++;
  }
});

console.log(`Users with stakes both WITH and WITHOUT txHash: ${usersWithBoth}`);

// Look for potential duplicates that might not match exactly
console.log('\nChecking for near-duplicates (same user, similar time):');
let nearDuplicates = 0;

stakesWithoutTxHash.forEach(stakeNoTx => {
  const similarStakes = stakesWithTxHash.filter(stakeWithTx => 
    stakeWithTx.user === stakeNoTx.user &&
    Math.abs(parseInt(stakeWithTx.timestamp) - parseInt(stakeNoTx.timestamp)) < 300 // Within 5 minutes
  );
  
  if (similarStakes.length > 0) {
    nearDuplicates++;
    if (nearDuplicates <= 3) {
      console.log(`\nPotential duplicate found:`);
      console.log(`  Without txHash - ID: ${stakeNoTx.id}, Principal: ${stakeNoTx.principal}`);
      console.log(`  With txHash - ID: ${similarStakes[0].stakeIndex}, Principal: ${similarStakes[0].principal}`);
    }
  }
});

console.log(`\nTotal potential near-duplicates: ${nearDuplicates}`);

// Summary
console.log('\n=== SUMMARY ===');
console.log(`Total stakes: ${data.stakingData.stakeEvents.length}`);
console.log(`With txHash: ${stakesWithTxHash.length} (${(stakesWithTxHash.length/data.stakingData.stakeEvents.length*100).toFixed(1)}%)`);
console.log(`Without txHash: ${stakesWithoutTxHash.length} (${(stakesWithoutTxHash.length/data.stakingData.stakeEvents.length*100).toFixed(1)}%)`);
console.log(`Position-like stakes: ${hasPositionFields.length}`);
console.log(`Potential near-duplicates: ${nearDuplicates}`);