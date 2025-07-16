// Calculate uncollected fees the way Uniswap interface does
const fs = require('fs');
const { ethers } = require('ethers');

const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';

const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function feeGrowthGlobal0X128() view returns (uint256)',
  'function feeGrowthGlobal1X128() view returns (uint256)',
  'function ticks(int24 tick) view returns (uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int128 liquidityGross, int128 liquidityNet, uint56 secondsOutside, uint160 secondsPerLiquidityOutsideX128, uint32 tickCumulativeOutside, bool initialized)'
];

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
];

// Helper to handle BigInt math safely
function subIn256(x, y) {
  const difference = x - y;
  const borrow = difference > x ? BigInt(1) : BigInt(0);
  return difference + (borrow << BigInt(256));
}

// Calculate fee growth inside the position's range
function getFeeGrowthInside(
  feeGrowthGlobal0,
  feeGrowthGlobal1,
  feeGrowthOutsideLower0,
  feeGrowthOutsideLower1,
  feeGrowthOutsideUpper0,
  feeGrowthOutsideUpper1,
  tickLower,
  tickUpper,
  tickCurrent
) {
  let feeGrowthBelow0, feeGrowthBelow1;
  if (tickCurrent >= tickLower) {
    feeGrowthBelow0 = feeGrowthOutsideLower0;
    feeGrowthBelow1 = feeGrowthOutsideLower1;
  } else {
    feeGrowthBelow0 = subIn256(feeGrowthGlobal0, feeGrowthOutsideLower0);
    feeGrowthBelow1 = subIn256(feeGrowthGlobal1, feeGrowthOutsideLower1);
  }

  let feeGrowthAbove0, feeGrowthAbove1;
  if (tickCurrent < tickUpper) {
    feeGrowthAbove0 = feeGrowthOutsideUpper0;
    feeGrowthAbove1 = feeGrowthOutsideUpper1;
  } else {
    feeGrowthAbove0 = subIn256(feeGrowthGlobal0, feeGrowthOutsideUpper0);
    feeGrowthAbove1 = subIn256(feeGrowthGlobal1, feeGrowthOutsideUpper1);
  }

  const feeGrowthInside0 = subIn256(subIn256(feeGrowthGlobal0, feeGrowthBelow0), feeGrowthAbove0);
  const feeGrowthInside1 = subIn256(subIn256(feeGrowthGlobal1, feeGrowthBelow1), feeGrowthAbove1);

  return { feeGrowthInside0, feeGrowthInside1 };
}

