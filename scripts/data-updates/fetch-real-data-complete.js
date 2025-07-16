// Fetch REAL data from blockchain - no mocks, only actual contract data
const { ethers } = require('ethers');
const fs = require('fs');

// Working RPC providers
const WORKING_RPC_PROVIDERS = [
  'https://eth.drpc.org',
  'https://rpc.payload.de',
  'https://eth-mainnet.public.blastapi.io',
  'https://rpc.flashbots.net',
  'https://eth-mainnet.nodereal.io/v1/REDACTED_API_KEY'
];

// Contract addresses
const TORUS_ADDRESS = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
const TITANX_ADDRESS = '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1';
const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';

// ABIs
const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function liquidity() view returns (uint128)',
  'function fee() view returns (uint24)',
  'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)'
];

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)'
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)'
];

const CREATE_STAKE_ABI = [
  'function currentProtocolDay() view returns (uint256)',
  'function rewardPoolSupply() view returns (uint256)',
  'function getRewardPoolData(uint256 startDay, uint256 endDay) view returns (tuple(uint256 torusAmount, uint256 totalTorusAmount)[])'
];

async function getWorkingProvider() {
  for (const rpcUrl of WORKING_RPC_PROVIDERS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 3000);
      });
      const blockNumber = await Promise.race([provider.getBlockNumber(), timeoutPromise]);
      console.log(`✅ Connected to ${rpcUrl} - Block: ${blockNumber}`);
      return provider;
    } catch (error) {
      console.log(`❌ Failed ${rpcUrl}: ${error.message}`);
    }
  }
  throw new Error('All RPC providers failed');
}

// Calculate tick to price (TITANX per TORUS)
function tickToPrice(tick) {
  return Math.pow(1.0001, tick);
}

