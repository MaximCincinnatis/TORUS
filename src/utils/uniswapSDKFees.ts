import { ethers } from 'ethers';
import { Position, Pool } from '@uniswap/v3-sdk';
import { Token, CurrencyAmount } from '@uniswap/sdk-core';
import { getProvider } from './ethersWeb3';

const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';

const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() view returns (uint128)',
  'function fee() view returns (uint24)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function feeGrowthGlobal0X128() view returns (uint256)',
  'function feeGrowthGlobal1X128() view returns (uint256)',
  'function ticks(int24 tick) view returns (uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int128 liquidityGross, int128 liquidityNet, uint56 secondsPerLiquidityOutsideX128, uint160 secondsOutside, bool initialized)'
];

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
];

// Create Token instances for TORUS and TitanX
const TORUS = new Token(1, '0xB47f575807fC5466285e1277Ef8aCFBB5c6686E8', 18, 'TORUS', 'TORUS');
const TITANX = new Token(1, '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1', 18, 'TITANX', 'TitanX');

export async function calculateFeesWithUniswapSDK(tokenId: string) {
  const provider = getProvider() as ethers.providers.JsonRpcProvider;
  const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
  const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  
  try {
    // Get position data
    const position = await positionManager.positions(tokenId);
    
    // Get pool data
    const [slot0, liquidity, fee, feeGrowthGlobal0, feeGrowthGlobal1] = await Promise.all([
      poolContract.slot0(),
      poolContract.liquidity(),
      poolContract.fee(),
      poolContract.feeGrowthGlobal0X128(),
      poolContract.feeGrowthGlobal1X128()
    ]);
    
    // Get tick data
    const [lowerTick, upperTick] = await Promise.all([
      poolContract.ticks(position.tickLower),
      poolContract.ticks(position.tickUpper)
    ]);
    
    // Create Pool instance
    const pool = new Pool(
      TORUS,
      TITANX,
      fee,
      slot0.sqrtPriceX96.toString(),
      liquidity.toString(),
      Number(slot0.tick)
    );
    
    // Create Position instance
    const sdkPosition = new Position({
      pool,
      liquidity: position.liquidity.toString(),
      tickLower: Number(position.tickLower),
      tickUpper: Number(position.tickUpper)
    });
    
    // Calculate token amounts
    const amount0 = sdkPosition.amount0;
    const amount1 = sdkPosition.amount1;
    
    // Calculate fees - this is the complex part
    // The SDK doesn't directly expose fee calculation, but we can use the position data
    
    // For now, return the position amounts and tokensOwed
    const result = {
      tokenId,
      owner: position.operator,
      liquidity: position.liquidity.toString(),
      amount0: amount0.toExact(),
      amount1: amount1.toExact(),
      tokensOwed0: ethers.utils.formatUnits(position.tokensOwed0, 18),
      tokensOwed1: ethers.utils.formatUnits(position.tokensOwed1, 18),
      inRange: sdkPosition.tickLower <= pool.tickCurrent && pool.tickCurrent < sdkPosition.tickUpper
    };
    
    console.log('Position data from Uniswap SDK:', result);
    return result;
    
  } catch (error) {
    console.error('Error calculating with Uniswap SDK:', error);
    throw error;
  }
}