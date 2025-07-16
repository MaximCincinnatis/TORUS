// Fix price calculations using proper Uniswap V3 math
const fs = require('fs');
const { ethers } = require('ethers');

const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';

const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() view returns (address)',
  'function token1() view returns (address)'
];

// Calculate actual price from current tick
function getCurrentPriceFromTick(tick) {
  // Price = 1.0001^tick
  // This gives us the price of token1 in terms of token0
  // Since token0 is TORUS and token1 is TitanX:
  // price = TitanX per TORUS
  const price = Math.pow(1.0001, tick);
  return price;
}

// Format price range for display
function formatPriceRange(tickLower, tickUpper, currentTick) {
  // For full range, use simple format
  if (tickLower === -887200 && tickUpper === 887200) {
    return 'Full Range';
  }
  
  // Calculate prices at tick boundaries
  // Since token0 is TORUS and token1 is TitanX
  // The price is already TitanX per TORUS
  const priceLower = Math.pow(1.0001, tickLower);
  const priceUpper = Math.pow(1.0001, tickUpper);
  
  // Format with appropriate precision
  const formatPrice = (price) => {
    if (price >= 1000000000) {
      return (price / 1000000000).toFixed(2) + 'B';
    } else if (price >= 1000000) {
      return (price / 1000000).toFixed(2) + 'M';
    } else if (price >= 1000) {
      return (price / 1000).toFixed(2) + 'K';
    } else if (price >= 1) {
      return price.toFixed(2);
    } else {
      return price.toExponential(2);
    }
  };
  
  // Show range as min-max TitanX per TORUS
  return `${formatPrice(priceLower)} - ${formatPrice(priceUpper)} TitanX/TORUS`;
}

async function fixPriceCalculations() {
  console.log('🔧 Fixing price calculations with proper Uniswap V3 math...');
  
  const provider = new ethers.providers.JsonRpcProvider('https://1rpc.io/eth');
  const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
  
  try {
    // Get current pool state
    const [slot0, token0, token1] = await Promise.all([
      poolContract.slot0(),
      poolContract.token0(),
      poolContract.token1()
    ]);
    
    const currentTick = slot0.tick;
    const currentPrice = getCurrentPriceFromTick(currentTick);
    
    console.log('Pool info:');
    console.log('  Token0 (TORUS):', token0);
    console.log('  Token1 (TitanX):', token1);
    console.log('  Current tick:', currentTick);
    console.log('  Current price:', currentPrice.toFixed(2), 'TitanX per TORUS');
    console.log('  Current price (millions):', (currentPrice / 1000000).toFixed(2), 'M TitanX per TORUS');
    
    // Load cached data
    const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    
    // Update each position with correct price range
    console.log('\n📊 Updating position price ranges:');
    
    cacheData.lpPositions.forEach(position => {
      // Calculate correct price range
      const priceRange = formatPriceRange(position.tickLower, position.tickUpper, currentTick);
      position.priceRange = priceRange;
      
      // Also fix the min/max prices
      position.minTitanXPrice = Math.pow(1.0001, position.tickLower);
      position.maxTitanXPrice = Math.pow(1.0001, position.tickUpper);
      
      if (position.owner.toLowerCase() === '0xce32e10b205fbf49f3bb7132f7378751af1832b6') {
        console.log(`\nPosition ${position.tokenId} (32b6 address):`);
        console.log(`  Ticks: ${position.tickLower} to ${position.tickUpper}`);
        console.log(`  Price Range: ${priceRange}`);
        console.log(`  In Range: ${position.inRange ? '✅' : '❌'}`);
      }
    });
    
    // Show all positions with their ranges
    console.log('\n📋 All positions with corrected price ranges:');
    cacheData.lpPositions.forEach(position => {
      console.log(`${position.tokenId}: ${position.priceRange} (${position.inRange ? 'In Range' : 'Out of Range'})`);
    });
    
    // Update pool data with current price info
    cacheData.poolData.currentPrice = currentPrice;
    cacheData.poolData.currentPriceFormatted = `${(currentPrice / 1000000).toFixed(2)}M TitanX/TORUS`;
    
    // Save updated cache
    cacheData.lastUpdated = new Date().toISOString();
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cacheData, null, 2));
    
    console.log('\n✅ Price calculations fixed!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixPriceCalculations().catch(console.error);