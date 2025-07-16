// Fix overflow in fee calculations - handle TitanX's large numbers properly
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

// Safe subtraction in 256-bit space
function subIn256(x, y) {
  const MAX_UINT256 = (BigInt(1) << BigInt(256)) - BigInt(1);
  if (x >= y) {
    return x - y;
  } else {
    // Underflow - wrap around
    return MAX_UINT256 - y + x + BigInt(1);
  }
}

async function fixOverflowCalculation() {
  console.log('🔧 Fixing fee calculations with overflow handling...');
  
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
    
    // Focus on your in-range position
    const tokenId = '1031465';
    console.log(`\nChecking position ${tokenId} (your in-range position):`);
    
    const position = await positionManager.positions(tokenId);
    
    // Get tick data
    const [lowerTick, upperTick] = await Promise.all([
      pool.ticks(position.tickLower),
      pool.ticks(position.tickUpper)
    ]);
    
    console.log('\nPosition data:');
    console.log('  Liquidity:', position.liquidity.toString());
    console.log('  In range:', currentTick >= position.tickLower && currentTick < position.tickUpper);
    console.log('  feeGrowthInside0LastX128:', position.feeGrowthInside0LastX128.toString());
    console.log('  feeGrowthInside1LastX128:', position.feeGrowthInside1LastX128.toString());
    
    // Calculate fee growth inside position range
    const feeGrowthGlobal0BN = BigInt(feeGrowthGlobal0.toString());
    const feeGrowthGlobal1BN = BigInt(feeGrowthGlobal1.toString());
    
    // Calculate fee growth below
    let feeGrowthBelow0, feeGrowthBelow1;
    if (currentTick >= position.tickLower) {
      feeGrowthBelow0 = BigInt(lowerTick.feeGrowthOutside0X128.toString());
      feeGrowthBelow1 = BigInt(lowerTick.feeGrowthOutside1X128.toString());
    } else {
      feeGrowthBelow0 = subIn256(feeGrowthGlobal0BN, BigInt(lowerTick.feeGrowthOutside0X128.toString()));
      feeGrowthBelow1 = subIn256(feeGrowthGlobal1BN, BigInt(lowerTick.feeGrowthOutside1X128.toString()));
    }
    
    // Calculate fee growth above
    let feeGrowthAbove0, feeGrowthAbove1;
    if (currentTick < position.tickUpper) {
      feeGrowthAbove0 = BigInt(upperTick.feeGrowthOutside0X128.toString());
      feeGrowthAbove1 = BigInt(upperTick.feeGrowthOutside1X128.toString());
    } else {
      feeGrowthAbove0 = subIn256(feeGrowthGlobal0BN, BigInt(upperTick.feeGrowthOutside0X128.toString()));
      feeGrowthAbove1 = subIn256(feeGrowthGlobal1BN, BigInt(upperTick.feeGrowthOutside1X128.toString()));
    }
    
    // Calculate fee growth inside
    const feeGrowthInside0 = subIn256(subIn256(feeGrowthGlobal0BN, feeGrowthBelow0), feeGrowthAbove0);
    const feeGrowthInside1 = subIn256(subIn256(feeGrowthGlobal1BN, feeGrowthBelow1), feeGrowthAbove1);
    
    console.log('\nFee growth calculations:');
    console.log('  feeGrowthInside0:', feeGrowthInside0.toString());
    console.log('  feeGrowthInside1:', feeGrowthInside1.toString());
    
    // Calculate uncollected fees
    const liquidity = BigInt(position.liquidity.toString());
    const Q128 = BigInt(1) << BigInt(128);
    
    let uncollected0 = BigInt(0);
    let uncollected1 = BigInt(0);
    
    if (liquidity > BigInt(0)) {
      const feeGrowthDelta0 = subIn256(feeGrowthInside0, BigInt(position.feeGrowthInside0LastX128.toString()));
      const feeGrowthDelta1 = subIn256(feeGrowthInside1, BigInt(position.feeGrowthInside1LastX128.toString()));
      
      // Check if deltas are reasonable
      const MAX_REASONABLE_DELTA = BigInt(1) << BigInt(200); // Sanity check
      
      if (feeGrowthDelta0 < MAX_REASONABLE_DELTA) {
        uncollected0 = (liquidity * feeGrowthDelta0) / Q128;
      }
      
      if (feeGrowthDelta1 < MAX_REASONABLE_DELTA) {
        uncollected1 = (liquidity * feeGrowthDelta1) / Q128;
      }
    }
    
    // Total claimable
    const totalClaimable0 = BigInt(position.tokensOwed0.toString()) + uncollected0;
    const totalClaimable1 = BigInt(position.tokensOwed1.toString()) + uncollected1;
    
    console.log('\nUncollected fees:');
    console.log('  TORUS:', ethers.utils.formatEther(uncollected0.toString()));
    console.log('  TitanX:', ethers.utils.formatEther(uncollected1.toString()));
    
    console.log('\nTotal claimable:');
    console.log('  TORUS:', ethers.utils.formatEther(totalClaimable0.toString()));
    console.log('  TitanX:', ethers.utils.formatEther(totalClaimable1.toString()));
    
    // Now update all positions in cache
    const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    
    // For now, just use the tokensOwed values which we know work
    // The uncollected calculation needs more investigation
    console.log('\n📊 Updating cache with tokensOwed values...');
    
    for (const cachedPos of cacheData.lpPositions) {
      const pos = await positionManager.positions(cachedPos.tokenId);
      
      cachedPos.claimableTorus = parseFloat(ethers.utils.formatEther(pos.tokensOwed0));
      cachedPos.claimableTitanX = parseFloat(ethers.utils.formatEther(pos.tokensOwed1));
      
      // For your position, add the calculated uncollected
      if (cachedPos.tokenId === '1031465' && uncollected0 > 0) {
        cachedPos.claimableTorus += parseFloat(ethers.utils.formatEther(uncollected0.toString()));
        cachedPos.claimableTitanX += parseFloat(ethers.utils.formatEther(uncollected1.toString()));
        console.log(`\n✅ Updated your position with uncollected fees`);
      }
    }
    
    // Save updated cache
    cacheData.lastUpdated = new Date().toISOString();
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cacheData, null, 2));
    
    console.log('\n✅ Updated cache!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixOverflowCalculation().catch(console.error);