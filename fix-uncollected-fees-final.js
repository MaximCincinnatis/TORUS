// Fix uncollected fees calculation to match Uniswap
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

// Calculate fee growth inside range properly
function getFeeGrowthInside(
  feeGrowthGlobal0,
  feeGrowthGlobal1,
  feeGrowthOutside0Lower,
  feeGrowthOutside1Lower,
  feeGrowthOutside0Upper,
  feeGrowthOutside1Upper,
  tickLower,
  tickUpper,
  tickCurrent
) {
  // All values as BigInt
  const MAX_UINT256 = (BigInt(1) << BigInt(256)) - BigInt(1);
  
  // Helper for subtraction with underflow
  const sub = (a, b) => {
    if (a >= b) return a - b;
    return MAX_UINT256 - b + a + BigInt(1);
  };
  
  // Calculate fee growth below
  let feeGrowthBelow0, feeGrowthBelow1;
  if (tickCurrent >= tickLower) {
    feeGrowthBelow0 = feeGrowthOutside0Lower;
    feeGrowthBelow1 = feeGrowthOutside1Lower;
  } else {
    feeGrowthBelow0 = sub(feeGrowthGlobal0, feeGrowthOutside0Lower);
    feeGrowthBelow1 = sub(feeGrowthGlobal1, feeGrowthOutside1Lower);
  }
  
  // Calculate fee growth above
  let feeGrowthAbove0, feeGrowthAbove1;
  if (tickCurrent < tickUpper) {
    feeGrowthAbove0 = feeGrowthOutside0Upper;
    feeGrowthAbove1 = feeGrowthOutside1Upper;
  } else {
    feeGrowthAbove0 = sub(feeGrowthGlobal0, feeGrowthOutside0Upper);
    feeGrowthAbove1 = sub(feeGrowthGlobal1, feeGrowthOutside1Upper);
  }
  
  // Calculate fee growth inside
  const feeGrowthInside0 = sub(sub(feeGrowthGlobal0, feeGrowthBelow0), feeGrowthAbove0);
  const feeGrowthInside1 = sub(sub(feeGrowthGlobal1, feeGrowthBelow1), feeGrowthAbove1);
  
  return { feeGrowthInside0, feeGrowthInside1 };
}

async function fixUncollectedFees() {
  console.log('🔧 Fixing uncollected fees to match Uniswap...');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.llamarpc.com');
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
    
    // Load cached data
    const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    
    // Positions that need fixing
    const positionsToFix = ['1031533', '1032346', '1031465'];
    
    console.log('\n📊 Calculating uncollected fees for positions with yield:');
    
    for (const tokenId of positionsToFix) {
      const cachedPos = cacheData.lpPositions.find(p => p.tokenId === tokenId);
      if (!cachedPos) continue;
      
      try {
        const position = await positionManager.positions(tokenId);
        
        console.log(`\nPosition ${tokenId}:`);
        console.log(`  Owner: ${cachedPos.owner.slice(0, 10)}...`);
        console.log(`  Liquidity: ${position.liquidity.toString()}`);
        console.log(`  Range: ${position.tickLower} to ${position.tickUpper}`);
        console.log(`  In range: ${cachedPos.inRange ? '✅' : '❌'}`);
        
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
        const Q128 = BigInt(1) << BigInt(128);
        
        let uncollected0 = BigInt(0);
        let uncollected1 = BigInt(0);
        
        if (liquidity > BigInt(0) && position.feeGrowthInside0LastX128.toString() === '0') {
          // Position has never collected, all fee growth is uncollected
          uncollected0 = (liquidity * feeGrowthInside0) / Q128;
          uncollected1 = (liquidity * feeGrowthInside1) / Q128;
        } else if (liquidity > BigInt(0)) {
          // Calculate delta
          const MAX_UINT256 = (BigInt(1) << BigInt(256)) - BigInt(1);
          const sub = (a, b) => {
            if (a >= b) return a - b;
            return MAX_UINT256 - b + a + BigInt(1);
          };
          
          const delta0 = sub(feeGrowthInside0, BigInt(position.feeGrowthInside0LastX128.toString()));
          const delta1 = sub(feeGrowthInside1, BigInt(position.feeGrowthInside1LastX128.toString()));
          
          uncollected0 = (liquidity * delta0) / Q128;
          uncollected1 = (liquidity * delta1) / Q128;
        }
        
        // Sanity check - fees shouldn't be negative or extremely large
        const MAX_REASONABLE = BigInt(10) ** BigInt(25); // 10M tokens
        if (uncollected0 < 0 || uncollected0 > MAX_REASONABLE) uncollected0 = BigInt(0);
        if (uncollected1 < 0 || uncollected1 > MAX_REASONABLE) uncollected1 = BigInt(0);
        
        // Total claimable
        const totalClaimable0 = BigInt(position.tokensOwed0.toString()) + uncollected0;
        const totalClaimable1 = BigInt(position.tokensOwed1.toString()) + uncollected1;
        
        // Convert to decimal
        const claimableTorus = parseFloat(ethers.utils.formatEther(totalClaimable0.toString()));
        const claimableTitanX = parseFloat(ethers.utils.formatEther(totalClaimable1.toString()));
        
        console.log(`  tokensOwed: ${ethers.utils.formatEther(position.tokensOwed0)} TORUS, ${ethers.utils.formatEther(position.tokensOwed1)} TitanX`);
        console.log(`  Uncollected: ${ethers.utils.formatEther(uncollected0.toString())} TORUS, ${ethers.utils.formatEther(uncollected1.toString())} TitanX`);
        console.log(`  Total claimable: ${claimableTorus.toFixed(6)} TORUS, ${(claimableTitanX/1000000).toFixed(2)}M TitanX`);
        
        // Update cached position
        cachedPos.claimableTorus = claimableTorus;
        cachedPos.claimableTitanX = claimableTitanX;
        
        // Update APR if has claimable
        if (claimableTorus > 0 || claimableTitanX > 0) {
          const positionValueUSD = (cachedPos.amount0 * 0.00005) + (cachedPos.amount1 * 0.0000002);
          const claimableValueUSD = (claimableTorus * 0.00005) + (claimableTitanX * 0.0000002);
          
          // Estimate 5 days average
          const dailyYield = claimableValueUSD / 5;
          const apr = (dailyYield * 365 / positionValueUSD) * 100;
          
          cachedPos.estimatedAPR = Math.min(apr, 999);
          console.log(`  APR: ${cachedPos.estimatedAPR.toFixed(2)}%`);
        }
        
      } catch (e) {
        console.error(`Error processing position ${tokenId}:`, e.message);
      }
    }
    
    // Save updated cache
    cacheData.lastUpdated = new Date().toISOString();
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cacheData, null, 2));
    
    console.log('\n✅ Updated positions with uncollected fees!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixUncollectedFees().catch(console.error);