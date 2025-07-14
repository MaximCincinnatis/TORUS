import { ethers } from 'ethers';
import { getProvider } from './ethersWeb3';

const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const TORUS_ADDRESS = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
const TITANX_ADDRESS = '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1';

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
];

export async function findAllPositionsForAddress(targetAddress: string) {
  const provider = getProvider();
  const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  
  console.log(`\n🔎 Finding ALL positions for address: ${targetAddress}`);
  
  try {
    // Method 1: Try to get balance and enumerate tokens
    try {
      const balance = await positionManager.balanceOf(targetAddress);
      console.log(`  Balance of NFTs: ${balance.toString()}`);
      
      const positions = [];
      for (let i = 0; i < balance; i++) {
        try {
          const tokenId = await positionManager.tokenOfOwnerByIndex(targetAddress, i);
          const position = await positionManager.positions(tokenId);
          
          // Check if it's a TORUS position
          const isTORUSPool = (
            position.token0.toLowerCase() === TORUS_ADDRESS.toLowerCase() &&
            position.token1.toLowerCase() === TITANX_ADDRESS.toLowerCase()
          );
          
          if (isTORUSPool) {
            console.log(`  ✅ Found TORUS position NFT #${tokenId}`);
            console.log(`     Liquidity: ${position.liquidity.toString()}`);
            console.log(`     tokensOwed0: ${position.tokensOwed0.toString()}`);
            console.log(`     tokensOwed1: ${position.tokensOwed1.toString()}`);
            positions.push({ tokenId: tokenId.toString(), position });
          }
        } catch (err) {
          console.log(`  Error reading token at index ${i}:`, err);
        }
      }
      
      return positions;
    } catch (err) {
      console.log('  tokenOfOwnerByIndex not supported, trying Transfer events...');
    }
    
    // Method 2: Search Transfer events TO the address
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 100000; // Look back further
    
    console.log(`  Searching Transfer events from block ${fromBlock} to ${currentBlock}`);
    
    const transferFilter = positionManager.filters.Transfer(null, targetAddress);
    const transfers = await positionManager.queryFilter(transferFilter, fromBlock, currentBlock);
    
    console.log(`  Found ${transfers.length} Transfer events TO this address`);
    
    const uniqueTokenIds = new Set<string>();
    for (const transfer of transfers) {
      if ('args' in transfer && transfer.args) {
        uniqueTokenIds.add(transfer.args.tokenId.toString());
      }
    }
    
    console.log(`  Unique token IDs received: ${Array.from(uniqueTokenIds).join(', ')}`);
    
    // Check each token ID
    const positions = [];
    for (const tokenId of uniqueTokenIds) {
      try {
        // Verify current owner
        const currentOwner = await positionManager.ownerOf(tokenId);
        if (currentOwner.toLowerCase() !== targetAddress.toLowerCase()) {
          console.log(`  Token ${tokenId} no longer owned by target (now owned by ${currentOwner})`);
          continue;
        }
        
        const position = await positionManager.positions(tokenId);
        
        // Check if it's a TORUS position
        const isTORUSPool = (
          position.token0.toLowerCase() === TORUS_ADDRESS.toLowerCase() &&
          position.token1.toLowerCase() === TITANX_ADDRESS.toLowerCase()
        );
        
        if (isTORUSPool) {
          console.log(`  ✅ Found TORUS position NFT #${tokenId}`);
          console.log(`     Liquidity: ${position.liquidity.toString()}`);
          console.log(`     tokensOwed0: ${position.tokensOwed0.toString()}`);
          console.log(`     tokensOwed1: ${position.tokensOwed1.toString()}`);
          positions.push({ tokenId, position });
        }
      } catch (err) {
        console.log(`  Error checking token ${tokenId}:`, err);
      }
    }
    
    return positions;
    
  } catch (error) {
    console.error('Error finding positions:', error);
    return [];
  }
}

// Test function
export async function testFindPositions() {
  const testAddress = '0xCe32E10b205FBf49F3bB7132f7378751Af1832b6';
  const positions = await findAllPositionsForAddress(testAddress);
  console.log(`\n📊 Total TORUS positions found for ${testAddress}: ${positions.length}`);
  return positions;
}