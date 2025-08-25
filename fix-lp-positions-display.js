#!/usr/bin/env node

/**
 * ============================================================================
 * STATUS: 🟡 UTILITY - LP Position Fix Script
 * ============================================================================
 * CREATED: 2025-08-25
 * 
 * PURPOSE:
 * Fixes LP position display issue by ensuring all required fields are populated.
 * The position exists in data but is missing calculated amounts.
 * 
 * ISSUE IDENTIFIED:
 * - LP position 1030759 exists in cached-data.json
 * - Missing: amount0, amount1, claimableFees fields
 * - These fields need to be calculated from on-chain data
 * ============================================================================
 */

const { ethers } = require('ethers');
const fs = require('fs');

// Configuration
const CACHE_FILE = './public/data/cached-data.json';
const CONTRACTS = {
  POOL: '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F',
  NFT_POSITION_MANAGER: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
};

// Working RPC providers
const RPC_PROVIDERS = [
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.payload.de'
];

async function getProvider() {
  for (const rpc of RPC_PROVIDERS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpc);
      await provider.getBlockNumber();
      console.log(`✅ Connected to ${rpc}`);
      return provider;
    } catch (e) {
      console.log(`❌ Failed to connect to ${rpc}`);
    }
  }
  throw new Error('No working RPC provider found');
}

function calculatePositionAmounts(position, sqrtPriceX96, currentTick) {
  const liquidity = position.liquidity.toString();
  const tickLower = position.tickLower;
  const tickUpper = position.tickUpper;
  
  // Use BigInt for precision
  const liquidityBN = BigInt(liquidity);
  const sqrtPrice = BigInt(sqrtPriceX96.toString());
  const Q96 = BigInt(2) ** BigInt(96);
  
  // Calculate sqrt prices for the tick range
  const priceLower = Math.pow(1.0001, tickLower);
  const priceUpper = Math.pow(1.0001, tickUpper);
  
  const sqrtPriceLowerFloat = Math.sqrt(priceLower) * Math.pow(2, 96);
  const sqrtPriceUpperFloat = Math.sqrt(priceUpper) * Math.pow(2, 96);
  
  const sqrtPriceLower = BigInt(Math.floor(sqrtPriceLowerFloat));
  const sqrtPriceUpper = BigInt(Math.floor(sqrtPriceUpperFloat));
  
  let amount0 = BigInt(0);
  let amount1 = BigInt(0);
  
  // Calculate based on current price position
  if (sqrtPrice <= sqrtPriceLower) {
    // Current price is below the range, all liquidity is in token0 (TORUS)
    amount0 = (liquidityBN * (sqrtPriceUpper - sqrtPriceLower) * Q96) / 
      (sqrtPriceUpper * sqrtPriceLower);
  } else if (sqrtPrice < sqrtPriceUpper) {
    // Current price is within the range
    amount0 = (liquidityBN * (sqrtPriceUpper - sqrtPrice) * Q96) / 
      (sqrtPriceUpper * sqrtPrice);
    amount1 = (liquidityBN * (sqrtPrice - sqrtPriceLower)) / Q96;
  } else {
    // Current price is above the range, all liquidity is in token1 (WETH)
    amount1 = (liquidityBN * (sqrtPriceUpper - sqrtPriceLower)) / Q96;
  }
  
  // Convert to decimal values
  const decimals0 = BigInt(10) ** BigInt(18);
  const decimals1 = BigInt(10) ** BigInt(18);
  
  const decimal0 = Number(amount0) / Number(decimals0);
  const decimal1 = Number(amount1) / Number(decimals1);
  
  return {
    amount0: decimal0,
    amount1: decimal1
  };
}

