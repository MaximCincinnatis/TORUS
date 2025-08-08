const fs = require('fs');
const path = require('path');

// Load the actual maxSupplyProjection module
const { calculateFutureMaxSupply, convertToPositions } = require('./src/utils/maxSupplyProjection.ts');

// Load cached data
const cachedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data', 'cached-data.json'), 'utf8'));

console.log('\n==============================================');
console.log('SIMULATING BROWSER CONSOLE OUTPUT');
console.log('==============================================\n');

// Prepare data as the frontend would
const positions = convertToPositions(
  cachedData.stakingData.stakeEvents || [],
  cachedData.stakingData.createEvents || []
);

const rewardPoolData = cachedData.stakingData.rewardPoolData || [];
const currentSupply = parseFloat(cachedData.currentSupply || cachedData.totalSupply || 18444);
const contractStartDate = new Date('2025-07-10T18:00:00Z');
const currentProtocolDay = cachedData.currentProtocolDay || 29;

console.log('🔍 calculateFutureMaxSupply called with:');
console.log('positions:', positions.length);
console.log('rewardPoolData:', rewardPoolData.length);
console.log('currentSupply:', currentSupply);
console.log('contractStartDate:', contractStartDate);
console.log('currentProtocolDay:', currentProtocolDay);

// Call the actual function that would run in the browser
try {
  const projections = calculateFutureMaxSupply(
    positions,
    rewardPoolData,
    currentSupply,
    contractStartDate,
    currentProtocolDay
  );
  
  console.log('\n📊 PROJECTION RESULTS:');
  console.log(`Generated ${projections.length} days of projections`);
  
  // Show key days
  const keyDays = [110, 111, 112, 113, 114, 115, 116, 117];
  keyDays.forEach(day => {
    const projection = projections.find(p => p.day === day);
    if (projection) {
      const prevDay = projections.find(p => p.day === day - 1);
      const dailyIncrease = prevDay ? projection.totalMaxSupply - prevDay.totalMaxSupply : 0;
      
      console.log(`\nDay ${day}:`);
      console.log(`  Total Max Supply: ${(projection.totalMaxSupply / 1e6).toFixed(2)}M TORUS`);
      console.log(`  Daily Increase: ${(dailyIncrease / 1e3).toFixed(2)}K TORUS`);
      console.log(`  Active Positions: ${projection.activePositions}`);
      console.log(`  Total Shares: ${(projection.totalShares / 1e6).toFixed(2)}M`);
      
      if (dailyIncrease > 10000000) {
        console.log(`  🚨 HOCKEY STICK DETECTED! Increase of ${(dailyIncrease / 1e6).toFixed(2)}M TORUS!`);
      }
    }
  });
  
  const finalProjection = projections[projections.length - 1];
  console.log('\n📈 FINAL PROJECTION:');
  console.log(`Day ${finalProjection.day}: ${(finalProjection.totalMaxSupply / 1e6).toFixed(2)}M TORUS`);
  
} catch (error) {
  console.error('ERROR calculating projections:', error.message);
  console.error(error.stack);
}

console.log('\n==============================================');
console.log('END OF SIMULATED BROWSER OUTPUT');
console.log('==============================================\n');