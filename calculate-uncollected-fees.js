// Calculate uncollected fees using Uniswap V3 fee growth tracking
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

const Q128 = BigInt(2) ** BigInt(128);

// Calculate fee growth inside a position's tick range
async function getFeeGrowthInside(pool, tickLower, tickUpper, currentTick, feeGrowthGlobal0, feeGrowthGlobal1) {
  try {
    const [lowerTick, upperTick] = await Promise.all([
      pool.ticks(tickLower),
      pool.ticks(tickUpper)
    ]);
    
    let feeGrowthBelow0, feeGrowthBelow1;
    if (currentTick >= tickLower) {
      feeGrowthBelow0 = BigInt(lowerTick.feeGrowthOutside0X128);
      feeGrowthBelow1 = BigInt(lowerTick.feeGrowthOutside1X128);
    } else {
      feeGrowthBelow0 = BigInt(feeGrowthGlobal0) - BigInt(lowerTick.feeGrowthOutside0X128);
      feeGrowthBelow1 = BigInt(feeGrowthGlobal1) - BigInt(lowerTick.feeGrowthOutside1X128);
    }
    
    let feeGrowthAbove0, feeGrowthAbove1;
    if (currentTick < tickUpper) {
      feeGrowthAbove0 = BigInt(upperTick.feeGrowthOutside0X128);
      feeGrowthAbove1 = BigInt(upperTick.feeGrowthOutside1X128);
    } else {
      feeGrowthAbove0 = BigInt(feeGrowthGlobal0) - BigInt(upperTick.feeGrowthOutside0X128);
      feeGrowthAbove1 = BigInt(feeGrowthGlobal1) - BigInt(upperTick.feeGrowthOutside1X128);
    }
    
    const feeGrowthInside0 = BigInt(feeGrowthGlobal0) - feeGrowthBelow0 - feeGrowthAbove0;
    const feeGrowthInside1 = BigInt(feeGrowthGlobal1) - feeGrowthBelow1 - feeGrowthAbove1;
    
    return { feeGrowthInside0, feeGrowthInside1 };
  } catch (e) {
    console.error('Error getting fee growth:', e.message);
    return { feeGrowthInside0: BigInt(0), feeGrowthInside1: BigInt(0) };
  }
}

// Calculate uncollected fees for a position
function calculateUncollectedFees(position, feeGrowthInside0, feeGrowthInside1) {
  const liquidity = BigInt(position.liquidity);
  
  if (liquidity === BigInt(0)) {
    return {
      uncollected0: BigInt(0),
      uncollected1: BigInt(0)
    };
  }
  
  // Calculate fee growth delta
  const feeGrowthDelta0 = feeGrowthInside0 - BigInt(position.feeGrowthInside0LastX128);
  const feeGrowthDelta1 = feeGrowthInside1 - BigInt(position.feeGrowthInside1LastX128);
  
  // Calculate uncollected fees
  const uncollected0 = (liquidity * feeGrowthDelta0) / Q128;
  const uncollected1 = (liquidity * feeGrowthDelta1) / Q128;
  
  return { uncollected0, uncollected1 };
}

async function calculateAllUncollectedFees() {
  console.log('💰 Calculating uncollected fees for all positions...');
  
  const provider = new ethers.providers.JsonRpcProvider('https://1rpc.io/eth');
  const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
  const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  
  try {
    // Get current pool state
    const [slot0, feeGrowthGlobal0, feeGrowthGlobal1] = await Promise.all([
      pool.slot0(),
      pool.feeGrowthGlobal0X128(),
      pool.feeGrowthGlobal1X128()
    ]);
    
    const currentTick = slot0.tick;
    console.log('Current tick:', currentTick);
    console.log('Fee growth global 0:', feeGrowthGlobal0.toString());
    console.log('Fee growth global 1:', feeGrowthGlobal1.toString());
    
    // Load cached data
    const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    
    // Calculate fees for each position
    console.log('\n📊 Calculating fees for each position:');
    
    for (const cachedPos of cacheData.lpPositions) {
      try {
        const position = await positionManager.positions(cachedPos.tokenId);
        
        // Get fee growth inside the position's range
        const { feeGrowthInside0, feeGrowthInside1 } = await getFeeGrowthInside(
          pool,
          position.tickLower,
          position.tickUpper,
          currentTick,
          feeGrowthGlobal0.toString(),
          feeGrowthGlobal1.toString()
        );
        
        // Calculate uncollected fees
        const { uncollected0, uncollected1 } = calculateUncollectedFees(
          position,
          feeGrowthInside0,
          feeGrowthInside1
        );
        
        // Total claimable = tokensOwed + uncollected
        const totalClaimable0 = BigInt(position.tokensOwed0) + uncollected0;
        const totalClaimable1 = BigInt(position.tokensOwed1) + uncollected1;
        
        // Convert to decimal
        const claimableTorus = parseFloat(ethers.utils.formatEther(totalClaimable0.toString()));
        const claimableTitanX = parseFloat(ethers.utils.formatEther(totalClaimable1.toString()));
        
        // Update cached position
        cachedPos.claimableTorus = claimableTorus;
        cachedPos.claimableTitanX = claimableTitanX;
        
        // Calculate simple APR if position has value
        if (cachedPos.amount0 > 0 && claimableTorus > 0) {
          // Assume fees accumulated over ~7 days
          const dailyYield = claimableTorus / 7 / cachedPos.amount0;
          cachedPos.estimatedAPR = Math.min(dailyYield * 365 * 100, 999);
        } else {
          cachedPos.estimatedAPR = 0;
        }
        
        if (claimableTorus > 0 || claimableTitanX > 0) {
          console.log(`\nPosition ${cachedPos.tokenId}:`);
          console.log(`  Owner: ${cachedPos.owner.slice(0, 10)}...`);
          console.log(`  Claimable TORUS: ${claimableTorus.toFixed(6)}`);
          console.log(`  Claimable TitanX: ${claimableTitanX.toLocaleString('en-US')}`);
          console.log(`  tokensOwed0: ${position.tokensOwed0.toString()}`);
          console.log(`  tokensOwed1: ${position.tokensOwed1.toString()}`);
          console.log(`  Uncollected0: ${ethers.utils.formatEther(uncollected0.toString())}`);
          console.log(`  Uncollected1: ${ethers.utils.formatEther(uncollected1.toString())}`);
        }
        
      } catch (e) {
        console.error(`Error calculating fees for position ${cachedPos.tokenId}:`, e.message);
      }
    }
    
    // Summary
    const positionsWithFees = cacheData.lpPositions.filter(p => 
      p.claimableTorus > 0 || p.claimableTitanX > 0
    );
    
    console.log('\n📊 Summary:');
    console.log(`Positions with claimable fees: ${positionsWithFees.length}`);
    
    const totalClaimableTorus = cacheData.lpPositions.reduce((sum, p) => sum + (p.claimableTorus || 0), 0);
    const totalClaimableTitanX = cacheData.lpPositions.reduce((sum, p) => sum + (p.claimableTitanX || 0), 0);
    
    console.log(`Total claimable TORUS: ${totalClaimableTorus.toFixed(6)}`);
    console.log(`Total claimable TitanX: ${totalClaimableTitanX.toLocaleString('en-US')}`);
    
    // Save updated cache
    cacheData.lastUpdated = new Date().toISOString();
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cacheData, null, 2));
    
    console.log('\n✅ Fee calculations updated!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

calculateAllUncollectedFees().catch(console.error);