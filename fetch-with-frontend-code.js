// This script mimics EXACTLY what the frontend does
const fs = require('fs');
const { ethers } = require('ethers');

// Copy ALL constants and setup from frontend
const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';

const POOL_ABI = [
  'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function liquidity() view returns (uint128)',
  'function feeGrowthGlobal0X128() view returns (uint256)',
  'function feeGrowthGlobal1X128() view returns (uint256)'
];

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
];

// RPC setup exactly like frontend
const RPC_ENDPOINTS = [
  'https://ethereum.publicnode.com',
  'https://1rpc.io/eth',
  'https://eth.llamarpc.com',
  'https://eth-mainnet.public.blastapi.io',
];

let currentRpcIndex = 0;
let provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[currentRpcIndex]);

// Copy the math functions from frontend
function calculateTokenAmounts(liquidity, sqrtPriceX96, tickLower, tickUpper, decimals0 = 18, decimals1 = 18) {
  const Q96 = ethers.BigNumber.from(2).pow(96);
  const liquidityBN = ethers.BigNumber.from(liquidity);
  
  // Calculate sqrt prices for the tick range
  const sqrtPriceLower = tickToSqrtPriceX96(tickLower);
  const sqrtPriceUpper = tickToSqrtPriceX96(tickUpper);
  const currentSqrtPrice = ethers.BigNumber.from(sqrtPriceX96);
  
  let amount0, amount1;
  
  if (currentSqrtPrice.lt(sqrtPriceLower)) {
    // Current price is below the range (all in token0)
    amount0 = liquidityBN.mul(sqrtPriceUpper.sub(sqrtPriceLower)).div(sqrtPriceUpper).div(sqrtPriceLower).mul(Q96);
    amount1 = ethers.BigNumber.from(0);
  } else if (currentSqrtPrice.gt(sqrtPriceUpper)) {
    // Current price is above the range (all in token1)
    amount0 = ethers.BigNumber.from(0);
    amount1 = liquidityBN.mul(sqrtPriceUpper.sub(sqrtPriceLower));
  } else {
    // Current price is within the range
    amount0 = liquidityBN.mul(sqrtPriceUpper.sub(currentSqrtPrice)).div(sqrtPriceUpper).div(currentSqrtPrice).mul(Q96);
    amount1 = liquidityBN.mul(currentSqrtPrice.sub(sqrtPriceLower));
  }
  
  // Convert to decimals
  const amount0Decimal = parseFloat(ethers.utils.formatUnits(amount0, decimals0));
  const amount1Decimal = parseFloat(ethers.utils.formatUnits(amount1, decimals1));
  
  return { amount0: amount0Decimal, amount1: amount1Decimal };
}

function tickToSqrtPriceX96(tick) {
  // Use a more robust calculation to avoid overflow
  const sqrtPrice = Math.pow(1.0001, tick / 2);
  const Q96 = ethers.BigNumber.from(2).pow(96);
  
  // Break down the calculation to avoid JavaScript number overflow
  if (sqrtPrice > Number.MAX_SAFE_INTEGER / Math.pow(2, 96)) {
    // For very large values, use string manipulation
    const sqrtPriceScaled = sqrtPrice * 1e18;
    const result = ethers.BigNumber.from(sqrtPriceScaled.toFixed(0)).mul(Q96).div(ethers.BigNumber.from(10).pow(18));
    return result;
  }
  
  return ethers.BigNumber.from(Math.floor(sqrtPrice * Math.pow(2, 96)));
}

function isPositionInRange(currentTick, tickLower, tickUpper) {
  return currentTick >= tickLower && currentTick <= tickUpper;
}

