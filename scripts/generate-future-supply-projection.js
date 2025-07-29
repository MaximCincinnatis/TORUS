const fs = require('fs');
// const { calculateFutureMaxSupply, convertToPositions } = require('../src/utils/maxSupplyProjection.js');

function generateFutureSupplyProjection() {
  console.log('🔄 Generating Future Supply Projection...\n');
  
  const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  // Constants
  const CONTRACT_START = new Date('2025-07-10T15:00:00Z'); // Contract days change at 15:00 UTC
  const today = new Date();
  const currentProtocolDay = Math.floor((today - CONTRACT_START) / (24 * 60 * 60 * 1000)) + 1;
  
  console.log(`Current Protocol Day: ${currentProtocolDay}`);
  console.log(`Today: ${today.toISOString().split('T')[0]}\n`);
  
  // Get positions and reward pool data
  const positions = convertToPositions(
    data.stakingData.stakeEvents || [],
    data.stakingData.createEvents || []
  );
  
  const rewardPoolData = data.rewardPoolData || [];
  const currentSupply = data.totalSupply || 0;
  
  console.log(`Positions: ${positions.length}`);
  console.log(`Reward Pool Data Days: ${rewardPoolData.length}`);
  console.log(`Current Supply: ${currentSupply.toLocaleString()}\n`);
  
  // Generate projection starting from current day
  const futureProjection = calculateFutureMaxSupply(
    positions,
    rewardPoolData,
    currentSupply,
    CONTRACT_START
  );
  
  // Filter to only show from today forward
  const futureOnly = futureProjection.filter(p => p.day >= currentProtocolDay);
  
  console.log(`Generated ${futureOnly.length} days of future projections\n`);
  
  // Update the cached data
  if (!data.chartData) data.chartData = {};
  data.chartData.futureSupplyProjection = futureOnly;
  data.chartData.futureSupplyProjectionLastUpdate = {
    timestamp: new Date().toISOString(),
    protocolDay: currentProtocolDay
  };
  
  // Save
  fs.writeFileSync('public/data/cached-data.json', JSON.stringify(data, null, 2));
  
  console.log('✅ Future supply projection updated');
  
  // Show first few days
  console.log('\nFirst 5 days of projection:');
  futureOnly.slice(0, 5).forEach(p => {
    console.log(`  Day ${p.day} (${p.date}): ${p.totalMaxSupply.toLocaleString()} TORUS`);
  });
}

// Add this to smart-update-fixed.js
function shouldUpdateProjection(cachedData) {
  if (!cachedData) return true;
  const lastUpdate = cachedData.chartData?.futureSupplyProjectionLastUpdate;
  if (!lastUpdate) return true;
  
  const CONTRACT_START = new Date('2025-07-10T15:00:00Z'); // Contract days change at 15:00 UTC
  const currentProtocolDay = Math.floor((new Date() - CONTRACT_START) / (24 * 60 * 60 * 1000)) + 1;
  
  return currentProtocolDay > lastUpdate.protocolDay;
}

// Export for use in smart-update-fixed.js
module.exports = { generateFutureSupplyProjection, shouldUpdateProjection };

// Run if called directly
if (require.main === module) {
  generateFutureSupplyProjection();
}