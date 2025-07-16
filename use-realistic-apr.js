// Use more realistic APR calculations
const fs = require('fs');

// Uniswap V3 Subgraph data (from cache)
const POOL_DATA = {
  dailyVolumeUSD: 629279, // ~$629k daily volume
  tvlUSD: 5544703, // ~$5.5M TVL
  feeTier: 0.003 // 0.3% fee tier
};

// More realistic APR calculation
function calculateRealisticAPR(position) {
  // Skip if out of range or no liquidity
  if (!position.inRange || position.liquidity === '0') {
    return 0;
  }
  
  // Calculate position value in USD
  const torusPrice = 0.00005; // $0.00005 per TORUS
  const titanXPrice = 0.0000002; // $200 per 1B TitanX
  const positionValueUSD = (position.amount0 * torusPrice) + (position.amount1 * titanXPrice);
  
  if (positionValueUSD <= 0) return 0;
  
  // Calculate daily fees for the entire pool
  const dailyPoolFees = POOL_DATA.dailyVolumeUSD * POOL_DATA.feeTier;
  
  // Estimate position's share based on its value vs TVL
  // This is simplified - actual share depends on liquidity concentration
  const positionShare = positionValueUSD / POOL_DATA.tvlUSD;
  
  // Estimate daily fees for this position
  const dailyPositionFees = dailyPoolFees * positionShare;
  
  // Calculate APR
  const apr = (dailyPositionFees * 365 / positionValueUSD) * 100;
  
  // Apply a reality factor (concentrated positions can earn 2-5x average)
  const concentrationMultiplier = 2.5; // Conservative estimate
  const realisticAPR = apr * concentrationMultiplier;
  
  // Cap at reasonable maximum (200% is very high for DeFi)
  return Math.min(realisticAPR, 200);
}

// For positions with actual claimable fees, calculate based on that
function calculateAPRFromClaimable(position, daysSinceDeposit = 30) {
  if (position.claimableTorus <= 0 && position.claimableTitanX <= 0) {
    return 0;
  }
  
  // Calculate position and claimable values
  const torusPrice = 0.00005;
  const titanXPrice = 0.0000002;
  
  const positionValueUSD = (position.amount0 * torusPrice) + (position.amount1 * titanXPrice);
  const claimableValueUSD = (position.claimableTorus * torusPrice) + (position.claimableTitanX * titanXPrice);
  
  if (positionValueUSD <= 0) return 0;
  
  // Calculate daily yield
  const dailyYield = claimableValueUSD / daysSinceDeposit;
  const dailyYieldRate = dailyYield / positionValueUSD;
  
  // Annualize
  const apr = dailyYieldRate * 365 * 100;
  
  return Math.min(apr, 200); // Cap at 200%
}

async function updateWithRealisticAPR() {
  console.log('📊 Updating with realistic APR calculations...');
  console.log('\nPool data:');
  console.log(`  Daily Volume: $${POOL_DATA.dailyVolumeUSD.toLocaleString()}`);
  console.log(`  TVL: $${POOL_DATA.tvlUSD.toLocaleString()}`);
  console.log(`  Daily Fees: $${(POOL_DATA.dailyVolumeUSD * POOL_DATA.feeTier).toLocaleString()}`);
  
  try {
    // Load cached data
    const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    
    console.log('\n📈 Calculating realistic APRs:');
    
    for (const position of cacheData.lpPositions) {
      // Calculate APR based on claimable fees if available
      let apr = 0;
      
      if (position.claimableTorus > 0 || position.claimableTitanX > 0) {
        // Use actual claimable fees for APR
        apr = calculateAPRFromClaimable(position);
        console.log(`\nPosition ${position.tokenId}: APR from claimable fees`);
      } else if (position.inRange) {
        // Estimate APR from pool activity
        apr = calculateRealisticAPR(position);
        console.log(`\nPosition ${position.tokenId}: APR from pool activity`);
      } else {
        console.log(`\nPosition ${position.tokenId}: Out of range, 0% APR`);
      }
      
      position.estimatedAPR = apr;
      
      const positionValueUSD = (position.amount0 * 0.00005) + (position.amount1 * 0.0000002);
      console.log(`  Value: $${positionValueUSD.toFixed(2)}`);
      console.log(`  In Range: ${position.inRange ? '✅' : '❌'}`);
      console.log(`  Claimable: ${position.claimableTorus.toFixed(4)} TORUS, ${position.claimableTitanX.toLocaleString()} TitanX`);
      console.log(`  APR: ${apr.toFixed(2)}%`);
    }
    
    // Summary
    const avgAPR = cacheData.lpPositions
      .filter(p => p.inRange)
      .reduce((sum, p) => sum + p.estimatedAPR, 0) / cacheData.lpPositions.filter(p => p.inRange).length;
    
    console.log('\n📊 Summary:');
    console.log(`Average APR for in-range positions: ${avgAPR.toFixed(2)}%`);
    console.log('\n⚠️ Note: APR is estimated based on:');
    console.log('- Actual claimable fees (when available)');
    console.log('- Pool trading volume and liquidity share (otherwise)');
    console.log('- Conservative 2.5x multiplier for concentrated positions');
    console.log('- Capped at 200% maximum');
    
    // Save updated cache
    cacheData.lastUpdated = new Date().toISOString();
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cacheData, null, 2));
    
    console.log('\n✅ Updated with realistic APRs!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

updateWithRealisticAPR().catch(console.error);