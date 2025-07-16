const { ethers } = require('ethers');

const CONTRACTS = {
  TORUS: '0xb47f575807fc5466285e1277ef8acfbb5c6686e8',
  TITANX: '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1',
  POOL: '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F',
  NFT_POSITION_MANAGER: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
};

const POOL_CREATION_BLOCK = 22890272; // Found from previous script

const POOL_ABI = [
  'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)'
];

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)'
];

async function findTORUSPositionsFromCreation() {
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const poolContract = new ethers.Contract(CONTRACTS.POOL, POOL_ABI, provider);
  const positionManager = new ethers.Contract(CONTRACTS.NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  
  console.log('🔍 Finding TORUS LP positions from pool creation forward...\n');
  
  const currentBlock = await provider.getBlockNumber();
  console.log(`Pool created at block: ${POOL_CREATION_BLOCK}`);
  console.log(`Current block: ${currentBlock}`);
  console.log(`Total blocks to search: ${currentBlock - POOL_CREATION_BLOCK}\n`);
  
  const foundPositions = [];
  const processedTokenIds = new Set();
  
  // Search in 5k block chunks (RPC free tier limit)
  const chunkSize = 5000;
  
  for (let startBlock = POOL_CREATION_BLOCK; startBlock < currentBlock; startBlock += chunkSize) {
    const endBlock = Math.min(startBlock + chunkSize, currentBlock);
    const progress = ((startBlock - POOL_CREATION_BLOCK) / (currentBlock - POOL_CREATION_BLOCK) * 100).toFixed(1);
    
    console.log(`📊 Searching blocks ${startBlock} to ${endBlock} (${progress}% complete)...`);
    
    try {
      // Method 1: Search Mint events in the pool
      const mintFilter = poolContract.filters.Mint();
      const mintEvents = await poolContract.queryFilter(mintFilter, startBlock, endBlock);
      
      if (mintEvents.length > 0) {
        console.log(`  Found ${mintEvents.length} Mint events in this range`);
        
        // For each Mint event, try to find the corresponding NFT position
        for (const mintEvent of mintEvents) {
          if (!mintEvent.args) continue;
          
          const { owner, tickLower, tickUpper } = mintEvent.args;
          console.log(`    Mint by ${owner.substring(0, 10)}... at ticks ${tickLower}-${tickUpper}`);
          
          // Search for IncreaseLiquidity events around the same time to find token ID
          const searchStart = Math.max(mintEvent.blockNumber - 2, startBlock);
          const searchEnd = Math.min(mintEvent.blockNumber + 2, endBlock);
          
          try {
            const increaseFilter = positionManager.filters.IncreaseLiquidity();
            const increaseEvents = await positionManager.queryFilter(increaseFilter, searchStart, searchEnd);
            
            for (const incEvent of increaseEvents) {
              if (!incEvent.args) continue;
              
              const tokenId = incEvent.args.tokenId.toString();
              if (processedTokenIds.has(tokenId)) continue;
              
              try {
                const [position, positionOwner] = await Promise.all([
                  positionManager.positions(tokenId),
                  positionManager.ownerOf(tokenId)
                ]);
                
                // Verify this is TORUS pool and ticks match
                const isTORUSPool = (
                  position.token0.toLowerCase() === CONTRACTS.TORUS.toLowerCase() &&
                  position.token1.toLowerCase() === CONTRACTS.TITANX.toLowerCase()
                );
                
                const ticksMatch = (position.tickLower === tickLower && position.tickUpper === tickUpper);
                
                if (isTORUSPool && ticksMatch && position.liquidity.gt(0)) {
                  processedTokenIds.add(tokenId);
                  
                  const positionData = {
                    tokenId,
                    owner: positionOwner,
                    liquidity: ethers.utils.formatEther(position.liquidity),
                    tickLower: position.tickLower,
                    tickUpper: position.tickUpper,
                    tokensOwed0: ethers.utils.formatEther(position.tokensOwed0),
                    tokensOwed1: ethers.utils.formatEther(position.tokensOwed1),
                    mintBlock: mintEvent.blockNumber
                  };
                  
                  foundPositions.push(positionData);
                  
                  console.log(`    ✅ FOUND TORUS POSITION!`);
                  console.log(`       Token ID: ${tokenId}`);
                  console.log(`       Owner: ${positionOwner}`);
                  console.log(`       Liquidity: ${positionData.liquidity}`);
                  console.log(`       Created at block: ${mintEvent.blockNumber}`);
                  console.log('');
                }
              } catch (posError) {
                // Position might not exist or not readable
                continue;
              }
            }
          } catch (incError) {
            // IncreaseLiquidity search failed, continue
            continue;
          }
        }
      }
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.log(`  ❌ Error searching blocks ${startBlock}-${endBlock}: ${error.message}`);
      continue;
    }
  }
  
  console.log(`\n🎯 SEARCH COMPLETE!`);
  console.log(`Found ${foundPositions.length} active TORUS LP positions:\n`);
  
  foundPositions.forEach((pos, i) => {
    console.log(`${i + 1}. Token ID: ${pos.tokenId}`);
    console.log(`   Owner: ${pos.owner}`);
    console.log(`   Liquidity: ${pos.liquidity}`);
    console.log(`   Tick Range: ${pos.tickLower} to ${pos.tickUpper}`);
    console.log(`   Tokens Owed: ${pos.tokensOwed0} TORUS, ${pos.tokensOwed1} TitanX`);
    console.log(`   Created: Block ${pos.mintBlock}`);
    console.log('');
  });
  
  // Show unique owners
  const uniqueOwners = [...new Set(foundPositions.map(p => p.owner))];
  console.log(`📊 Summary:`);
  console.log(`   Total positions found: ${foundPositions.length}`);
  console.log(`   Unique owners: ${uniqueOwners.length}`);
  console.log(`   Search range: ${currentBlock - POOL_CREATION_BLOCK} blocks`);
  
  console.log(`\n👥 Position owners:`);
  uniqueOwners.forEach((owner, i) => {
    const ownerPositions = foundPositions.filter(p => p.owner === owner);
    console.log(`   ${i + 1}. ${owner} (${ownerPositions.length} position${ownerPositions.length > 1 ? 's' : ''})`);
  });
  
  return foundPositions;
}

findTORUSPositionsFromCreation().catch(console.error);