import { ethers } from 'ethers';
import { getProvider } from './ethersWeb3';

// Uniswap V3 Pool ABI for fee calculation
const POOL_ABI = [
  'function feeGrowthGlobal0X128() view returns (uint256)',
  'function feeGrowthGlobal1X128() view returns (uint256)',
  'function ticks(int24 tick) view returns (uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int128 liquidityGross, int128 liquidityNet, uint56 secondsPerLiquidityOutsideX128, uint160 secondsOutside, bool initialized)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'
];

const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
const Q128 = BigInt(2) ** BigInt(128);

export async function calculateUnclaimedFees(position: any, tokenId: string) {
  const provider = getProvider();
  const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
  
  console.log(`\n💰 Calculating REAL unclaimed fees for token ${tokenId}...`);
  
  try {
    // Get current pool state
    const [slot0, feeGrowthGlobal0, feeGrowthGlobal1] = await Promise.all([
      pool.slot0(),
      pool.feeGrowthGlobal0X128(),
      pool.feeGrowthGlobal1X128()
    ]);
    
    const currentTick = Number(slot0.tick);
    const tickLower = Number(position.tickLower);
    const tickUpper = Number(position.tickUpper);
    
    console.log(`  Current tick: ${currentTick}`);
    console.log(`  Position range: ${tickLower} to ${tickUpper}`);
    console.log(`  Liquidity: ${position.liquidity.toString()}`);
    
    // Get tick data
    const [tickLowerData, tickUpperData] = await Promise.all([
      pool.ticks(tickLower),
      pool.ticks(tickUpper)
    ]);
    
    console.log(`  Global fee growth 0: ${feeGrowthGlobal0.toString()}`);
    console.log(`  Global fee growth 1: ${feeGrowthGlobal1.toString()}`);
    
    // Calculate fee growth inside the position's range
    let feeGrowthInside0 = BigInt(0);
    let feeGrowthInside1 = BigInt(0);
    
    // Fee growth below
    let feeGrowthBelow0 = BigInt(tickLowerData.feeGrowthOutside0X128);
    let feeGrowthBelow1 = BigInt(tickLowerData.feeGrowthOutside1X128);
    
    if (currentTick >= tickLower) {
      feeGrowthBelow0 = BigInt(tickLowerData.feeGrowthOutside0X128);
      feeGrowthBelow1 = BigInt(tickLowerData.feeGrowthOutside1X128);
    } else {
      feeGrowthBelow0 = BigInt(feeGrowthGlobal0) - BigInt(tickLowerData.feeGrowthOutside0X128);
      feeGrowthBelow1 = BigInt(feeGrowthGlobal1) - BigInt(tickLowerData.feeGrowthOutside1X128);
    }
    
    // Fee growth above
    let feeGrowthAbove0 = BigInt(0);
    let feeGrowthAbove1 = BigInt(0);
    
    if (currentTick < tickUpper) {
      feeGrowthAbove0 = BigInt(tickUpperData.feeGrowthOutside0X128);
      feeGrowthAbove1 = BigInt(tickUpperData.feeGrowthOutside1X128);
    } else {
      feeGrowthAbove0 = BigInt(feeGrowthGlobal0) - BigInt(tickUpperData.feeGrowthOutside0X128);
      feeGrowthAbove1 = BigInt(feeGrowthGlobal1) - BigInt(tickUpperData.feeGrowthOutside1X128);
    }
    
    // Calculate fee growth inside
    feeGrowthInside0 = BigInt(feeGrowthGlobal0) - feeGrowthBelow0 - feeGrowthAbove0;
    feeGrowthInside1 = BigInt(feeGrowthGlobal1) - feeGrowthBelow1 - feeGrowthAbove1;
    
    console.log(`  Fee growth inside 0: ${feeGrowthInside0.toString()}`);
    console.log(`  Fee growth inside 1: ${feeGrowthInside1.toString()}`);
    
    // Calculate uncollected fees
    const feeGrowthInside0Last = BigInt(position.feeGrowthInside0LastX128);
    const feeGrowthInside1Last = BigInt(position.feeGrowthInside1LastX128);
    
    const liquidity = BigInt(position.liquidity);
    
    let tokensOwed0 = BigInt(position.tokensOwed0);
    let tokensOwed1 = BigInt(position.tokensOwed1);
    
    // Add uncollected fees
    if (feeGrowthInside0 > feeGrowthInside0Last) {
      const feeGrowthDelta0 = feeGrowthInside0 - feeGrowthInside0Last;
      const uncollectedFees0 = (liquidity * feeGrowthDelta0) / Q128;
      tokensOwed0 += uncollectedFees0;
      console.log(`  Uncollected fees 0: ${uncollectedFees0.toString()}`);
    }
    
    if (feeGrowthInside1 > feeGrowthInside1Last) {
      const feeGrowthDelta1 = feeGrowthInside1 - feeGrowthInside1Last;
      const uncollectedFees1 = (liquidity * feeGrowthDelta1) / Q128;
      tokensOwed1 += uncollectedFees1;
      console.log(`  Uncollected fees 1: ${uncollectedFees1.toString()}`);
    }
    
    // Convert to decimal
    const totalOwed0 = Number(tokensOwed0) / 1e18;
    const totalOwed1 = Number(tokensOwed1) / 1e18;
    
    console.log(`  TOTAL claimable TORUS: ${totalOwed0.toFixed(6)}`);
    console.log(`  TOTAL claimable TitanX: ${totalOwed1.toFixed(2)} (${(totalOwed1 / 1e6).toFixed(2)}M)`);
    
    return {
      claimableTorus: totalOwed0,
      claimableTitanX: totalOwed1,
      tokensOwed0: tokensOwed0.toString(),
      tokensOwed1: tokensOwed1.toString()
    };
    
  } catch (error) {
    console.error('Error calculating fees:', error);
    return {
      claimableTorus: 0,
      claimableTitanX: 0,
      tokensOwed0: '0',
      tokensOwed1: '0'
    };
  }
}