async function fixLPPositions() {
  console.log('🔧 Fixing LP Position Display Issue\n');
  console.log('=' .repeat(60));
  
  // Load cached data
  const cachedData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  
  if (!cachedData.lpPositions || cachedData.lpPositions.length === 0) {
    console.log('❌ No LP positions found in cached data');
    return;
  }
  
  console.log(`\n📊 Found ${cachedData.lpPositions.length} LP position(s)\n`);
  
  // Get provider
  const provider = await getProvider();
  
  // Get current pool state
  const poolABI = [
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)'
  ];
  const pool = new ethers.Contract(CONTRACTS.POOL, poolABI, provider);
  const slot0 = await pool.slot0();
  
  console.log('Current Pool State:');
  console.log(`  Tick: ${slot0.tick}`);
  console.log(`  SqrtPriceX96: ${slot0.sqrtPriceX96.toString()}\n`);
  
  // Position Manager ABI
  const positionManagerABI = [
    'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
    'function ownerOf(uint256 tokenId) view returns (address)'
  ];
  
  const positionManager = new ethers.Contract(CONTRACTS.NFT_POSITION_MANAGER, positionManagerABI, provider);
  
  // Fix each position
  for (let i = 0; i < cachedData.lpPositions.length; i++) {
    const position = cachedData.lpPositions[i];
    console.log(`\nProcessing Position ${position.tokenId}:`);
    console.log(`  Current Owner: ${position.owner}`);
    console.log(`  Liquidity: ${position.liquidity}`);
    
    try {
      // Get current position data from chain
      const [currentPosition, owner] = await Promise.all([
        positionManager.positions(position.tokenId),
        positionManager.ownerOf(position.tokenId).catch(() => null)
      ]);
      
      if (!owner) {
        console.log(`  ⚠️ Position no longer exists or has been burned`);
        continue;
      }
      
      // Update position data
      position.owner = owner;
      position.liquidity = currentPosition.liquidity.toString();
      position.tickLower = currentPosition.tickLower;
      position.tickUpper = currentPosition.tickUpper;
      position.tokensOwed0 = currentPosition.tokensOwed0.toString();
      position.tokensOwed1 = currentPosition.tokensOwed1.toString();
      
      // Calculate amounts
      const amounts = calculatePositionAmounts(
        currentPosition,
        slot0.sqrtPriceX96,
        slot0.tick
      );
      
      position.amount0 = amounts.amount0;
      position.amount1 = amounts.amount1;
      
      // Add calculated values
      position.torusAmount = amounts.amount0;
      position.wethAmount = amounts.amount1;
      
      // Calculate USD values (approximate)
      const wethPrice = 3200; // Approximate ETH price
      const torusPrice = position.amount1 > 0 ? (position.amount1 * wethPrice) / position.amount0 : 0;
      
      position.torusValue = position.amount0 * torusPrice;
      position.wethValue = position.amount1 * wethPrice;
      position.totalValue = position.torusValue + position.wethValue;
      
      // Add claimable fees (simplified - actual calculation would need more data)
      position.claimableFees = {
        torus: parseFloat(position.tokensOwed0) / 1e18,
        weth: parseFloat(position.tokensOwed1) / 1e18
      };
      
      position.lastUpdated = new Date().toISOString();
      
      console.log(`  ✅ Updated successfully`);
      console.log(`     TORUS: ${position.amount0.toFixed(2)}`);
      console.log(`     WETH: ${position.amount1.toFixed(4)}`);
      console.log(`     Total Value: $${position.totalValue.toFixed(2)}`);
      
    } catch (error) {
      console.log(`  ❌ Error updating position: ${error.message}`);
    }
  }
  
  // Update pool data
  cachedData.poolData = cachedData.poolData || {};
  cachedData.poolData.currentTick = slot0.tick;
  cachedData.poolData.sqrtPriceX96 = slot0.sqrtPriceX96.toString();
  cachedData.poolData.lastUpdated = new Date().toISOString();
  
  // Also update in uniswapV3 section
  if (cachedData.uniswapV3) {
    cachedData.uniswapV3.lpPositions = cachedData.lpPositions;
    cachedData.uniswapV3.poolData = cachedData.poolData;
  }
  
  // Save updated data
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cachedData, null, 2));
  
  console.log('\n' + '=' .repeat(60));
  console.log('\n✅ LP positions fixed and saved to cached-data.json');
  console.log('\n📝 Summary:');
  console.log(`  - Updated ${cachedData.lpPositions.length} position(s)`);
  console.log(`  - Added amount0 (TORUS) and amount1 (WETH) fields`);
  console.log(`  - Added USD value calculations`);
  console.log(`  - Updated pool data`);
  
  console.log('\n🎯 Next Steps:');
  console.log('1. The dashboard should now show LP positions correctly');
  console.log('2. Monitor the next auto-update to ensure fields persist');
  console.log('3. If issue persists, check frontend component for display logic');
}

// Run the fix
fixLPPositions().catch(console.error);