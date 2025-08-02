// Debug helper to add to App.tsx temporarily
// Add this right after the chart data calculations (around line 1376)

console.log('=== CHART DATA DEBUG ===');
console.log('State values:');
console.log('  loading:', loading);
console.log('  stakeData.length:', stakeData.length);
console.log('  createData.length:', createData.length);
console.log('  rewardPoolData.length:', rewardPoolData.length);

console.log('\nCalculated arrays:');
console.log('  stakeReleases.length:', stakeReleases.length);
console.log('  createReleases.length:', createReleases.length);
console.log('  torusReleases.length:', torusReleases.length);
console.log('  titanXUsage.length:', titanXUsage.length);
console.log('  torusStakedPerDay.length:', torusStakedPerDay.length);
console.log('  dailyCreatesStakes.length:', dailyCreatesStakes.length);
console.log('  torusReleasesWithRewards.length:', torusReleasesWithRewards.length);

console.log('\nCondition results:');
console.log('  Basic condition:', loading || (stakeData.length === 0 && createData.length === 0));
console.log('  Rewards condition:', loading || (stakeData.length === 0 && createData.length === 0) || rewardPoolData.length === 0);
console.log('=== END DEBUG ===\n');