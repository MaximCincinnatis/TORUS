// Use EXACT math from frontend to get correct calculations
const fs = require('fs');
const { ethers } = require('ethers');

// Copy EXACT math from frontend
const Q96 = BigInt(2) ** BigInt(96);

function calculateTokenAmounts(
  liquidity,
  sqrtPriceX96,
  tickLower,
  tickUpper,
  token0Decimals,
  token1Decimals
) {
  const liquidityBN = BigInt(liquidity);
  const sqrtPrice = BigInt(sqrtPriceX96);
  
  // Calculate sqrt prices for the tick range
  const priceLower = Math.pow(1.0001, tickLower);
  const priceUpper = Math.pow(1.0001, tickUpper);
  
  const sqrtPriceLowerFloat = Math.sqrt(priceLower) * Math.pow(2, 96);
  const sqrtPriceUpperFloat = Math.sqrt(priceUpper) * Math.pow(2, 96);
  
  const sqrtPriceLower = BigInt(Math.floor(sqrtPriceLowerFloat));
  const sqrtPriceUpper = BigInt(Math.floor(sqrtPriceUpperFloat));
  
  let amount0 = BigInt(0);
  let amount1 = BigInt(0);
  
  // Calculate based on current price position
  if (sqrtPrice <= sqrtPriceLower) {
    // Current price is below the range, all liquidity is in token0
    amount0 = (liquidityBN * (sqrtPriceUpper - sqrtPriceLower) * Q96) / 
      (sqrtPriceUpper * sqrtPriceLower);
  } else if (sqrtPrice < sqrtPriceUpper) {
    // Current price is within the range
    amount0 = (liquidityBN * (sqrtPriceUpper - sqrtPrice) * Q96) / 
      (sqrtPriceUpper * sqrtPrice);
    amount1 = (liquidityBN * (sqrtPrice - sqrtPriceLower)) / Q96;
  } else {
    // Current price is above the range, all liquidity is in token1
    amount1 = (liquidityBN * (sqrtPriceUpper - sqrtPriceLower)) / Q96;
  }
  
  // Convert to decimal values
  const decimals0 = BigInt(10) ** BigInt(token0Decimals);
  const decimals1 = BigInt(10) ** BigInt(token1Decimals);
  
  const decimal0 = Number(amount0) / Number(decimals0);
  const decimal1 = Number(amount1) / Number(decimals1);
  
  return {
    amount0: decimal0,
    amount1: decimal1
  };
}

function tickToTitanXPrice(tick) {
  // For extreme negative ticks, return a large number
  if (tick < -800000) {
    return 1e15;
  }
  
  // For extreme positive ticks, return a small number
  if (tick > 800000) {
    return 1e-15;
  }
  
  try {
    const price = Math.pow(1.0001, tick);
    const titanXPrice = 1 / price;
    
    if (!isFinite(titanXPrice) || titanXPrice > 1e15) {
      return 1e15;
    }
    
    if (titanXPrice <= 0 || titanXPrice < 1e-15) {
      return 1e-15;
    }
    
    return titanXPrice;
  } catch (e) {
    return tick < 0 ? 1e15 : 1e-15;
  }
}

function isPositionInRange(currentTick, tickLower, tickUpper) {
  return currentTick >= tickLower && currentTick < tickUpper;
}

const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';

