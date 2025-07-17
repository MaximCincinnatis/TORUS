const fs = require('fs');
const path = require('path');

// Read the cached data
const cachedDataPath = path.join(__dirname, 'public/data/cached-data.json');
const data = JSON.parse(fs.readFileSync(cachedDataPath, 'utf8'));

// Extract reward pool data
const rewardPoolData = data.rewardPoolData || [];

console.log('Reward Pool Data Analysis');
console.log('========================');
console.log(`Total days of reward pool data: ${rewardPoolData.length}`);

if (rewardPoolData.length === 0) {
    console.log('No reward pool data found!');
    process.exit(1);
}

// Sort by day to ensure proper order
rewardPoolData.sort((a, b) => a.day - b.day);

// Display first few and last few entries
console.log('\nFirst 10 days:');
rewardPoolData.slice(0, 10).forEach(entry => {
    console.log(`Day ${entry.day}: ${entry.rewardPool} TORUS`);
});

console.log('\nLast 10 days:');
rewardPoolData.slice(-10).forEach(entry => {
    console.log(`Day ${entry.day}: ${entry.rewardPool} TORUS`);
});

// Calculate total reward pool distributed
let totalDistributed = 0;
let dailyReductions = [];

for (let i = 0; i < rewardPoolData.length; i++) {
    const current = parseFloat(rewardPoolData[i].rewardPool);
    totalDistributed += current;
    
    if (i > 0) {
        const previous = parseFloat(rewardPoolData[i-1].rewardPool);
        const reduction = (previous - current) / previous * 100;
        dailyReductions.push(reduction);
    }
}

console.log('\n=== CALCULATIONS ===');
console.log(`1. Total reward pool distributed (days 1-${rewardPoolData[rewardPoolData.length-1].day}): ${totalDistributed.toFixed(6)} TORUS`);

// Calculate average daily reduction rate
const avgReduction = dailyReductions.reduce((sum, rate) => sum + rate, 0) / dailyReductions.length;
console.log(`2. Average daily reduction rate: ${avgReduction.toFixed(4)}%`);

// Check if we have data for days 1-8
const firstEightDays = rewardPoolData.filter(entry => entry.day <= 8);
const totalFirst8Days = firstEightDays.reduce((sum, entry) => sum + parseFloat(entry.rewardPool), 0);
console.log(`3. Distributed in first 8 days: ${totalFirst8Days.toFixed(6)} TORUS`);

// Project to day 88 using the reduction rate
let projectedTotal = totalDistributed;
const lastDay = rewardPoolData[rewardPoolData.length-1].day;
let lastRewardPool = parseFloat(rewardPoolData[rewardPoolData.length-1].rewardPool);

console.log(`\nProjecting from day ${lastDay} to day 88...`);

for (let day = lastDay + 1; day <= 88; day++) {
    // Apply the average reduction rate
    lastRewardPool = lastRewardPool * (1 - avgReduction / 100);
    projectedTotal += lastRewardPool;
    
    if (day <= lastDay + 5 || day >= 85) {
        console.log(`Day ${day}: ${lastRewardPool.toFixed(6)} TORUS (projected)`);
    } else if (day === lastDay + 6) {
        console.log('...');
    }
}

console.log(`\n4. PROJECTED total reward pool distributed by day 88: ${projectedTotal.toFixed(6)} TORUS`);

// Additional analysis
console.log('\n=== ADDITIONAL ANALYSIS ===');

// Check for any anomalies in the reduction pattern
console.log('\nDaily reduction rates (first 20):');
for (let i = 0; i < Math.min(20, dailyReductions.length); i++) {
    console.log(`Day ${i+2}: ${dailyReductions[i].toFixed(4)}%`);
}

// Calculate what percentage of max supply this represents
const MAX_SUPPLY = 100000000; // 100M TORUS
const percentageOfMaxSupply = (projectedTotal / MAX_SUPPLY) * 100;
console.log(`\nProjected reward pool represents ${percentageOfMaxSupply.toFixed(2)}% of max supply`);

// Show statistics
console.log('\n=== STATISTICS ===');
console.log(`Min daily reward: ${Math.min(...rewardPoolData.map(d => parseFloat(d.rewardPool))).toFixed(6)} TORUS`);
console.log(`Max daily reward: ${Math.max(...rewardPoolData.map(d => parseFloat(d.rewardPool))).toFixed(6)} TORUS`);
console.log(`Min reduction rate: ${Math.min(...dailyReductions).toFixed(4)}%`);
console.log(`Max reduction rate: ${Math.max(...dailyReductions).toFixed(4)}%`);

// Check consistency of reduction
const reductionVariance = dailyReductions.reduce((sum, rate) => {
    return sum + Math.pow(rate - avgReduction, 2);
}, 0) / dailyReductions.length;
const reductionStdDev = Math.sqrt(reductionVariance);
console.log(`Reduction rate standard deviation: ${reductionStdDev.toFixed(4)}%`);