async function fetchRealData() {
  console.log('🔄 FETCHING REAL BLOCKCHAIN DATA - NO MOCKS');
  console.log('==========================================');
  
  try {
    const provider = await getWorkingProvider();
    const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
    
    console.log('\n📊 1. FETCHING UNISWAP V3 POOL DATA...');
    
    const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
    const [slot0, liquidity, token0, token1, fee] = await Promise.all([
      poolContract.slot0(),
      poolContract.liquidity(),
      poolContract.token0(),
      poolContract.token1(),
      poolContract.fee()
    ]);
    
    // Get real balances
    const torusContract = new ethers.Contract(TORUS_ADDRESS, ERC20_ABI, provider);
    const titanxContract = new ethers.Contract(TITANX_ADDRESS, ERC20_ABI, provider);
    
    const [torusBalance, titanxBalance] = await Promise.all([
      torusContract.balanceOf(POOL_ADDRESS),
      titanxContract.balanceOf(POOL_ADDRESS)
    ]);
    
    const torusInPool = parseFloat(ethers.utils.formatEther(torusBalance));
    const titanxInPool = parseFloat(ethers.utils.formatEther(titanxBalance));
    const titanxPerTorus = titanxInPool / torusInPool;
    
    console.log(`✅ Pool has ${torusInPool.toFixed(2)} TORUS and ${(titanxInPool / 1e12).toFixed(2)}T TITANX`);
    console.log(`✅ Current ratio: 1 TORUS = ${(titanxPerTorus / 1e6).toFixed(2)}M TITANX`);
    
    // Update Uniswap data
    cachedData.uniswapV3 = {
      poolAddress: POOL_ADDRESS,
      torusAddress: TORUS_ADDRESS,
      titanxAddress: TITANX_ADDRESS,
      poolData: {
        sqrtPriceX96: slot0.sqrtPriceX96.toString(),
        currentTick: slot0.tick,
        liquidity: liquidity.toString(),
        fee: fee,
        token0: token0,
        token1: token1
      },
      ratio: {
        titanxPerTorus: titanxPerTorus.toFixed(2),
        titanxPerTorusM: (titanxPerTorus / 1e6).toFixed(2),
        torusPerTitanx: (1 / titanxPerTorus).toFixed(8)
      },
      tvl: {
        torusAmount: torusInPool.toFixed(2),
        titanxAmount: (titanxInPool / 1e12).toFixed(2) + 'T',
        titanxAmountRaw: titanxInPool.toFixed(2)
      }
    };
    
    console.log('\n💎 2. FETCHING LP POSITIONS...');
    
    const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    const startBlock = currentBlock - 10000; // RPC limit
    
    // Get Mint events to find positions
    const mintFilter = poolContract.filters.Mint();
    const mintEvents = await poolContract.queryFilter(mintFilter, startBlock, currentBlock);
    console.log(`Found ${mintEvents.length} Mint events`);
    
    const lpPositions = [];
    const processedTokenIds = new Set();
    
    // Process recent mints
    for (let i = 0; i < Math.min(mintEvents.length, 50); i++) {
      const mintEvent = mintEvents[i];
      if (!mintEvent.args) continue;
      
      const blockNumber = mintEvent.blockNumber;
      
      // Find IncreaseLiquidity events near this mint
      try {
        const increaseLiquidityFilter = positionManager.filters.IncreaseLiquidity();
        const events = await positionManager.queryFilter(
          increaseLiquidityFilter, 
          blockNumber - 2, 
          blockNumber + 2
        );
        
        for (const event of events) {
          if (!event.args) continue;
          const tokenId = event.args.tokenId.toString();
          
          if (processedTokenIds.has(tokenId)) continue;
          processedTokenIds.add(tokenId);
          
          try {
            const [position, owner] = await Promise.all([
              positionManager.positions(tokenId),
              positionManager.ownerOf(tokenId)
            ]);
            
            // Check if this is our TORUS/TITANX pool
            const isTORUSPool = (
              position.token0.toLowerCase() === TORUS_ADDRESS.toLowerCase() &&
              position.token1.toLowerCase() === TITANX_ADDRESS.toLowerCase()
            );
            
            if (isTORUSPool && position.liquidity.gt(0)) {
              const lowerPrice = tickToPrice(position.tickLower);
              const upperPrice = tickToPrice(position.tickUpper);
              const currentPrice = tickToPrice(slot0.tick);
              
              lpPositions.push({
                tokenId: tokenId,
                owner: owner,
                liquidity: position.liquidity.toString(),
                tickLower: position.tickLower,
                tickUpper: position.tickUpper,
                lowerTitanxPerTorus: (lowerPrice / 1e6).toFixed(2) + 'M',
                upperTitanxPerTorus: (upperPrice / 1e6).toFixed(2) + 'M',
                currentTitanxPerTorus: (currentPrice / 1e6).toFixed(2) + 'M',
                tokensOwed0: position.tokensOwed0.toString(),
                tokensOwed1: position.tokensOwed1.toString(),
                fee: position.fee,
                inRange: position.tickLower <= slot0.tick && slot0.tick <= position.tickUpper
              });
              console.log(`✅ Found LP position ${tokenId} owned by ${owner.substring(0, 10)}...`);
            }
          } catch (e) {
            // Position might not exist
          }
        }
      } catch (e) {
        // Continue with next mint
      }
    }
    
    // Also try known token IDs
    const knownTokenIds = ['780889', '797216', '798833', '831419', '831420'];
    for (const tokenId of knownTokenIds) {
      if (processedTokenIds.has(tokenId)) continue;
      
      try {
        const [position, owner] = await Promise.all([
          positionManager.positions(tokenId),
          positionManager.ownerOf(tokenId)
        ]);
        
        const isTORUSPool = (
          position.token0.toLowerCase() === TORUS_ADDRESS.toLowerCase() &&
          position.token1.toLowerCase() === TITANX_ADDRESS.toLowerCase()
        );
        
        if (isTORUSPool && position.liquidity.gt(0)) {
          const lowerPrice = tickToPrice(position.tickLower);
          const upperPrice = tickToPrice(position.tickUpper);
          const currentPrice = tickToPrice(slot0.tick);
          
          lpPositions.push({
            tokenId: tokenId,
            owner: owner,
            liquidity: position.liquidity.toString(),
            tickLower: position.tickLower,
            tickUpper: position.tickUpper,
            lowerTitanxPerTorus: (lowerPrice / 1e6).toFixed(2) + 'M',
            upperTitanxPerTorus: (upperPrice / 1e6).toFixed(2) + 'M',
            currentTitanxPerTorus: (currentPrice / 1e6).toFixed(2) + 'M',
            tokensOwed0: position.tokensOwed0.toString(),
            tokensOwed1: position.tokensOwed1.toString(),
            fee: position.fee,
            inRange: position.tickLower <= slot0.tick && slot0.tick <= position.tickUpper
          });
          console.log(`✅ Found known LP position ${tokenId}`);
        }
      } catch (e) {
        // Token doesn't exist
      }
    }
    
    cachedData.uniswapV3.lpPositions = lpPositions;
    console.log(`✅ Total LP positions found: ${lpPositions.length}`);
    
    console.log('\n🎁 3. FETCHING REAL REWARD POOL DATA...');
    
    const stakeContract = new ethers.Contract(CREATE_STAKE_CONTRACT, CREATE_STAKE_ABI, provider);
    
    try {
      const currentDay = await stakeContract.currentProtocolDay();
      const rewardSupply = await stakeContract.rewardPoolSupply();
      
      console.log(`Current protocol day: ${currentDay}`);
      console.log(`Reward pool supply: ${ethers.utils.formatEther(rewardSupply)} TORUS`);
      
      // Get reward data for next 89 days
      const rewardData = await stakeContract.getRewardPoolData(currentDay, currentDay + 89);
      
      const rewardPoolData = rewardData.map((data, index) => ({
        day: currentDay.toNumber() + index,
        torusAmount: parseFloat(ethers.utils.formatEther(data.torusAmount)),
        totalTorusAmount: parseFloat(ethers.utils.formatEther(data.totalTorusAmount))
      }));
      
      cachedData.rewardPoolData = rewardPoolData;
      console.log(`✅ Fetched reward data for ${rewardPoolData.length} days`);
      
    } catch (e) {
      console.log('⚠️  Could not fetch reward pool data:', e.message);
      // Keep existing reward data if fetch fails
    }
    
    // Update metadata
    cachedData.lastUpdated = new Date().toISOString();
    cachedData.metadata = cachedData.metadata || {};
    cachedData.metadata.lastRealDataUpdate = new Date().toISOString();
    cachedData.metadata.hasRealData = true;
    cachedData.metadata.lpPositionsFound = lpPositions.length;
    
    // Save updated data
    fs.writeFileSync('public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
    
    console.log('\n✅ REAL DATA UPDATE COMPLETE');
    console.log('📊 Summary:');
    console.log(`  - Pool ratio: 1 TORUS = ${(titanxPerTorus / 1e6).toFixed(2)}M TITANX`);
    console.log(`  - LP positions: ${lpPositions.length}`);
    console.log(`  - TitanX chart data: ${cachedData.chartData?.titanXUsageByEndDate?.length || 0} dates`);
    console.log('🔄 Refresh localhost to see real data!');
    
  } catch (error) {
    console.error('❌ Error fetching real data:', error);
  }
}

fetchRealData();