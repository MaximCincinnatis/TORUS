const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';

// Pool ABI for fee calculation
const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function feeGrowthGlobal0X128() view returns (uint256)',
  'function feeGrowthGlobal1X128() view returns (uint256)',
  'function ticks(int24 tick) view returns (uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int128 liquidityGross, int128 liquidityNet, uint56 secondsPerLiquidityOutsideX128, uint160 secondsOutside, bool initialized)'
];

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
];

const Q128 = 2n ** 128n;
const MAX_UINT256 = 2n ** 256n;

// Helper to handle subtraction with underflow (Uniswap V3 style)
function subIn256(a, b) {
  const diff = a - b;
  if (diff < 0n) {
    return MAX_UINT256 + diff;
  }
  return diff;
}

async function calculateV3Fees(tokenId) {
  const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
  const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  
  console.log(`\nCalculating fees for position ${tokenId}...`);
  
  // Get position data
  const position = await positionManager.positions(tokenId);
  const liquidity = BigInt(position.liquidity.toString());
  const tickLower = Number(position.tickLower);
  const tickUpper = Number(position.tickUpper);
  const feeGrowthInside0Last = BigInt(position.feeGrowthInside0LastX128.toString());
  const feeGrowthInside1Last = BigInt(position.feeGrowthInside1LastX128.toString());
  const tokensOwed0 = BigInt(position.tokensOwed0.toString());
  const tokensOwed1 = BigInt(position.tokensOwed1.toString());
  
  console.log(`Liquidity: ${liquidity.toString()}`);
  console.log(`Ticks: ${tickLower} to ${tickUpper}`);
  console.log(`Current tokensOwed0: ${tokensOwed0.toString()}`);
  console.log(`Current tokensOwed1: ${tokensOwed1.toString()}`);
  
  if (liquidity === 0n) {
    console.log('Position has 0 liquidity - fees should already be in tokensOwed');
    const torus = Number(tokensOwed0) / 1e18;
    const titanx = Number(tokensOwed1) / 1e18;
    console.log(`Claimable TORUS: ${torus.toFixed(6)}`);
    console.log(`Claimable TitanX: ${titanx.toFixed(2)} (${(titanx / 1e6).toFixed(2)}M)`);
    return;
  }
  
  // Get current pool state
  const [slot0, feeGrowthGlobal0, feeGrowthGlobal1] = await Promise.all([
    pool.slot0(),
    pool.feeGrowthGlobal0X128(),
    pool.feeGrowthGlobal1X128()
  ]);
  
  const currentTick = Number(slot0.tick);
  console.log(`Current pool tick: ${currentTick}`);
  
  // Get tick data
  const [lowerTick, upperTick] = await Promise.all([
    pool.ticks(tickLower),
    pool.ticks(tickUpper)
  ]);
  
  // Calculate fee growth inside position's range
  let feeGrowthInside0, feeGrowthInside1;
  
  // Fee growth below
  let feeGrowthBelow0, feeGrowthBelow1;
  if (currentTick >= tickLower) {
    feeGrowthBelow0 = BigInt(lowerTick.feeGrowthOutside0X128.toString());
    feeGrowthBelow1 = BigInt(lowerTick.feeGrowthOutside1X128.toString());
  } else {
    feeGrowthBelow0 = subIn256(BigInt(feeGrowthGlobal0.toString()), BigInt(lowerTick.feeGrowthOutside0X128.toString()));
    feeGrowthBelow1 = subIn256(BigInt(feeGrowthGlobal1.toString()), BigInt(lowerTick.feeGrowthOutside1X128.toString()));
  }
  
  // Fee growth above
  let feeGrowthAbove0, feeGrowthAbove1;
  if (currentTick < tickUpper) {
    feeGrowthAbove0 = BigInt(upperTick.feeGrowthOutside0X128.toString());
    feeGrowthAbove1 = BigInt(upperTick.feeGrowthOutside1X128.toString());
  } else {
    feeGrowthAbove0 = subIn256(BigInt(feeGrowthGlobal0.toString()), BigInt(upperTick.feeGrowthOutside0X128.toString()));
    feeGrowthAbove1 = subIn256(BigInt(feeGrowthGlobal1.toString()), BigInt(upperTick.feeGrowthOutside1X128.toString()));
  }
  
  // Calculate current fee growth inside
  feeGrowthInside0 = subIn256(subIn256(BigInt(feeGrowthGlobal0.toString()), feeGrowthBelow0), feeGrowthAbove0);
  feeGrowthInside1 = subIn256(subIn256(BigInt(feeGrowthGlobal1.toString()), feeGrowthBelow1), feeGrowthAbove1);
  
  console.log(`\nFee growth calculations:`);
  console.log(`feeGrowthInside0: ${feeGrowthInside0.toString()}`);
  console.log(`feeGrowthInside1: ${feeGrowthInside1.toString()}`);
  console.log(`feeGrowthInside0Last: ${feeGrowthInside0Last.toString()}`);
  console.log(`feeGrowthInside1Last: ${feeGrowthInside1Last.toString()}`);
  
  // Calculate uncollected fees
  let uncollectedFees0 = 0n;
  let uncollectedFees1 = 0n;
  
  const feeGrowthDelta0 = subIn256(feeGrowthInside0, feeGrowthInside0Last);
  const feeGrowthDelta1 = subIn256(feeGrowthInside1, feeGrowthInside1Last);
  
  uncollectedFees0 = (liquidity * feeGrowthDelta0) / Q128;
  uncollectedFees1 = (liquidity * feeGrowthDelta1) / Q128;
  
  console.log(`\nFee growth deltas:`);
  console.log(`Delta0: ${feeGrowthDelta0.toString()}`);
  console.log(`Delta1: ${feeGrowthDelta1.toString()}`);
  
  // Total claimable = tokensOwed + uncollected
  const totalClaimable0 = tokensOwed0 + uncollectedFees0;
  const totalClaimable1 = tokensOwed1 + uncollectedFees1;
  
  const torus = Number(totalClaimable0) / 1e18;
  const titanx = Number(totalClaimable1) / 1e18;
  
  console.log(`\n✅ TOTAL CLAIMABLE:`);
  console.log(`TORUS: ${torus.toFixed(6)}`);
  console.log(`TitanX: ${titanx.toFixed(2)} (${(titanx / 1e6).toFixed(2)}M)`);
  
  if (titanx > 38000000 && titanx < 40000000 && torus > 0.7 && torus < 0.8) {
    console.log(`\n🎯 FOUND IT! This matches the 39M TitanX and 0.763 TORUS!`);
  }
}

async function main() {
  console.log('Testing proper V3 fee calculation for all positions...');
  
  await calculateV3Fees('1029236');
  await calculateV3Fees('1030051');
  await calculateV3Fees('1031465');
}

main().catch(console.error);