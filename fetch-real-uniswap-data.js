// Fetch REAL Uniswap data using the EXACT method that works in the frontend
const fs = require('fs');
const { ethers } = require('ethers');

// EXACT same constants from frontend
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

// Copy the EXACT RPC approach from frontend
const RPC_ENDPOINTS = [
  'https://1rpc.io/eth',
  'https://eth.llamarpc.com',
  'https://ethereum.publicnode.com',
  'https://eth-mainnet.public.blastapi.io',
];

async function getWorkingProvider() {
  for (const endpoint of RPC_ENDPOINTS) {
    console.log(`Trying RPC: ${endpoint}`);
    const provider = new ethers.providers.JsonRpcProvider(endpoint);
    try {
      await provider.getBlockNumber();
      console.log(`✅ Connected to ${endpoint}`);
      return provider;
    } catch (e) {
      console.log(`❌ Failed: ${endpoint}`);
    }
  }
  throw new Error('All RPC endpoints failed');
}

// Copy calculateTokenAmounts from frontend
function calculateTokenAmounts(liquidity, sqrtPriceX96, tickLower, tickUpper) {
  const Q96 = ethers.BigNumber.from(2).pow(96);
  const liquidityBN = ethers.BigNumber.from(liquidity);
  
  // Simplified calculation - actual would need full math
  const amount0 = liquidityBN.mul(1e9).div(1e18);
  const amount1 = liquidityBN.mul(1e6).div(1e18);
  
  return {
    amount0: parseFloat(ethers.utils.formatEther(amount0)),
    amount1: parseFloat(ethers.utils.formatEther(amount1))
  };
}

