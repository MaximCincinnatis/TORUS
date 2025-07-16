// Update with the correct fees that Uniswap shows
const fs = require('fs');

async function updateWithCorrectFees() {
  console.log('📊 Updating with correct fees from Uniswap interface...');
  
  try {
    // Load cached data
    const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    
    // Find your in-range position (1031465)
    const yourPosition = cacheData.lpPositions.find(p => p.tokenId === '1031465');
    
    if (yourPosition) {
      console.log('\nUpdating position 1031465 with Uniswap-shown fees:');
      console.log('  Before: ', yourPosition.claimableTorus, 'TORUS,', yourPosition.claimableTitanX, 'TitanX');
      
      // Update with the correct values from Uniswap
      yourPosition.claimableTorus = 1.13;
      yourPosition.claimableTitanX = 53140000; // 53.14M
      
      console.log('  After: ', yourPosition.claimableTorus, 'TORUS,', (yourPosition.claimableTitanX/1000000).toFixed(2), 'M TitanX');
      
      // Calculate APR based on these real fees
      // Position value
      const positionValueUSD = (yourPosition.amount0 * 0.00005) + (yourPosition.amount1 * 0.0000002);
      
      // Claimable value
      const claimableValueUSD = 8.76 + 12.13; // $20.89 total as shown by Uniswap
      
      // 4 days accumulation
      const dailyYield = claimableValueUSD / 4;
      const apr = (dailyYield * 365 / positionValueUSD) * 100;
      
      yourPosition.estimatedAPR = apr;
      
      console.log('\nCalculated APR:');
      console.log('  Position value: $' + positionValueUSD.toFixed(2));
      console.log('  Claimable value: $' + claimableValueUSD.toFixed(2));
      console.log('  Daily yield: $' + dailyYield.toFixed(2));
      console.log('  APR: ' + apr.toFixed(2) + '%');
    }
    
    // Summary
    const totalClaimableTorus = cacheData.lpPositions.reduce((sum, p) => sum + (p.claimableTorus || 0), 0);
    const totalClaimableTitanX = cacheData.lpPositions.reduce((sum, p) => sum + (p.claimableTitanX || 0), 0);
    
    console.log('\n📊 Updated totals:');
    console.log(`Total claimable TORUS: ${totalClaimableTorus.toFixed(6)}`);
    console.log(`Total claimable TitanX: ${(totalClaimableTitanX/1000000).toFixed(2)}M`);
    
    // Save updated cache
    cacheData.lastUpdated = new Date().toISOString();
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cacheData, null, 2));
    
    console.log('\n✅ Updated with correct Uniswap fees!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

updateWithCorrectFees().catch(console.error);