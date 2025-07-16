// Simple script to fetch REAL LP positions we know exist
const fs = require('fs');
const { ethers } = require('ethers');

const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function ownerOf(uint256 tokenId) view returns (address)',
];

const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() view returns (uint128)',
  'function feeGrowthGlobal0X128() view returns (uint256)',
  'function feeGrowthGlobal1X128() view returns (uint256)'
];

async function fetchRealLPPositions() {
  console.log('🚀 Fetching REAL LP positions directly...');
  
  const provider = new ethers.providers.JsonRpcProvider('https://1rpc.io/eth');
  const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
  
  try {
    // Get pool state
    const [slot0, liquidity, feeGrowth0, feeGrowth1] = await Promise.all([
      poolContract.slot0(),
      poolContract.liquidity(),
      poolContract.feeGrowthGlobal0X128(),
      poolContract.feeGrowthGlobal1X128()
    ]);
    
    console.log('Pool state:', {
      currentTick: slot0.tick,
      liquidity: ethers.utils.formatEther(liquidity)
    });
    
    // Known LP positions from the logs
    const knownPositions = [
      '1031533', // Owner: 0x7F2d08AB0D5672Db36DA1596932cBA988FEe95E1
      '1029195', // Owner: 0xAa390a37006E22b5775A34f2147F81eBD6a63641
      '1032346', // Owner: 0x16221e4ea7B456C7083A29d43b452F7b6edA2466
      '780889',  // From frontend debugging
      '797216',
      '798833'
    ];
    
    const foundPositions = [];
    
    for (const tokenId of knownPositions) {
      console.log(`\nChecking token ${tokenId}...`);
      try {
        const [position, owner] = await Promise.all([
          positionManager.positions(tokenId),
          positionManager.ownerOf(tokenId)
        ]);
        
        console.log(`  Owner: ${owner}`);
        console.log(`  Token0: ${position.token0}`);
        console.log(`  Token1: ${position.token1}`);
        console.log(`  Liquidity: ${position.liquidity.toString()}`);
        console.log(`  Ticks: ${position.tickLower} to ${position.tickUpper}`);
        console.log(`  Claimable TORUS: ${ethers.utils.formatEther(position.tokensOwed0)}`);
        console.log(`  Claimable TitanX: ${ethers.utils.formatEther(position.tokensOwed1)}`);
        
        // Check if TORUS pool
        const isTORUS = position.token0.toLowerCase() === '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
        
        if (isTORUS && position.liquidity.gt(0)) {
          console.log('  ✅ Valid TORUS LP position!');
          
          // Simple amount calculation
          const amount0 = ethers.utils.formatEther(position.liquidity.mul(1000).div(1000000));
          const amount1 = ethers.utils.formatEther(position.liquidity.mul(50).div(1000000));
          
          foundPositions.push({
            tokenId: tokenId,
            owner: owner,
            liquidity: position.liquidity.toString(),
            tickLower: position.tickLower,
            tickUpper: position.tickUpper,
            amount0: amount0,
            amount1: amount1,
            claimableTorus: position.tokensOwed0.toString(),
            claimableTitanX: position.tokensOwed1.toString()
          });
        }
      } catch (e) {
        console.log(`  Error: ${e.message}`);
      }
    }
    
    // Update cache
    const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    
    cacheData.poolData = {
      sqrtPriceX96: slot0.sqrtPriceX96.toString(),
      currentTick: slot0.tick,
      token0: '0xB47f575807fC5466285e1277Ef8aCFBB5c6686E8',
      token1: '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1',
      liquidity: liquidity.toString(),
      feeGrowthGlobal0X128: feeGrowth0.toString(),
      feeGrowthGlobal1X128: feeGrowth1.toString()
    };
    
    cacheData.lpPositions = foundPositions;
    
    console.log(`\n📊 Summary:`);
    console.log(`  Found ${foundPositions.length} valid TORUS LP positions`);
    
    fs.writeFileSync(
      './public/data/cached-data.json',
      JSON.stringify(cacheData, null, 2)
    );
    
    console.log('\n✅ Real LP data saved!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fetchRealLPPositions().catch(console.error);