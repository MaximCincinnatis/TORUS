#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');

const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';

const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() view returns (uint128)',
];

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
];

// Uniswap V3 math for full range positions
function getFullRangeAmounts(liquidity, sqrtPriceX96) {
  const Q96 = ethers.BigNumber.from(2).pow(96);
  
  // For full range positions, we can use simplified math
  // amount1 = L * sqrtPrice / 2^96
  const liquidityBN = ethers.BigNumber.from(liquidity);
  const amount1 = liquidityBN.mul(sqrtPriceX96).div(Q96);
  
  // amount0 = L / sqrtPrice * 2^96
  const amount0 = liquidityBN.mul(Q96).div(sqrtPriceX96);
  
  return { amount0, amount1 };
}

async function getExactAmounts() {
  console.log('🔍 Getting EXACT amounts for position 1029195...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
  const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  
  try {
    // Get position data
    const position = await positionManager.positions('1029195');
    console.log('Position data:');
    console.log(`  Liquidity: ${position.liquidity.toString()}`);
    console.log(`  Tick range: ${position.tickLower} to ${position.tickUpper}`);
    console.log(`  Is full range: ${position.tickLower === -887200 && position.tickUpper === 887200}`);
    
    // Get current pool state
    const slot0 = await poolContract.slot0();
    const poolLiquidity = await poolContract.liquidity();
    
    console.log('\nPool state:');
    console.log(`  Current tick: ${slot0.tick}`);
    console.log(`  sqrt price: ${slot0.sqrtPriceX96.toString()}`);
    console.log(`  Total liquidity: ${poolLiquidity.toString()}`);
    
    // Calculate exact amounts
    const { amount0, amount1 } = getFullRangeAmounts(position.liquidity.toString(), slot0.sqrtPriceX96);
    
    // Convert to human readable
    const torusAmount = parseFloat(ethers.utils.formatEther(amount0));
    const titanXAmount = parseFloat(ethers.utils.formatEther(amount1));
    
    console.log('\n💎 EXACT AMOUNTS:');
    console.log(`  TORUS: ${torusAmount.toFixed(18)} (exactly)`);
    console.log(`  TitanX: ${titanXAmount.toFixed(2)}`);
    
    console.log('\n📊 Formatted:');
    console.log(`  TORUS: ${torusAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`  TitanX: ${(titanXAmount / 1e9).toFixed(2)}B`);
    
    // Also show claimable fees
    const claimableTorus = ethers.utils.formatEther(position.tokensOwed0);
    const claimableTitanX = ethers.utils.formatEther(position.tokensOwed1);
    
    console.log('\n💰 Claimable fees:');
    console.log(`  TORUS: ${parseFloat(claimableTorus).toFixed(6)}`);
    console.log(`  TitanX: ${(parseFloat(claimableTitanX) / 1e6).toFixed(2)}M`);
    
    // Update cache with exact amounts
    const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    const posIndex = cacheData.lpPositions.findIndex(p => p.tokenId === '1029195');
    
    if (posIndex !== -1) {
      cacheData.lpPositions[posIndex].amount0 = torusAmount;
      cacheData.lpPositions[posIndex].amount1 = titanXAmount;
      cacheData.lastUpdated = new Date().toISOString();
      
      fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cacheData, null, 2));
      console.log('\n✅ Cache updated with EXACT amounts!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

getExactAmounts().catch(console.error);