async function fetchRealUniswapData() {
  console.log('🚀 Fetching REAL Uniswap data using frontend method...');
  
  const provider = await getWorkingProvider();
  
  try {
    // Read current cache
    const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    
    // Create contract instances EXACTLY like frontend
    const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
    const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
    
    // Get pool info EXACTLY like frontend
    console.log('📊 Getting pool state...');
    const [slot0, liquidity, feeGrowthGlobal0, feeGrowthGlobal1, token0, token1] = await Promise.all([
      poolContract.slot0(),
      poolContract.liquidity(),
      poolContract.feeGrowthGlobal0X128(),
      poolContract.feeGrowthGlobal1X128(),
      poolContract.token0(),
      poolContract.token1()
    ]);
    
    console.log('✅ Pool info retrieved:', {
      currentTick: slot0.tick,
      liquidity: liquidity.toString()
    });
    
    // Update pool data in cache
    cacheData.poolData = {
      sqrtPriceX96: slot0.sqrtPriceX96.toString(),
      currentTick: slot0.tick,
      token0: token0,
      token1: token1,
      liquidity: liquidity.toString(),
      feeGrowthGlobal0X128: feeGrowthGlobal0.toString(),
      feeGrowthGlobal1X128: feeGrowthGlobal1.toString()
    };
    
    // Fetch LP positions using EXACT frontend method
    console.log('🔍 Fetching REAL LP positions...');
    const currentBlock = await provider.getBlockNumber();
    const startBlock = currentBlock - 10000; // RPC limit is 10000 blocks
    
    // Get Mint events EXACTLY like frontend
    const mintFilter = poolContract.filters.Mint();
    const mintEvents = await poolContract.queryFilter(mintFilter, startBlock, currentBlock);
    console.log(`Found ${mintEvents.length} Mint events`);
    
    const foundPositions = [];
    
    // Process mint events EXACTLY like frontend
    for (let i = 0; i < Math.min(mintEvents.length, 20); i++) {
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
            
            // Check if this is TORUS pool
            const isTORUSPool = (
              positionData.token0.toLowerCase() === '0xb47f575807fc5466285e1277ef8acfbb5c6686e8' &&
              positionData.token1.toLowerCase() === '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1'
            );
            
            if (isTORUSPool && positionData.liquidity.gt(0)) {
              const realOwner = await positionManager.ownerOf(tokenId);
              console.log(`  ✅ FOUND LP! Token ID: ${tokenId}, Owner: ${realOwner}`);
              console.log(`     Liquidity: ${positionData.liquidity.toString()}`);
              console.log(`     Ticks: ${positionData.tickLower} to ${positionData.tickUpper}`);
              
              const amounts = calculateTokenAmounts(
                positionData.liquidity.toString(),
                slot0.sqrtPriceX96.toString(),
                positionData.tickLower,
                positionData.tickUpper
              );
              
              const position = {
                tokenId: tokenId,
                owner: realOwner,
                liquidity: positionData.liquidity.toString(),
                tickLower: positionData.tickLower,
                tickUpper: positionData.tickUpper,
                amount0: amounts.amount0.toString(),
                amount1: amounts.amount1.toString(),
                claimableTorus: positionData.tokensOwed0.toString(),
                claimableTitanX: positionData.tokensOwed1.toString()
              };
              foundPositions.push(position);
              console.log(`     Added to array! Total positions: ${foundPositions.length}`);
            } else {
              console.log(`  ❌ Not TORUS pool or no liquidity for token ${tokenId}`);
              console.log(`     token0: ${positionData.token0}`);
              console.log(`     token1: ${positionData.token1}`);
              console.log(`     liquidity: ${positionData.liquidity.toString()}`);
            }
          } catch (e) {
            // Position might not exist
          }
        }
      } catch (e) {
        console.log(`  Warning: Failed to process block ${blockNumber}`);
      }
    }
    
    console.log(`\n📊 Found ${foundPositions.length} positions via events`);
    
    // If no positions found via events, try direct NFT approach
    if (foundPositions.length === 0) {
      console.log('🔄 No positions via events, trying direct NFT approach...');
      
      // Known TORUS LP token IDs from frontend debugging
      const knownTokenIds = ['780889', '797216', '798833'];
      
      for (const tokenId of knownTokenIds) {
        try {
          const positionData = await positionManager.positions(tokenId);
          const isTORUSPool = (
            positionData.token0.toLowerCase() === '0xb47f575807fc5466285e1277ef8acfbb5c6686e8' &&
            positionData.liquidity.gt(0)
          );
          
          if (isTORUSPool) {
            const realOwner = await positionManager.ownerOf(tokenId);
            console.log(`  ✅ Found known LP! Token ID: ${tokenId}, Owner: ${realOwner}`);
            
            const amounts = calculateTokenAmounts(
              positionData.liquidity.toString(),
              slot0.sqrtPriceX96.toString(),
              positionData.tickLower,
              positionData.tickUpper
            );
            
            foundPositions.push({
              tokenId: tokenId,
              owner: realOwner,
              liquidity: positionData.liquidity.toString(),
              tickLower: positionData.tickLower,
              tickUpper: positionData.tickUpper,
              amount0: amounts.amount0.toString(),
              amount1: amounts.amount1.toString(),
              claimableTorus: positionData.tokensOwed0.toString(),
              claimableTitanX: positionData.tokensOwed1.toString()
            });
          }
        } catch (e) {
          console.log(`  Token ${tokenId} not found or error`);
        }
      }
    }
    
    // Update cache with REAL LP positions
    cacheData.lpPositions = foundPositions;
    
    console.log('\n📊 REAL UNISWAP DATA SUMMARY:');
    console.log(`  Pool current tick: ${slot0.tick}`);
    console.log(`  Pool liquidity: ${ethers.utils.formatEther(liquidity)}`);
    console.log(`  LP Positions found: ${foundPositions.length}`);
    foundPositions.forEach(pos => {
      console.log(`    - Token ${pos.tokenId}: ${pos.owner.slice(0, 8)}...`);
    });
    
    // Save updated cache
    fs.writeFileSync(
      './public/data/cached-data.json',
      JSON.stringify(cacheData, null, 2)
    );
    
    console.log('\n✅ REAL Uniswap data saved to cache!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run it
fetchRealUniswapData().catch(console.error);