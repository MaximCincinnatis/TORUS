const fs = require('fs');

// Load the cached data
const data = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));

console.log('=== TitanX Amount Analysis: Stakes vs Creates ===\n');

// Analyze stake events
const stakeEvents = data.stakingData.stakeEvents || [];
let totalStakeTitanX = 0;
let minStake = Number.MAX_VALUE;
let maxStake = 0;
const stakeAmounts = [];

stakeEvents.forEach(event => {
    const titanX = parseFloat(event.costTitanX);
    totalStakeTitanX += titanX;
    minStake = Math.min(minStake, titanX);
    maxStake = Math.max(maxStake, titanX);
    stakeAmounts.push(titanX);
});

console.log(`Stake Events Analysis:`);
console.log(`- Total stake events: ${stakeEvents.length}`);
console.log(`- Total TitanX staked: ${totalStakeTitanX.toLocaleString()} TitanX`);
console.log(`- Average stake: ${(totalStakeTitanX / stakeEvents.length).toFixed(2)} TitanX`);
console.log(`- Min stake: ${minStake} TitanX`);
console.log(`- Max stake: ${maxStake} TitanX`);

// Show distribution
const stakeRanges = {
    '<1': 0,
    '1-10': 0,
    '10-100': 0,
    '100-1000': 0,
    '1000-10000': 0,
    '>10000': 0
};

stakeAmounts.forEach(amount => {
    if (amount < 1) stakeRanges['<1']++;
    else if (amount <= 10) stakeRanges['1-10']++;
    else if (amount <= 100) stakeRanges['10-100']++;
    else if (amount <= 1000) stakeRanges['100-1000']++;
    else if (amount <= 10000) stakeRanges['1000-10000']++;
    else stakeRanges['>10000']++;
});

console.log('\nStake amount distribution:');
Object.entries(stakeRanges).forEach(([range, count]) => {
    console.log(`  ${range} TitanX: ${count} stakes (${(count/stakeEvents.length*100).toFixed(1)}%)`);
});

// Analyze create events
const createEvents = data.stakingData.createEvents || [];
let totalCreateTitanX = 0;
let minCreate = Number.MAX_VALUE;
let maxCreate = 0;
const createAmounts = [];

createEvents.forEach(event => {
    const titanX = parseFloat(event.costTitanX);
    totalCreateTitanX += titanX;
    minCreate = Math.min(minCreate, titanX);
    maxCreate = Math.max(maxCreate, titanX);
    createAmounts.push(titanX);
});

console.log(`\nCreate Events Analysis:`);
console.log(`- Total create events: ${createEvents.length}`);
console.log(`- Total TitanX used in creates: ${totalCreateTitanX.toLocaleString()} TitanX`);
console.log(`- Average create: ${(totalCreateTitanX / createEvents.length).toFixed(2)} TitanX`);
console.log(`- Min create: ${minCreate.toLocaleString()} TitanX`);
console.log(`- Max create: ${maxCreate.toLocaleString()} TitanX`);

// Show distribution for creates
const createRanges = {
    '<1M': 0,
    '1M-10M': 0,
    '10M-100M': 0,
    '100M-1B': 0,
    '1B-10B': 0,
    '>10B': 0
};

createAmounts.forEach(amount => {
    if (amount < 1000000) createRanges['<1M']++;
    else if (amount <= 10000000) createRanges['1M-10M']++;
    else if (amount <= 100000000) createRanges['10M-100M']++;
    else if (amount <= 1000000000) createRanges['100M-1B']++;
    else if (amount <= 10000000000) createRanges['1B-10B']++;
    else createRanges['>10B']++;
});

console.log('\nCreate amount distribution:');
Object.entries(createRanges).forEach(([range, count]) => {
    console.log(`  ${range} TitanX: ${count} creates (${(count/createEvents.length*100).toFixed(1)}%)`);
});

// Comparison
console.log('\n=== COMPARISON ===');
console.log(`Total TitanX in stakes: ${totalStakeTitanX.toLocaleString()}`);
console.log(`Total TitanX in creates: ${totalCreateTitanX.toLocaleString()}`);
console.log(`Ratio (creates/stakes): ${(totalCreateTitanX / totalStakeTitanX).toFixed(0)}x`);
console.log(`\nStakes use ${(totalStakeTitanX / (totalStakeTitanX + totalCreateTitanX) * 100).toFixed(4)}% of total TitanX`);
console.log(`Creates use ${(totalCreateTitanX / (totalStakeTitanX + totalCreateTitanX) * 100).toFixed(2)}% of total TitanX`);

// Check for data integrity issues
console.log('\n=== DATA INTEGRITY CHECK ===');

// Check if titanAmount matches rawCostTitanX
let mismatchCount = 0;
console.log('\nChecking if titanAmount matches rawCostTitanX...');

stakeEvents.forEach((event, index) => {
    if (event.titanAmount !== event.rawCostTitanX) {
        mismatchCount++;
        if (mismatchCount <= 5) {
            console.log(`Stake ${index}: titanAmount=${event.titanAmount}, rawCostTitanX=${event.rawCostTitanX}`);
        }
    }
});

createEvents.forEach((event, index) => {
    if (event.titanAmount !== event.rawCostTitanX) {
        mismatchCount++;
        if (mismatchCount <= 5) {
            console.log(`Create ${index}: titanAmount=${event.titanAmount}, rawCostTitanX=${event.rawCostTitanX}`);
        }
    }
});

if (mismatchCount === 0) {
    console.log('✓ All titanAmount fields match rawCostTitanX');
} else {
    console.log(`✗ Found ${mismatchCount} mismatches between titanAmount and rawCostTitanX`);
}

// Sample some events to verify decimal conversion
console.log('\n=== SAMPLE EVENTS FOR VERIFICATION ===');
console.log('\nFirst 3 stake events:');
stakeEvents.slice(0, 3).forEach((event, i) => {
    console.log(`${i+1}. User: ${event.user.slice(0,10)}...`);
    console.log(`   Raw TitanX: ${event.rawCostTitanX}`);
    console.log(`   Parsed TitanX: ${event.costTitanX}`);
    console.log(`   Principal: ${event.principal}`);
});

console.log('\nFirst 3 create events:');
createEvents.slice(0, 3).forEach((event, i) => {
    console.log(`${i+1}. User: ${event.user.slice(0,10)}...`);
    console.log(`   Raw TitanX: ${event.rawCostTitanX}`);
    console.log(`   Parsed TitanX: ${event.costTitanX}`);
    console.log(`   Torus Amount: ${event.torusAmount}`);
});