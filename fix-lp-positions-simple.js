// Simple fix for LP positions - use direct tokensOwed values and proper price range display
const fs = require('fs');
const { ethers } = require('ethers');

const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function ownerOf(uint256 tokenId) view returns (address)'
];

const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'
];

// Calculate token amounts with EXACT math
function calculateTokenAmounts(liquidity, sqrtPriceX96, tickLower, tickUpper) {
  const Q96 = BigInt(2) ** BigInt(96);
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
  const decimals = BigInt(10) ** BigInt(18);
  
  return {
    amount0: Number(amount0) / Number(decimals),
    amount1: Number(amount1) / Number(decimals)
  };
}

// Format price range for display
function formatPriceRange(tickLower, tickUpper) {
  // For full range, use simple format
  if (tickLower === -887200 && tickUpper === 887200) {
    return 'Full Range';
  }
  
  // Calculate prices (TORUS per TitanX)
  const priceLower = Math.pow(1.0001, tickLower);
  const priceUpper = Math.pow(1.0001, tickUpper);
  
  // For display, we want TitanX per TORUS (how many TitanX you get for 1 TORUS)
  // This is the reciprocal of the tick price
  // Higher tick = higher TORUS price = more TitanX per TORUS
  const titanXPerTorusLower = priceLower;
  const titanXPerTorusUpper = priceUpper;
  
  // Format with appropriate precision
  const formatPrice = (price) => {
    if (price >= 1000000) {
      return (price / 1000000).toFixed(1) + 'M';
    } else if (price >= 1000) {
      return (price / 1000).toFixed(1) + 'K';
    } else if (price >= 1) {
      return price.toFixed(2);
    } else if (price >= 0.001) {
      return price.toFixed(6);
    } else if (price >= 0.000001) {
      return price.toFixed(8);
    } else if (price >= 0.000000001) {
      return price.toFixed(10);
    } else {
      // For extremely small values, show in millions
      return (price * 1000000).toFixed(2) + 'M⁻¹';
    }
  };
  
  return `${formatPrice(titanXPerTorusLower)} - ${formatPrice(titanXPerTorusUpper)} TitanX/TORUS`;
}

async function fixLPPositions() {
  console.log('🔧 Fixing LP positions with simple approach...');
  
  const provider = new ethers.providers.JsonRpcProvider('https://1rpc.io/eth');
  const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
  
  try {
    // Get pool state
    const slot0 = await pool.slot0();
    const currentTick = slot0.tick;
    const sqrtPriceX96 = slot0.sqrtPriceX96.toString();
    
    console.log('Current pool tick:', currentTick);
    
    // Load cached data
    const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    
    // Track unique positions by tokenId
    const uniquePositions = new Map();
    
    // Process all positions
    for (const cachedPos of cacheData.lpPositions) {
      // Skip duplicates
      if (uniquePositions.has(cachedPos.tokenId)) {
        console.log(`Skipping duplicate position ${cachedPos.tokenId}`);
        continue;
      }
      
      try {
        // Get fresh on-chain data
        const [position, currentOwner] = await Promise.all([
          positionManager.positions(cachedPos.tokenId),
          positionManager.ownerOf(cachedPos.tokenId)
        ]);
        
        // Calculate token amounts
        const amounts = calculateTokenAmounts(
          position.liquidity.toString(),
          sqrtPriceX96,
          position.tickLower,
          position.tickUpper
        );
        
        // Check if in range
        const inRange = currentTick >= position.tickLower && currentTick < position.tickUpper;
        
        // Get claimable amounts directly from contract
        const claimableTorus = parseFloat(ethers.utils.formatEther(position.tokensOwed0));
        const claimableTitanX = parseFloat(ethers.utils.formatEther(position.tokensOwed1));
        
        // Calculate simple APR estimate
        let estimatedAPR = 0;
        if (amounts.amount0 > 0 && claimableTorus > 0) {
          // Assume fees accumulated over ~7 days
          const dailyYield = claimableTorus / 7 / amounts.amount0;
          estimatedAPR = Math.min(dailyYield * 365 * 100, 999);
        }
        
        // Format price range
        const priceRange = formatPriceRange(position.tickLower, position.tickUpper);
        
        const positionData = {
          tokenId: cachedPos.tokenId,
          owner: currentOwner,
          liquidity: position.liquidity.toString(),
          tickLower: position.tickLower,
          tickUpper: position.tickUpper,
          amount0: amounts.amount0,
          amount1: amounts.amount1,
          inRange,
          claimableTorus,
          claimableTitanX,
          estimatedAPR,
          priceRange,
          minTitanXPrice: 1 / Math.pow(1.0001, position.tickUpper),
          maxTitanXPrice: 1 / Math.pow(1.0001, position.tickLower)
        };
        
        uniquePositions.set(cachedPos.tokenId, positionData);
        
        if (currentOwner.toLowerCase() === '0xce32e10b205fbf49f3bb7132f7378751af1832b6') {
          console.log(`\nPosition ${cachedPos.tokenId} (32b6 address):`);
          console.log(`  In Range: ${inRange ? '✅' : '❌'}`);
          console.log(`  TORUS: ${amounts.amount0.toFixed(4)}`);
          console.log(`  TitanX: ${amounts.amount1.toFixed(2)}`);
          console.log(`  Claimable: ${claimableTorus.toFixed(6)} TORUS, ${claimableTitanX.toFixed(2)} TitanX`);
          console.log(`  Price Range: ${priceRange}`);
        }
        
      } catch (e) {
        console.error(`Error processing position ${cachedPos.tokenId}:`, e.message);
        // Keep the cached data if we can't fetch fresh data
        uniquePositions.set(cachedPos.tokenId, cachedPos);
      }
    }
    
    // Convert map to array
    const finalPositions = Array.from(uniquePositions.values());
    
    console.log('\n📊 Summary:');
    console.log(`Total unique positions: ${finalPositions.length}`);
    console.log(`In-range: ${finalPositions.filter(p => p.inRange).length}`);
    console.log(`Out-of-range: ${finalPositions.filter(p => !p.inRange).length}`);
    console.log(`With claimable fees: ${finalPositions.filter(p => p.claimableTorus > 0 || p.claimableTitanX > 0).length}`);
    
    // Update cache
    cacheData.lpPositions = finalPositions;
    cacheData.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cacheData, null, 2));
    console.log('\n✅ Cache updated with fixed LP positions!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixLPPositions().catch(console.error);