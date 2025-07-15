// Fetch ALL LP positions including out-of-range ones
const fs = require('fs');
const { ethers } = require('ethers');

const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';

const POOL_ABI = [
  'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() view returns (uint128)',
  'function feeGrowthGlobal0X128() view returns (uint256)',
  'function feeGrowthGlobal1X128() view returns (uint256)'
];

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
];

async function fetchAllLPPositions() {
  console.log('🚀 Fetching ALL LP positions (in-range and out-of-range)...');
  
  const provider = new ethers.providers.JsonRpcProvider('https://1rpc.io/eth');
  const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
  const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  
  try {
    // Get pool info
    const [slot0, liquidity, feeGrowth0, feeGrowth1] = await Promise.all([
      poolContract.slot0(),
      poolContract.liquidity(),
      poolContract.feeGrowthGlobal0X128(),
      poolContract.feeGrowthGlobal1X128()
    ]);
    
    const currentTick = slot0.tick;
    console.log('Pool current tick:', currentTick);
    
    // Get recent blocks
    const currentBlock = await provider.getBlockNumber();
    const deploymentBlock = 22890272; // TORUS deployment
    
    // Search in chunks to avoid timeout
    const uniquePositions = new Map();
    const chunkSize = 5000;
    let totalMints = 0;
    
    // Search from pool creation to catch the first LP position
    for (let fromBlock = deploymentBlock; fromBlock < currentBlock; fromBlock += chunkSize) {
      const toBlock = Math.min(fromBlock + chunkSize - 1, currentBlock);
      
      try {
        console.log(`Searching blocks ${fromBlock} to ${toBlock}...`);
        
        // Get mint events
        const mintFilter = poolContract.filters.Mint();
        const mintEvents = await poolContract.queryFilter(mintFilter, fromBlock, toBlock);
        totalMints += mintEvents.length;
        
        // Process each mint
        for (const mintEvent of mintEvents) {
          if (!mintEvent.args) continue;
          
          const blockNumber = mintEvent.blockNumber;
          
          // Find related NFT transfers
          try {
            const increaseLiquidityFilter = positionManager.filters.IncreaseLiquidity();
            const incEvents = await positionManager.queryFilter(
              increaseLiquidityFilter, 
              blockNumber - 5, 
              blockNumber + 5
            );
            
            for (const incEvent of incEvents) {
              if (!incEvent.args) continue;
              
              const tokenId = incEvent.args.tokenId.toString();
              
              try {
                const [position, owner] = await Promise.all([
                  positionManager.positions(tokenId),
                  positionManager.ownerOf(tokenId)
                ]);
                
                // Check if TORUS pool
                if (position.token0.toLowerCase() === '0xb47f575807fc5466285e1277ef8acfbb5c6686e8') {
                  
                  // Calculate position details
                  const liquidityNum = parseFloat(ethers.utils.formatEther(position.liquidity));
                  
                  // Check if in range
                  const inRange = currentTick >= position.tickLower && currentTick <= position.tickUpper;
                  
                  // Approximate amounts based on range
                  let amount0, amount1;
                  if (position.liquidity.eq(0)) {
                    amount0 = 0;
                    amount1 = 0;
                  } else if (currentTick < position.tickLower) {
                    // All in TORUS (token0)
                    amount0 = liquidityNum * 1.0;
                    amount1 = 0;
                  } else if (currentTick > position.tickUpper) {
                    // All in TitanX (token1)
                    amount0 = 0;
                    amount1 = liquidityNum * 50;
                  } else {
                    // In range - split
                    amount0 = liquidityNum * 0.5;
                    amount1 = liquidityNum * 25;
                  }
                  
                  const claimableTorus = parseFloat(ethers.utils.formatEther(position.tokensOwed0));
                  const claimableTitanX = parseFloat(ethers.utils.formatEther(position.tokensOwed1));
                  
                  // Only include active positions (has liquidity OR claimable fees)
                  if (position.liquidity.gt(0) || claimableTorus > 0 || claimableTitanX > 0) {
                    // APR estimate
                    const apr = amount0 > 0 && claimableTorus > 0 ? (claimableTorus / amount0) * 52 * 100 : 0;
                    
                    uniquePositions.set(tokenId, {
                      tokenId,
                      owner,
                      liquidity: position.liquidity.toString(),
                      tickLower: position.tickLower,
                      tickUpper: position.tickUpper,
                      amount0,
                      amount1,
                      inRange,
                      claimableTorus,
                      claimableTitanX,
                      estimatedAPR: Math.min(apr, 999)
                    });
                    
                    console.log(`  Found ${inRange ? 'IN-RANGE' : 'OUT-OF-RANGE'} position ${tokenId}`);
                  }
                }
              } catch (e) {
                // Skip
              }
            }
          } catch (e) {
            // Skip
          }
        }
      } catch (e) {
        console.log(`  Skipping block range due to error`);
      }
    }
    
    console.log(`\nTotal mint events found: ${totalMints}`);
    
    // Also try to find positions by Transfer events (wider search)
    console.log('\nSearching for positions via Transfer events...');
    try {
      const transferFilter = positionManager.filters.Transfer(null, null, null);
      const recentTransfers = await positionManager.queryFilter(transferFilter, currentBlock - 10000, currentBlock);
      
      console.log(`Found ${recentTransfers.length} recent transfers`);
      
      for (const transfer of recentTransfers.slice(0, 50)) { // Check first 50
        if (!transfer.args) continue;
        
        const tokenId = transfer.args.tokenId.toString();
        
        if (!uniquePositions.has(tokenId)) {
          try {
            const [position, owner] = await Promise.all([
              positionManager.positions(tokenId),
              positionManager.ownerOf(tokenId)
            ]);
            
            // Check if TORUS pool with liquidity
            if (position.token0.toLowerCase() === '0xb47f575807fc5466285e1277ef8acfbb5c6686e8' && 
                (position.liquidity.gt(0) || position.tokensOwed0.gt(0) || position.tokensOwed1.gt(0))) {
              
              const liquidityNum = parseFloat(ethers.utils.formatEther(position.liquidity));
              const inRange = currentTick >= position.tickLower && currentTick <= position.tickUpper;
              
              // Calculate amounts
              let amount0, amount1;
              if (currentTick < position.tickLower) {
                amount0 = liquidityNum * 1.0;
                amount1 = 0;
              } else if (currentTick > position.tickUpper) {
                amount0 = 0;
                amount1 = liquidityNum * 50;
              } else {
                amount0 = liquidityNum * 0.5;
                amount1 = liquidityNum * 25;
              }
              
              const claimableTorus = parseFloat(ethers.utils.formatEther(position.tokensOwed0));
              const claimableTitanX = parseFloat(ethers.utils.formatEther(position.tokensOwed1));
              
              // Only include active positions (has liquidity OR claimable fees)
              if (position.liquidity.gt(0) || claimableTorus > 0 || claimableTitanX > 0) {
                uniquePositions.set(tokenId, {
                  tokenId,
                  owner,
                  liquidity: position.liquidity.toString(),
                  tickLower: position.tickLower,
                  tickUpper: position.tickUpper,
                  amount0,
                  amount1,
                  inRange,
                  claimableTorus,
                  claimableTitanX,
                  estimatedAPR: 0
                });
                
                console.log(`  Found ${inRange ? 'IN-RANGE' : 'OUT-OF-RANGE'} position ${tokenId} via transfer`);
              }
            }
          } catch (e) {
            // Skip
          }
        }
      }
    } catch (e) {
      console.log('Transfer search failed');
    }
    
    const positions = Array.from(uniquePositions.values());
    
    // Update cache
    const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    
    cacheData.poolData = {
      sqrtPriceX96: slot0.sqrtPriceX96.toString(),
      currentTick: currentTick,
      token0: '0xB47f575807fC5466285e1277Ef8aCFBB5c6686E8',
      token1: '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1',
      liquidity: liquidity.toString(),
      feeGrowthGlobal0X128: feeGrowth0.toString(),
      feeGrowthGlobal1X128: feeGrowth1.toString()
    };
    
    cacheData.lpPositions = positions;
    
    console.log('\n📊 FINAL RESULTS:');
    console.log(`  Total LP positions: ${positions.length}`);
    console.log(`  In-range: ${positions.filter(p => p.inRange).length}`);
    console.log(`  Out-of-range: ${positions.filter(p => !p.inRange).length}`);
    console.log(`  With claimable fees: ${positions.filter(p => p.claimableTorus > 0 || p.claimableTitanX > 0).length}`);
    console.log(`  With zero liquidity but fees: ${positions.filter(p => p.liquidity === '0' && (p.claimableTorus > 0 || p.claimableTitanX > 0)).length}`);
    
    // Show details
    const inRangePositions = positions.filter(p => p.inRange);
    const outOfRangePositions = positions.filter(p => !p.inRange);
    
    console.log('\n🟢 IN-RANGE POSITIONS:');
    inRangePositions.forEach(pos => {
      console.log(`  Token ${pos.tokenId}: ${pos.owner.slice(0, 8)}... | TORUS: ${pos.amount0.toFixed(2)} | TitanX: ${pos.amount1.toFixed(2)}`);
    });
    
    console.log('\n🔴 OUT-OF-RANGE POSITIONS:');
    outOfRangePositions.forEach(pos => {
      console.log(`  Token ${pos.tokenId}: ${pos.owner.slice(0, 8)}... | Ticks: ${pos.tickLower} to ${pos.tickUpper} | Current: ${currentTick}`);
      if (pos.claimableTorus > 0 || pos.claimableTitanX > 0) {
        console.log(`    → Has fees: ${pos.claimableTorus.toFixed(4)} TORUS, ${pos.claimableTitanX.toFixed(2)} TitanX`);
      }
    });
    
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cacheData, null, 2));
    console.log('\n✅ Cache updated with ALL LP positions!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fetchAllLPPositions().catch(console.error);