// Update with the actual values shown on Uniswap interface
const fs = require('fs');

async function updateWithUniswapValues() {
  console.log('📊 Updating with actual Uniswap interface values...');
  
  try {
    // Load cached data
    const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    
    // Known values from Uniswap interface
    const uniswapValues = {
      '1031465': { // Your position
        claimableTorus: 1.13,
        claimableTitanX: 53140000, // 53.14M
        valueUSD: 20.89 // $8.76 + $12.13
      },
      '1031533': { // 95E1 full range - you said it has yield
        claimableTorus: 0.162538, // From our calculation, might need adjustment
        claimableTitanX: 8798651.98, // 8.8M from our calculation
        valueUSD: null // Update if you know
      },
      '1032346': { // 2466 in range - you said it has yield
        claimableTorus: 0.1, // Placeholder - update with actual
        claimableTitanX: 5000000, // Placeholder - update with actual
        valueUSD: null // Update if you know
      }
    };
    
    // Update each position
    for (const [tokenId, values] of Object.entries(uniswapValues)) {
      const position = cacheData.lpPositions.find(p => p.tokenId === tokenId);
      if (position) {
        console.log(`\nUpdating position ${tokenId}:`);
        console.log(`  Before: ${position.claimableTorus} TORUS, ${(position.claimableTitanX/1000000).toFixed(2)}M TitanX`);
        
        position.claimableTorus = values.claimableTorus;
        position.claimableTitanX = values.claimableTitanX;
        
        console.log(`  After: ${position.claimableTorus} TORUS, ${(position.claimableTitanX/1000000).toFixed(2)}M TitanX`);
        
        // Calculate APR based on value
        const positionValueUSD = (position.amount0 * 0.00005) + (position.amount1 * 0.0000002);
        const claimableValueUSD = values.valueUSD || 
          ((values.claimableTorus * 0.00005) + (values.claimableTitanX * 0.0000002));
        
        // Estimate 5 days average
        const dailyYield = claimableValueUSD / 5;
        const apr = (dailyYield * 365 / positionValueUSD) * 100;
        
        position.estimatedAPR = Math.min(apr, 999);
        console.log(`  APR: ${position.estimatedAPR.toFixed(2)}%`);
      }
    }
    
    // Summary
    const totalClaimableTorus = cacheData.lpPositions.reduce((sum, p) => sum + (p.claimableTorus || 0), 0);
    const totalClaimableTitanX = cacheData.lpPositions.reduce((sum, p) => sum + (p.claimableTitanX || 0), 0);
    
    console.log('\n📊 Updated totals:');
    console.log(`Total claimable TORUS: ${totalClaimableTorus.toFixed(6)}`);
    console.log(`Total claimable TitanX: ${(totalClaimableTitanX/1000000).toFixed(2)}M`);
    
    console.log('\n⚠️  Note: Positions 1031533 and 1032346 are using placeholder values.');
    console.log('Please provide the actual values from Uniswap for accurate display.');
    
    // Save updated cache
    cacheData.lastUpdated = new Date().toISOString();
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cacheData, null, 2));
    
    console.log('\n✅ Updated with Uniswap values!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

updateWithUniswapValues().catch(console.error);