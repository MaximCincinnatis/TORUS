const { ethers } = require('ethers');

const CONTRACTS = {
  TORUS: '0xb47f575807fc5466285e1277ef8acfbb5c6686e8',
  TITANX: '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1',
  POOL: '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F',
  NFT_POSITION_MANAGER: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
};

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function tokenByIndex(uint256 index) view returns (uint256)'
];

async function findAllTORUSPositions() {
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const positionManager = new ethers.Contract(CONTRACTS.NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  
  console.log('🔍 Finding ALL TORUS LP positions using tokenByIndex method...\n');
  
  try {
    const totalSupply = await positionManager.totalSupply();
    console.log(`Total NFT positions: ${totalSupply.toString()}`);
    
    const foundPositions = [];
    const batchSize = 100; // Process in batches to avoid overwhelming the RPC
    
    // Start from recent positions and work backwards (more likely to find active ones)
    const startFromEnd = Math.max(0, totalSupply.toNumber() - 5000); // Check last 5k positions
    
    console.log(`Checking positions from index ${startFromEnd} to ${totalSupply.toNumber()}...`);
    
    for (let i = startFromEnd; i < totalSupply.toNumber(); i += batchSize) {
      const endIndex = Math.min(i + batchSize, totalSupply.toNumber());
      console.log(`📊 Processing batch ${i} to ${endIndex} (${((i / totalSupply.toNumber()) * 100).toFixed(1)}% complete)...`);
      
      // Process batch in parallel
      const batchPromises = [];
      for (let j = i; j < endIndex; j++) {
        batchPromises.push(checkPositionAtIndex(positionManager, j));
      }
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, idx) => {
        if (result.status === 'fulfilled' && result.value) {
          foundPositions.push(result.value);
          console.log(`✅ Found TORUS position at index ${i + idx}!`);
          console.log(`   Token ID: ${result.value.tokenId}`);
          console.log(`   Owner: ${result.value.owner}`);
          console.log(`   Liquidity: ${result.value.liquidity}`);
          console.log('');
        }
      });
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Stop if we found enough positions
      if (foundPositions.length >= 10) {
        console.log(`Found ${foundPositions.length} positions, stopping search...`);
        break;
      }
    }
    
    console.log(`\n🎯 FINAL RESULTS: Found ${foundPositions.length} active TORUS LP positions:`);
    foundPositions.forEach((pos, i) => {
      console.log(`${i + 1}. Token ID ${pos.tokenId} owned by ${pos.owner.substring(0, 12)}... (${pos.liquidity} liquidity)`);
    });
    
    return foundPositions;
    
  } catch (error) {
    console.error('❌ Error finding positions:', error);
    return [];
  }
}

async function checkPositionAtIndex(positionManager, index) {
  try {
    // Get token ID at this index
    const tokenId = await positionManager.tokenByIndex(index);
    
    // Get position data
    const [position, owner] = await Promise.all([
      positionManager.positions(tokenId),
      positionManager.ownerOf(tokenId)
    ]);
    
    // Check if this is a TORUS/TitanX position with active liquidity
    const isTORUSPool = (
      position.token0.toLowerCase() === CONTRACTS.TORUS.toLowerCase() &&
      position.token1.toLowerCase() === CONTRACTS.TITANX.toLowerCase()
    );
    
    if (isTORUSPool && position.liquidity.gt(0)) {
      return {
        index,
        tokenId: tokenId.toString(),
        owner,
        liquidity: ethers.utils.formatEther(position.liquidity),
        tickLower: position.tickLower,
        tickUpper: position.tickUpper,
        tokensOwed0: ethers.utils.formatEther(position.tokensOwed0),
        tokensOwed1: ethers.utils.formatEther(position.tokensOwed1)
      };
    }
    
    return null;
  } catch (error) {
    // Position doesn't exist or not readable
    return null;
  }
}

findAllTORUSPositions().catch(console.error);