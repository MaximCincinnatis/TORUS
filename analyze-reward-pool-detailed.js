const fs = require('fs');
const path = require('path');

// Read the cached data
const cachedDataPath = path.join(__dirname, 'public/data/cached-data.json');
const data = JSON.parse(fs.readFileSync(cachedDataPath, 'utf8'));

// Extract reward pool data
const rewardPoolData = data.rewardPoolData || [];

console.log('Detailed Reward Pool Analysis');
console.log('=============================');

// Sort by day
rewardPoolData.sort((a, b) => a.day - b.day);

// Find non-zero entries
const nonZeroEntries = rewardPoolData.filter(entry => parseFloat(entry.rewardPool) > 0);
const zeroEntries = rewardPoolData.filter(entry => parseFloat(entry.rewardPool) === 0);

console.log(`Total entries: ${rewardPoolData.length}`);
console.log(`Non-zero entries: ${nonZeroEntries.length}`);
console.log(`Zero entries: ${zeroEntries.length}`);

console.log('\nNon-zero reward pool data:');
nonZeroEntries.forEach(entry => {
    console.log(`Day ${entry.day}: ${entry.rewardPool} TORUS`);
});

if (nonZeroEntries.length > 1) {
    // Calculate the exact reduction rate from the first 8 days
    let totalActualDistributed = 0;
    let dailyReductions = [];
    
    for (let i = 0; i < nonZeroEntries.length; i++) {
        const current = parseFloat(nonZeroEntries[i].rewardPool);
        totalActualDistributed += current;
        
        if (i > 0) {
            const previous = parseFloat(nonZeroEntries[i-1].rewardPool);
            const reduction = (previous - current) / previous * 100;
            dailyReductions.push(reduction);
            console.log(`Day ${nonZeroEntries[i].day}: Reduction of ${reduction.toFixed(4)}%`);
        }
    }
    
    console.log('\n=== ACTUAL CALCULATIONS ===');
    console.log(`1. Total distributed in first ${nonZeroEntries.length} days: ${totalActualDistributed.toFixed(6)} TORUS`);
    
    if (dailyReductions.length > 0) {
        const avgReduction = dailyReductions.reduce((sum, rate) => sum + rate, 0) / dailyReductions.length;
        console.log(`2. Average daily reduction rate: ${avgReduction.toFixed(6)}%`);
        
        // Project the full 88 days using this rate
        let projectedTotal = totalActualDistributed;
        let lastRewardPool = parseFloat(nonZeroEntries[nonZeroEntries.length-1].rewardPool);
        const lastDay = nonZeroEntries[nonZeroEntries.length-1].day;
        
        console.log(`\n=== PROJECTION TO DAY 88 ===`);
        console.log(`Starting from day ${lastDay + 1} with reward pool: ${lastRewardPool.toFixed(6)}`);
        
        // Continue the reduction pattern
        for (let day = lastDay + 1; day <= 88; day++) {
            lastRewardPool = lastRewardPool * (1 - avgReduction / 100);
            projectedTotal += lastRewardPool;
            
            if (day <= lastDay + 10 || day >= 80) {
                console.log(`Day ${day}: ${lastRewardPool.toFixed(6)} TORUS`);
            } else if (day === lastDay + 11) {
                console.log('...');
            }
        }
        
        console.log(`\n3. PROJECTED total for 88 days: ${projectedTotal.toFixed(6)} TORUS`);
        
        // Let's also calculate what the theoretical 88-day total should be
        // Starting with 100,000 and 0.08% daily reduction
        let theoreticalTotal = 0;
        let theoreticalDaily = 100000;
        
        console.log(`\n=== THEORETICAL 88-DAY CALCULATION ===`);
        for (let day = 1; day <= 88; day++) {
            theoreticalTotal += theoreticalDaily;
            if (day <= 10 || day >= 80) {
                console.log(`Day ${day}: ${theoreticalDaily.toFixed(6)} TORUS`);
            } else if (day === 11) {
                console.log('...');
            }
            theoreticalDaily = theoreticalDaily * (1 - 0.0008); // 0.08% reduction
        }
        
        console.log(`\n4. THEORETICAL total for 88 days: ${theoreticalTotal.toFixed(6)} TORUS`);
        
        // Calculate the difference
        const difference = theoreticalTotal - totalActualDistributed;
        console.log(`\n=== ANALYSIS ===`);
        console.log(`Difference between theoretical and actual: ${difference.toFixed(6)} TORUS`);
        console.log(`Percentage of theoretical that was actually distributed: ${(totalActualDistributed/theoreticalTotal*100).toFixed(2)}%`);
        
        // Show impact on max supply calculation
        const MAX_SUPPLY = 100000000;
        console.log(`\nImpact on max supply calculation:`);
        console.log(`- Current calculation uses: ${totalActualDistributed.toFixed(6)} TORUS`);
        console.log(`- Should include full 88 days: ${theoreticalTotal.toFixed(6)} TORUS`);
        console.log(`- Missing from max supply: ${difference.toFixed(6)} TORUS`);
        console.log(`- This represents ${(difference/MAX_SUPPLY*100).toFixed(4)}% of max supply`);
    }
} else {
    console.log('Insufficient data for reduction rate calculation');
}

// Check the data source
console.log('\n=== DATA SOURCE INVESTIGATION ===');
console.log('Days with zero reward pool start from day:', zeroEntries.length > 0 ? Math.min(...zeroEntries.map(e => e.day)) : 'None');
console.log('This suggests the reward pool data collection stopped after day 8');
console.log('The reward pool should continue for 88 days with a 0.08% daily reduction');