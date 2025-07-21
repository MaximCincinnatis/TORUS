const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { calculatePositionAmounts } = require('../../shared/lpCalculations');

async function fixLPAmounts() {
  console.log('🔧 Fixing LP position amounts...');
  
  // Load current data
  const dataPath = path.join(__dirname, '../../public/data/cached-data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  
  if (!data.lpPositions || !data.uniswapV3?.poolData) {
    console.error('❌ No LP positions or pool data found');
    return;
  }
  
  const poolData = data.uniswapV3.poolData;
  const currentTick = poolData.currentTick;
  const sqrtPriceX96 = poolData.sqrtPriceX96;
  
  console.log(`📊 Pool state: tick=${currentTick}, sqrtPriceX96=${sqrtPriceX96}`);
  console.log(`📊 Processing ${data.lpPositions.length} positions...`);
  
  // Fix each position
  data.lpPositions = data.lpPositions.map(position => {
    if (!position.liquidity || position.liquidity === '0') {
      console.log(`  ⚠️  Position ${position.tokenId} has zero liquidity`);
      return {
        ...position,
        torusAmount: 0,
        titanxAmount: 0,
        inRange: false
      };
    }
    
    // Recalculate amounts - pass position object and current tick
    const amounts = calculatePositionAmounts(
      position,
      sqrtPriceX96,
      currentTick
    );
    
    const inRange = position.tickLower <= currentTick && currentTick <= position.tickUpper;
    
    console.log(`  ✅ Position ${position.tokenId}: TORUS=${amounts.amount0.toFixed(2)}, TITANX=${amounts.amount1.toFixed(2)} (${inRange ? 'in range' : 'out of range'})`);
    
    return {
      ...position,
      torusAmount: amounts.amount0,
      titanxAmount: amounts.amount1,
      inRange: inRange,
      // Set APR to 0 for out-of-range positions
      estimatedAPR: inRange ? (position.estimatedAPR || "0.00") : "0.00"
    };
  });
  
  // Update last updated timestamp
  data.lastUpdated = new Date().toISOString();
  
  // Write back
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  
  console.log('✅ LP amounts fixed successfully!');
}

fixLPAmounts().catch(console.error);