async function updateWithExactMath() {
  console.log('🚀 Updating LP positions with EXACT frontend math...');
  
  const provider = new ethers.providers.JsonRpcProvider('https://1rpc.io/eth');
  
  try {
    // Read current cache
    const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    
    // Get current pool state
    const poolContract = new ethers.Contract(POOL_ADDRESS, [
      'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'
    ], provider);
    
    const slot0 = await poolContract.slot0();
    const currentTick = slot0.tick;
    const sqrtPriceX96 = slot0.sqrtPriceX96.toString();
    
    console.log('Current tick:', currentTick);
    console.log('sqrtPriceX96:', sqrtPriceX96);
    
    // Update each position with correct calculations
    const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, [
      'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
    ], provider);
    
    const updatedPositions = [];
    
    for (const pos of cacheData.lpPositions) {
      try {
        // Fetch fresh position data
        const position = await positionManager.positions(pos.tokenId);
        
        // Use EXACT math from frontend
        const amounts = calculateTokenAmounts(
          position.liquidity.toString(),
          sqrtPriceX96,
          position.tickLower,
          position.tickUpper,
          18, // TORUS decimals
          18  // TitanX decimals
        );
        
        // Check if in range using EXACT logic
        const inRange = isPositionInRange(currentTick, position.tickLower, position.tickUpper);
        
        // Get exact claimable amounts
        const claimableTorus = parseFloat(ethers.utils.formatEther(position.tokensOwed0));
        const claimableTitanX = parseFloat(ethers.utils.formatEther(position.tokensOwed1));
        
        // Calculate price range for display
        const minTitanXPrice = tickToTitanXPrice(position.tickLower);
        const maxTitanXPrice = tickToTitanXPrice(position.tickUpper);
        
        // APR calculation based on 24hr fees
        // Frontend calculates based on pool's daily fees and position's share of liquidity
        let estimatedAPR = 0;
        
        // For now, use a simple calculation based on claimable fees
        // Real APR would need historical fee data from subgraph
        if (position.liquidity.gt(0)) {
          // Rough estimate: assume claimable fees are from ~3 days
          const positionValue = amounts.amount0 + (amounts.amount1 * 0.00002); // Convert to TORUS value
          const feesValue = claimableTorus + (claimableTitanX * 0.00002);
          
          if (positionValue > 0 && feesValue > 0) {
            const dailyReturn = feesValue / 3; // Assume 3 days accumulation
            const dailyRate = dailyReturn / positionValue;
            estimatedAPR = dailyRate * 365 * 100;
          }
        }
        
        updatedPositions.push({
          tokenId: pos.tokenId,
          owner: pos.owner,
          liquidity: position.liquidity.toString(),
          tickLower: position.tickLower,
          tickUpper: position.tickUpper,
          amount0: amounts.amount0,
          amount1: amounts.amount1,
          inRange,
          claimableTorus,
          claimableTitanX,
          estimatedAPR: Math.min(estimatedAPR, 999),
          minTitanXPrice,
          maxTitanXPrice
        });
        
        console.log(`\nPosition ${pos.tokenId}:`);
        console.log(`  In Range: ${inRange ? '✅' : '❌'} (ticks ${position.tickLower} to ${position.tickUpper}, current: ${currentTick})`);
        console.log(`  TORUS: ${amounts.amount0.toFixed(4)}`);
        console.log(`  TitanX: ${amounts.amount1.toFixed(4)}`);
        console.log(`  Claimable: ${claimableTorus.toFixed(4)} TORUS, ${claimableTitanX.toFixed(2)} TitanX`);
        console.log(`  Price Range: ${minTitanXPrice.toFixed(2)} - ${maxTitanXPrice.toFixed(2)} TitanX per TORUS`);
        if (estimatedAPR > 0) {
          console.log(`  APR: ${estimatedAPR.toFixed(2)}%`);
        }
        
      } catch (e) {
        console.error(`Error updating position ${pos.tokenId}:`, e.message);
      }
    }
    
    // Update cache with correct data
    cacheData.lpPositions = updatedPositions;
    cacheData.poolData.currentTick = currentTick;
    cacheData.poolData.sqrtPriceX96 = sqrtPriceX96;
    
    // Summary
    console.log('\n📊 CORRECTED RESULTS:');
    console.log(`  Total positions: ${updatedPositions.length}`);
    console.log(`  In-range: ${updatedPositions.filter(p => p.inRange).length}`);
    console.log(`  Out-of-range: ${updatedPositions.filter(p => !p.inRange).length}`);
    console.log(`  With claimable fees: ${updatedPositions.filter(p => p.claimableTorus > 0 || p.claimableTitanX > 0).length}`);
    
    // Calculate totals
    const totalTorus = updatedPositions.reduce((sum, p) => sum + p.amount0, 0);
    const totalTitanX = updatedPositions.reduce((sum, p) => sum + p.amount1, 0);
    const totalClaimableTorus = updatedPositions.reduce((sum, p) => sum + p.claimableTorus, 0);
    const totalClaimableTitanX = updatedPositions.reduce((sum, p) => sum + p.claimableTitanX, 0);
    
    console.log(`\n💰 TOTALS:`);
    console.log(`  Total TORUS in positions: ${totalTorus.toFixed(4)}`);
    console.log(`  Total TitanX in positions: ${totalTitanX.toFixed(4)}`);
    console.log(`  Total claimable TORUS: ${totalClaimableTorus.toFixed(4)}`);
    console.log(`  Total claimable TitanX: ${totalClaimableTitanX.toFixed(2)}`);
    
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cacheData, null, 2));
    console.log('\n✅ Cache updated with CORRECT calculations!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

updateWithExactMath().catch(console.error);