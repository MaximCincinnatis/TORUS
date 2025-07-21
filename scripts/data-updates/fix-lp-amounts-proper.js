const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { calculatePositionAmounts } = require('../../shared/lpCalculations');

async function fixLPAmounts() {
  console.log('🔧 Fixing LP position amounts...');
  
  // Load current data
  const dataPath = path.join(__dirname, '../../public/data/cached-data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  
  if (!data.uniswapV3?.lpPositions || !data.uniswapV3?.poolData) {
    console.error('❌ No LP positions or pool data found');
    return;
  }
  
  const poolData = data.uniswapV3.poolData;
  const currentTick = poolData.currentTick;
  const sqrtPriceX96 = poolData.sqrtPriceX96;
  
  console.log(`📊 Pool state: tick=${currentTick}, sqrtPriceX96=${sqrtPriceX96}`);
  console.log(`📊 Processing ${data.uniswapV3.lpPositions.length} positions...`);
  
  // Fix each position
  data.uniswapV3.lpPositions = data.uniswapV3.lpPositions.map(position => {
    if (!position.liquidity || position.liquidity === '0') {
      console.log(`  ⚠️  Position ${position.tokenId} has zero liquidity`);
      return {
        ...position,
        amount0: 0,
        amount1: 0,
        inRange: false,
        estimatedAPR: "0.00"
      };
    }
    
    // Recalculate amounts - pass position object and current tick
    const amounts = calculatePositionAmounts(
      position,
      sqrtPriceX96,
      currentTick
    );
    
    const inRange = position.tickLower <= currentTick && currentTick <= position.tickUpper;
    
    console.log(`  ✅ Position ${position.tokenId}: amount0=${amounts.amount0.toFixed(2)}, amount1=${amounts.amount1.toFixed(2)} (${inRange ? 'in range' : 'out of range'})`);
    
    return {
      ...position,
      amount0: amounts.amount0,
      amount1: amounts.amount1,
      inRange: inRange,
      // Set APR to 0 for out-of-range positions
      estimatedAPR: inRange ? (position.estimatedAPR || "0.00") : "0.00"
    };
  });
  
  // Also fix lpPositions if they exist at root level
  if (data.lpPositions) {
    data.lpPositions = data.lpPositions.map(position => {
      if (!position.liquidity || position.liquidity === '0') {
        return {
          ...position,
          amount0: 0,
          amount1: 0,
          inRange: false,
          estimatedAPR: "0.00"
        };
      }
      
      const amounts = calculatePositionAmounts(
        position,
        sqrtPriceX96,
        currentTick
      );
      
      const inRange = position.tickLower <= currentTick && currentTick <= position.tickUpper;
      
      return {
        ...position,
        amount0: amounts.amount0,
        amount1: amounts.amount1,
        inRange: inRange,
        estimatedAPR: inRange ? (position.estimatedAPR || "0.00") : "0.00"
      };
    });
  }
  
  // Update last updated timestamp
  data.lastUpdated = new Date().toISOString();
  
  // Write back
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  
  console.log('✅ LP amounts fixed successfully!');
  
  // Verify the fix
  console.log('\n📊 Verification:');
  const updatedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const samplePosition = updatedData.uniswapV3.lpPositions[0];
  console.log(`First position: ${samplePosition.tokenId} - amount0: ${samplePosition.amount0}, amount1: ${samplePosition.amount1}`);
}

fixLPAmounts().catch(console.error);