async function calculateUncollectedProperly() {
  console.log('💰 Calculating uncollected fees properly for all positions...');
  
  const provider = new ethers.providers.JsonRpcProvider('https://1rpc.io/eth');
  const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
  const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  
  try {
    // Get pool state
    const [slot0, feeGrowthGlobal0, feeGrowthGlobal1] = await Promise.all([
      pool.slot0(),
      pool.feeGrowthGlobal0X128(),
      pool.feeGrowthGlobal1X128()
    ]);
    
    const currentTick = slot0.tick;
    console.log('Current tick:', currentTick);
    
    // Load cached data
    const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    
    console.log('\n📊 Calculating fees for each position:');
    
    for (const cachedPos of cacheData.lpPositions) {
      try {
        const position = await positionManager.positions(cachedPos.tokenId);
        
        console.log(`\nPosition ${cachedPos.tokenId}:`);
        
        // Get tick data
        const [lowerTick, upperTick] = await Promise.all([
          pool.ticks(position.tickLower),
          pool.ticks(position.tickUpper)
        ]);
        
        // Calculate fee growth inside
        const { feeGrowthInside0, feeGrowthInside1 } = getFeeGrowthInside(
          BigInt(feeGrowthGlobal0.toString()),
          BigInt(feeGrowthGlobal1.toString()),
          BigInt(lowerTick.feeGrowthOutside0X128.toString()),
          BigInt(lowerTick.feeGrowthOutside1X128.toString()),
          BigInt(upperTick.feeGrowthOutside0X128.toString()),
          BigInt(upperTick.feeGrowthOutside1X128.toString()),
          position.tickLower,
          position.tickUpper,
          currentTick
        );
        
        // Calculate uncollected fees
        const liquidity = BigInt(position.liquidity.toString());
        let uncollected0 = BigInt(0);
        let uncollected1 = BigInt(0);
        
        if (liquidity > BigInt(0)) {
          // Use BigInt for Q128
          const Q128 = BigInt(1) << BigInt(128);
          
          const feeGrowthInside0Last = BigInt(position.feeGrowthInside0LastX128.toString());
          const feeGrowthInside1Last = BigInt(position.feeGrowthInside1LastX128.toString());
          
          uncollected0 = liquidity * subIn256(feeGrowthInside0, feeGrowthInside0Last) / Q128;
          uncollected1 = liquidity * subIn256(feeGrowthInside1, feeGrowthInside1Last) / Q128;
        }
        
        // Add to tokensOwed
        const totalClaimable0 = BigInt(position.tokensOwed0.toString()) + uncollected0;
        const totalClaimable1 = BigInt(position.tokensOwed1.toString()) + uncollected1;
        
        // Convert to decimal
        const claimableTorus = parseFloat(ethers.utils.formatEther(totalClaimable0.toString()));
        const claimableTitanX = parseFloat(ethers.utils.formatEther(totalClaimable1.toString()));
        
        console.log(`  tokensOwed: ${ethers.utils.formatEther(position.tokensOwed0)} TORUS, ${ethers.utils.formatEther(position.tokensOwed1)} TitanX`);
        console.log(`  Uncollected: ${ethers.utils.formatEther(uncollected0.toString())} TORUS, ${ethers.utils.formatEther(uncollected1.toString())} TitanX`);
        console.log(`  Total claimable: ${claimableTorus.toFixed(6)} TORUS, ${claimableTitanX.toFixed(2)} TitanX`);
        
        // Update cached position
        cachedPos.claimableTorus = claimableTorus;
        cachedPos.claimableTitanX = claimableTitanX;
        
        // Calculate APR if has claimable
        if (claimableTorus > 0 || claimableTitanX > 0) {
          const positionValueUSD = (cachedPos.amount0 * 0.00005) + (cachedPos.amount1 * 0.0000002);
          const claimableValueUSD = (claimableTorus * 0.00005) + (claimableTitanX * 0.0000002);
          
          // 4 days accumulation as you mentioned
          const dailyYield = claimableValueUSD / 4;
          const apr = (dailyYield * 365 / positionValueUSD) * 100;
          
          cachedPos.estimatedAPR = Math.min(apr, 200);
        }
        
        if (cachedPos.owner.toLowerCase() === '0xce32e10b205fbf49f3bb7132f7378751af1832b6') {
          console.log(`  ⭐ This is YOUR position - ${cachedPos.inRange ? 'IN RANGE' : 'OUT OF RANGE'}`);
        }
        
      } catch (e) {
        console.error(`Error processing position ${cachedPos.tokenId}:`, e.message);
      }
    }
    
    // Summary
    const totalClaimableTorus = cacheData.lpPositions.reduce((sum, p) => sum + (p.claimableTorus || 0), 0);
    const totalClaimableTitanX = cacheData.lpPositions.reduce((sum, p) => sum + (p.claimableTitanX || 0), 0);
    
    console.log('\n📊 Summary:');
    console.log(`Total claimable TORUS: ${totalClaimableTorus.toFixed(6)}`);
    console.log(`Total claimable TitanX: ${totalClaimableTitanX.toLocaleString('en-US')}`);
    
    // Save updated cache
    cacheData.lastUpdated = new Date().toISOString();
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cacheData, null, 2));
    
    console.log('\n✅ Updated with proper uncollected fee calculations!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

calculateUncollectedProperly().catch(console.error);