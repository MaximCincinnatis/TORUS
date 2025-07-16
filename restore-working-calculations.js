// Restore working claimable yield and APR calculations
const fs = require('fs');
const { ethers } = require('ethers');

const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';

const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function feeGrowthGlobal0X128() view returns (uint256)',
  'function feeGrowthGlobal1X128() view returns (uint256)',
  'function liquidity() view returns (uint128)'
];

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
];

// Use historical pool data from cache
const HISTORICAL_DATA = {
  sevenDay: {
    volumeUSD: 4406951,
    feesUSD: 13220,
    tvlUSD: 5544703,
    liquidity: "72038127163357528379469605"
  }
};

// Calculate position value in USD
function calculatePositionValueUSD(amount0, amount1) {
  const torusPrice = 0.00005; // $0.00005 per TORUS
  const titanXPrice = 0.0000002; // $200 per 1B TitanX
  return (amount0 * torusPrice) + (amount1 * titanXPrice);
}

// Calculate liquidity share
function calculateLiquidityShare(positionLiquidity, totalPoolLiquidity) {
  try {
    const posLiq = BigInt(positionLiquidity);
    const totalLiq = BigInt(totalPoolLiquidity);
    
    if (totalLiq === BigInt(0)) return 0;
    
    // Calculate share as percentage
    const sharePercent = Number(posLiq * BigInt(10000) / totalLiq) / 100;
    return Math.min(sharePercent, 100);
  } catch (error) {
    return 0;
  }
}

// Calculate APR based on pool volume
function calculateVolumeBasedAPR(position, poolLiquidity) {
  const positionValueUSD = calculatePositionValueUSD(position.amount0, position.amount1);
  
  if (positionValueUSD <= 0) return 0;
  
  // Use 7-day average data
  const avgDailyVolumeUSD = HISTORICAL_DATA.sevenDay.volumeUSD / 7;
  const avgTotalLiquidity = HISTORICAL_DATA.sevenDay.liquidity;
  
  // Calculate position's share of liquidity
  const liquidityShare = calculateLiquidityShare(position.liquidity, avgTotalLiquidity);
  
  // Fee tier is 0.3% (3000/1000000)
  const FEE_TIER = 3000;
  const dailyFeeIncome = avgDailyVolumeUSD * (FEE_TIER / 1000000) * (liquidityShare / 100);
  
  // Annualize
  const annualFeeIncome = dailyFeeIncome * 365;
  const apr = (annualFeeIncome / positionValueUSD) * 100;
  
  return Math.max(0, Math.min(apr, 999)); // Cap at 999%
}

// Calculate real-time APR from claimable fees
function calculateRealTimeAPR(claimableTorus, claimableTitanX, positionValueUSD, daysSinceLastCollection = 7) {
  if (positionValueUSD <= 0 || daysSinceLastCollection <= 0) {
    return 0;
  }
  
  // Convert claimable to USD
  const torusPrice = 0.00005;
  const titanXPrice = 0.0000002;
  const claimableUSD = (claimableTorus * torusPrice) + (claimableTitanX * titanXPrice);
  
  // Calculate daily yield rate
  const dailyYieldRate = claimableUSD / positionValueUSD / daysSinceLastCollection;
  
  // Annualize to get APR
  const apr = dailyYieldRate * 365 * 100;
  
  return Math.max(0, Math.min(apr, 999));
}

async function restoreWorkingCalculations() {
  console.log('🔧 Restoring working claimable yield and APR calculations...');
  
  const provider = new ethers.providers.JsonRpcProvider('https://1rpc.io/eth');
  const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
  const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  
  try {
    // Get current pool data
    const [slot0, poolLiquidity] = await Promise.all([
      pool.slot0(),
      pool.liquidity()
    ]);
    
    console.log('Current pool liquidity:', poolLiquidity.toString());
    
    // Load cached data
    const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    
    console.log('\n📊 Calculating for each position:');
    
    for (const cachedPos of cacheData.lpPositions) {
      try {
        // Get fresh position data for claimable fees
        const position = await positionManager.positions(cachedPos.tokenId);
        
        // Update claimable amounts
        const claimableTorus = parseFloat(ethers.utils.formatEther(position.tokensOwed0));
        const claimableTitanX = parseFloat(ethers.utils.formatEther(position.tokensOwed1));
        
        cachedPos.claimableTorus = claimableTorus;
        cachedPos.claimableTitanX = claimableTitanX;
        
        // Calculate position value
        const positionValueUSD = calculatePositionValueUSD(cachedPos.amount0, cachedPos.amount1);
        
        // Calculate APR using multiple methods
        let volumeAPR = 0;
        let realTimeAPR = 0;
        
        // Volume-based APR (from pool activity)
        if (cachedPos.inRange && BigInt(cachedPos.liquidity) > BigInt(0)) {
          volumeAPR = calculateVolumeBasedAPR(cachedPos, poolLiquidity.toString());
        }
        
        // Real-time APR (from actual claimable fees)
        if ((claimableTorus > 0 || claimableTitanX > 0) && positionValueUSD > 0) {
          realTimeAPR = calculateRealTimeAPR(claimableTorus, claimableTitanX, positionValueUSD);
        }
        
        // Use the higher of the two APRs (more optimistic)
        cachedPos.estimatedAPR = Math.max(volumeAPR, realTimeAPR);
        
        console.log(`\nPosition ${cachedPos.tokenId}:`);
        console.log(`  In Range: ${cachedPos.inRange ? '✅' : '❌'}`);
        console.log(`  Position Value: $${positionValueUSD.toFixed(2)}`);
        console.log(`  Claimable: ${claimableTorus.toFixed(4)} TORUS, ${claimableTitanX.toLocaleString('en-US', {maximumFractionDigits: 2})} TitanX`);
        console.log(`  Volume APR: ${volumeAPR.toFixed(2)}%`);
        console.log(`  Real-time APR: ${realTimeAPR.toFixed(2)}%`);
        console.log(`  Final APR: ${cachedPos.estimatedAPR.toFixed(2)}%`);
        
      } catch (e) {
        console.error(`Error processing position ${cachedPos.tokenId}:`, e.message);
      }
    }
    
    // Summary
    const totalClaimableTorus = cacheData.lpPositions.reduce((sum, p) => sum + (p.claimableTorus || 0), 0);
    const totalClaimableTitanX = cacheData.lpPositions.reduce((sum, p) => sum + (p.claimableTitanX || 0), 0);
    const avgAPR = cacheData.lpPositions.reduce((sum, p) => sum + (p.estimatedAPR || 0), 0) / cacheData.lpPositions.length;
    
    console.log('\n📊 Summary:');
    console.log(`Total claimable TORUS: ${totalClaimableTorus.toFixed(4)}`);
    console.log(`Total claimable TitanX: ${totalClaimableTitanX.toLocaleString('en-US')}`);
    console.log(`Average APR: ${avgAPR.toFixed(2)}%`);
    
    // Save updated cache
    cacheData.lastUpdated = new Date().toISOString();
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cacheData, null, 2));
    
    console.log('\n✅ Calculations restored!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

restoreWorkingCalculations().catch(console.error);