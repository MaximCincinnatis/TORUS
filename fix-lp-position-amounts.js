#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');

const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';

const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
];

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
];

// Calculate position amounts using Uniswap V3 math
function getAmounts(liquidity, sqrtPriceX96, tickLower, tickUpper, currentTick) {
  const Q96 = ethers.BigNumber.from(2).pow(96);
  
  // Convert ticks to sqrt prices
  function getSqrtPriceAtTick(tick) {
    const sqrtPrice = Math.pow(1.0001, tick / 2);
    return ethers.BigNumber.from(Math.floor(sqrtPrice * Math.pow(2, 96)));
  }
  
  const sqrtPriceLower = getSqrtPriceAtTick(tickLower);
  const sqrtPriceUpper = getSqrtPriceAtTick(tickUpper);
  const liquidityBN = ethers.BigNumber.from(liquidity);
  
  let amount0 = ethers.BigNumber.from(0);
  let amount1 = ethers.BigNumber.from(0);
  
  if (currentTick < tickLower) {
    // All liquidity is in token0
    amount0 = liquidityBN.mul(Q96).mul(sqrtPriceUpper.sub(sqrtPriceLower))
      .div(sqrtPriceUpper).div(sqrtPriceLower);
  } else if (currentTick >= tickUpper) {
    // All liquidity is in token1
    amount1 = liquidityBN.mul(sqrtPriceUpper.sub(sqrtPriceLower)).div(Q96);
  } else {
    // Liquidity is split between tokens
    amount0 = liquidityBN.mul(Q96).mul(sqrtPriceUpper.sub(sqrtPriceX96))
      .div(sqrtPriceUpper).div(sqrtPriceX96);
    amount1 = liquidityBN.mul(sqrtPriceX96.sub(sqrtPriceLower)).div(Q96);
  }
  
  return { amount0, amount1 };
}

async function fixLPAmounts() {
  console.log('🔧 Fixing LP position amounts...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
  const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  
  // Load cached data
  const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
  
  // Get current pool state
  const slot0 = await poolContract.slot0();
  const currentTick = slot0.tick;
  const sqrtPriceX96 = slot0.sqrtPriceX96;
  
  console.log(`Current pool tick: ${currentTick}`);
  console.log(`Current sqrt price: ${sqrtPriceX96.toString()}\n`);
  
  // Fix each LP position
  for (let i = 0; i < cacheData.lpPositions.length; i++) {
    const position = cacheData.lpPositions[i];
    console.log(`Fixing position ${position.tokenId}...`);
    
    try {
      // Get current position data
      const positionData = await positionManager.positions(position.tokenId);
      
      // Calculate amounts
      const { amount0, amount1 } = getAmounts(
        position.liquidity,
        sqrtPriceX96,
        position.tickLower,
        position.tickUpper,
        currentTick
      );
      
      // Convert to readable format
      const torusAmount = parseFloat(ethers.utils.formatEther(amount0));
      const titanXAmount = parseFloat(ethers.utils.formatEther(amount1));
      
      console.log(`  TORUS: ${torusAmount.toFixed(2)}`);
      console.log(`  TitanX: ${titanXAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
      
      // Update position data
      cacheData.lpPositions[i].amount0 = torusAmount;
      cacheData.lpPositions[i].amount1 = titanXAmount;
      
      // Also update claimable amounts
      const claimableTorus = parseFloat(ethers.utils.formatEther(positionData.tokensOwed0));
      const claimableTitanX = parseFloat(ethers.utils.formatEther(positionData.tokensOwed1));
      
      cacheData.lpPositions[i].claimableTorus = claimableTorus;
      cacheData.lpPositions[i].claimableTitanX = claimableTitanX;
      cacheData.lpPositions[i].tokensOwed0 = positionData.tokensOwed0.toString();
      cacheData.lpPositions[i].tokensOwed1 = positionData.tokensOwed1.toString();
      
      console.log(`  Claimable TORUS: ${claimableTorus.toFixed(6)}`);
      console.log(`  Claimable TitanX: ${claimableTitanX.toLocaleString('en-US', { maximumFractionDigits: 2 })}\n`);
      
    } catch (e) {
      console.log(`  Error: ${e.message}\n`);
    }
  }
  
  // Save updated data
  cacheData.lastUpdated = new Date().toISOString();
  fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cacheData, null, 2));
  
  console.log('✅ LP position amounts fixed!');
}

fixLPAmounts().catch(console.error);