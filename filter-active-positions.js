// Filter out removed/empty positions, keep only active ones
const fs = require('fs');

function filterActivePositions() {
  console.log('🧹 Filtering out removed/empty LP positions...');
  
  try {
    // Load cached data
    const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    
    console.log(`\nTotal positions before filtering: ${cacheData.lpPositions.length}`);
    
    // Filter positions - keep if ANY of these are true:
    // 1. Has liquidity
    // 2. Has TORUS tokens (amount0)
    // 3. Has TitanX tokens (amount1)
    // 4. Has claimable fees
    const activePositions = cacheData.lpPositions.filter(position => {
      const hasLiquidity = position.liquidity !== '0' && position.liquidity !== 0;
      const hasTorus = position.amount0 > 0;
      const hasTitanX = position.amount1 > 0;
      const hasClaimableFees = (position.claimableTorus || 0) > 0 || (position.claimableTitanX || 0) > 0;
      
      const isActive = hasLiquidity || hasTorus || hasTitanX || hasClaimableFees;
      
      if (!isActive) {
        console.log(`\n❌ Removing empty position ${position.tokenId}:`);
        console.log(`   Owner: ${position.owner.slice(0, 10)}...`);
        console.log(`   Liquidity: ${position.liquidity}`);
        console.log(`   TORUS: ${position.amount0}`);
        console.log(`   TitanX: ${position.amount1}`);
        console.log(`   Claimable: ${position.claimableTorus || 0} TORUS, ${position.claimableTitanX || 0} TitanX`);
      }
      
      return isActive;
    });
    
    console.log(`\n✅ Active positions remaining: ${activePositions.length}`);
    
    // Show breakdown of active positions
    const inRangeCount = activePositions.filter(p => p.inRange).length;
    const outOfRangeCount = activePositions.filter(p => !p.inRange).length;
    const withFeesCount = activePositions.filter(p => (p.claimableTorus || 0) > 0 || (p.claimableTitanX || 0) > 0).length;
    
    console.log(`  - In range: ${inRangeCount}`);
    console.log(`  - Out of range: ${outOfRangeCount}`);
    console.log(`  - With claimable fees: ${withFeesCount}`);
    
    // Show all active positions
    console.log('\n📋 Active positions:');
    activePositions.forEach(pos => {
      const status = pos.inRange ? '✅ In Range' : '❌ Out of Range';
      const hasTokens = pos.amount0 > 0 || pos.amount1 > 0;
      const hasFees = (pos.claimableTorus || 0) > 0 || (pos.claimableTitanX || 0) > 0;
      
      console.log(`\n${pos.tokenId} - ${pos.owner.slice(0, 10)}... ${status}`);
      if (hasTokens) {
        console.log(`  Tokens: ${pos.amount0.toFixed(2)} TORUS, ${(pos.amount1/1000000).toFixed(2)}M TitanX`);
      }
      if (hasFees) {
        console.log(`  Fees: ${(pos.claimableTorus || 0).toFixed(2)} TORUS, ${((pos.claimableTitanX || 0)/1000000).toFixed(2)}M TitanX`);
      }
      console.log(`  Range: ${pos.priceRange}`);
    });
    
    // Update cache with filtered positions
    cacheData.lpPositions = activePositions;
    cacheData.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cacheData, null, 2));
    
    console.log('\n✅ Removed empty positions from cache!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

filterActivePositions();