async function getPoolInfo() {
  const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
  
  const [slot0, token0Address, token1Address, liquidity, feeGrowth0, feeGrowth1] = await Promise.all([
    poolContract.slot0(),
    poolContract.token0(),
    poolContract.token1(),
    poolContract.liquidity(),
    poolContract.feeGrowthGlobal0X128(),
    poolContract.feeGrowthGlobal1X128()
  ]);
  
  return {
    sqrtPriceX96: slot0.sqrtPriceX96.toString(),
    currentTick: slot0.tick,
    token0: token0Address,
    token1: token1Address,
    liquidity: liquidity.toString(),
    feeGrowthGlobal0X128: feeGrowth0.toString(),
    feeGrowthGlobal1X128: feeGrowth1.toString()
  };
}

// EXACT copy of fetchLPPositionsFromEvents
async function fetchLPPositionsFromEvents() {
  const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
  const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  
  try {
    console.log('🔍 Fetching REAL individual LP position owners...');
    
    const poolInfo = await getPoolInfo();
    console.log('✅ Pool info retrieved:', { currentTick: poolInfo.currentTick });
    
    const currentBlock = await provider.getBlockNumber();
    const startBlock = currentBlock - 10000; // RPC limit
    
    console.log(`Searching from block ${startBlock} to ${currentBlock}`);
    
    // Get Mint events
    const mintFilter = poolContract.filters.Mint();
    const mintEvents = await poolContract.queryFilter(mintFilter, startBlock, currentBlock);
    console.log(`Found ${mintEvents.length} Mint events`);
    
    const foundPositions = new Map();
    
    // Process each mint event
    for (let i = 0; i < Math.min(mintEvents.length, 15); i++) {
      const mintEvent = mintEvents[i];
      if (!mintEvent.args) continue;
      
      const blockNumber = mintEvent.blockNumber;
      console.log(`Processing Mint ${i + 1} from block ${blockNumber}`);
      
      // Find IncreaseLiquidity events nearby
      const searchFromBlock = blockNumber - 2;
      const searchToBlock = blockNumber + 2;
      
      try {
        const increaseLiquidityFilter = positionManager.filters.IncreaseLiquidity();
        const increaseLiquidityEvents = await positionManager.queryFilter(
          increaseLiquidityFilter, 
          searchFromBlock, 
          searchToBlock
        );
        
        for (const incEvent of increaseLiquidityEvents) {
          if (!incEvent.args) continue;
          
          const tokenId = incEvent.args.tokenId.toString();
          
          try {
            const positionData = await positionManager.positions(tokenId);
            
            // Check if this NFT position is for our TORUS pool
            const isTORUSPool = (
              (positionData.token0.toLowerCase() === '0xb47f575807fc5466285e1277ef8acfbb5c6686e8') && // TORUS
              (positionData.token1.toLowerCase() === '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1')    // TitanX
            );
            
            // Check if tick ranges match
            const ticksMatch = (
              positionData.tickLower === mintEvent.args.tickLower &&
              positionData.tickUpper === mintEvent.args.tickUpper
            );
            
            console.log(`    Checking position ${tokenId}:`);
            console.log(`      Is TORUS pool: ${isTORUSPool}`);
            console.log(`      Has liquidity: ${positionData.liquidity.gt(0)}`);
            console.log(`      Ticks match: ${ticksMatch} (${positionData.tickLower} vs ${mintEvent.args.tickLower}, ${positionData.tickUpper} vs ${mintEvent.args.tickUpper})`);
            
            if (isTORUSPool && positionData.liquidity.gt(0)) {
              const realOwner = await positionManager.ownerOf(tokenId);
              console.log(`  ✅ FOUND INDIVIDUAL LP HOLDER!`);
              console.log(`    Token ID: ${tokenId}`);
              console.log(`    Real Owner: ${realOwner}`);
              console.log(`    Liquidity: ${positionData.liquidity.toString()}`);
              
              try {
                // Calculate token amounts
                const amounts = calculateTokenAmounts(
                positionData.liquidity.toString(),
                poolInfo.sqrtPriceX96,
                positionData.tickLower,
                positionData.tickUpper,
                18, 18
              );
              
              // Calculate claimable fees
              const claimableTorus = parseFloat(ethers.utils.formatEther(positionData.tokensOwed0));
              const claimableTitanX = parseFloat(ethers.utils.formatEther(positionData.tokensOwed1));
              
              // Estimate APR
              const positionValueTORUS = amounts.amount0 + (amounts.amount1 * 0.00001);
              const totalClaimableTORUS = claimableTorus + (claimableTitanX * 0.00001);
              const weeklyYieldRate = positionValueTORUS > 0 ? totalClaimableTORUS / positionValueTORUS : 0;
              const estimatedAPR = weeklyYieldRate * 52 * 100;
              
              const position = {
                owner: realOwner,
                tokenId,
                liquidity: positionData.liquidity.toString(),
                tickLower: Number(positionData.tickLower),
                tickUpper: Number(positionData.tickUpper),
                amount0: amounts.amount0,
                amount1: amounts.amount1,
                inRange: isPositionInRange(poolInfo.currentTick, positionData.tickLower, positionData.tickUpper),
                claimableTorus,
                claimableTitanX,
                estimatedAPR
              };
              
                foundPositions.set(tokenId, position);
                console.log(`    ✅ Added to Map! Total positions now: ${foundPositions.size}`);
              } catch (calcError) {
                console.error(`    ❌ Calculation error:`, calcError.message);
                // Still add with basic info
                foundPositions.set(tokenId, {
                  owner: realOwner,
                  tokenId,
                  liquidity: positionData.liquidity.toString(),
                  tickLower: Number(positionData.tickLower),
                  tickUpper: Number(positionData.tickUpper),
                  amount0: 0,
                  amount1: 0,
                  inRange: false,
                  claimableTorus: 0,
                  claimableTitanX: 0,
                  estimatedAPR: 0
                });
                console.log(`    ✅ Added basic position to Map! Total: ${foundPositions.size}`);
              }
            }
          } catch (error) {
            // Position might not exist
          }
        }
      } catch (error) {
        // Skip blocks we can't read
      }
    }
    
    const positions = Array.from(foundPositions.values());
    console.log(`\n🎯 FOUND ${positions.length} REAL LP POSITIONS!`);
    
    return positions;
    
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
}

// Run it
async function main() {
  console.log('🚀 Running EXACT frontend code to fetch LP positions...');
  
  const positions = await fetchLPPositionsFromEvents();
  const poolInfo = await getPoolInfo();
  
  // Update cache
  const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
  
  cacheData.lpPositions = positions;
  cacheData.poolData = poolInfo;
  
  console.log('\n📊 RESULTS:');
  console.log(`  Total positions: ${positions.length}`);
  console.log(`  In-range: ${positions.filter(p => p.inRange).length}`);
  console.log(`  Out-of-range: ${positions.filter(p => !p.inRange).length}`);
  console.log(`  With claimable fees: ${positions.filter(p => p.claimableTorus > 0 || p.claimableTitanX > 0).length}`);
  
  positions.forEach((pos, i) => {
    console.log(`\n  Position ${i + 1}:`);
    console.log(`    Owner: ${pos.owner}`);
    console.log(`    In Range: ${pos.inRange ? '✅' : '❌'}`);
    console.log(`    TORUS: ${pos.amount0.toFixed(2)}`);
    console.log(`    TitanX: ${pos.amount1.toFixed(2)}`);
    if (pos.claimableTorus > 0 || pos.claimableTitanX > 0) {
      console.log(`    Claimable: ${pos.claimableTorus.toFixed(4)} TORUS, ${pos.claimableTitanX.toFixed(2)} TitanX`);
    }
    console.log(`    APR: ${pos.estimatedAPR.toFixed(2)}%`);
  });
  
  fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cacheData, null, 2));
  console.log('\n✅ Cache updated with REAL LP data!');
}

main().catch(console.error);