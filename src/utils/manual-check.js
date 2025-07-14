const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const TARGET_ADDRESS = '0xCe32E10b205FBf49F3bB7132f7378751Af1832b6';

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
];

async function manualCheck() {
  const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  
  console.log('Manual check for address:', TARGET_ADDRESS);
  console.log('Checking specific token IDs we found...\n');
  
  // Check the token IDs we found
  const tokenIds = ['1030051', '1031465'];
  
  for (const tokenId of tokenIds) {
    console.log(`\nChecking Token ID: ${tokenId}`);
    try {
      const owner = await positionManager.ownerOf(tokenId);
      console.log(`  Owner: ${owner}`);
      
      if (owner.toLowerCase() === TARGET_ADDRESS.toLowerCase()) {
        const position = await positionManager.positions(tokenId);
        console.log(`  Token0: ${position.token0}`);
        console.log(`  Token1: ${position.token1}`);
        console.log(`  Fee: ${position.fee}`);
        console.log(`  Liquidity: ${position.liquidity.toString()}`);
        console.log(`  TickLower: ${position.tickLower}`);
        console.log(`  TickUpper: ${position.tickUpper}`);
        console.log(`  tokensOwed0: ${position.tokensOwed0.toString()}`);
        console.log(`  tokensOwed1: ${position.tokensOwed1.toString()}`);
        
        // Convert to human readable
        const torus = Number(position.tokensOwed0) / 1e18;
        const titanx = Number(position.tokensOwed1) / 1e18;
        console.log(`  Claimable TORUS: ${torus.toFixed(6)}`);
        console.log(`  Claimable TitanX: ${titanx.toFixed(6)}`);
      }
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }
  
  // Search for more positions via Transfer events
  console.log('\n\nSearching for ALL positions via Transfer events...');
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = currentBlock - 1000; // Stay within 1k block limit
  
  const filter = positionManager.filters.Transfer(null, TARGET_ADDRESS);
  const events = await positionManager.queryFilter(filter, fromBlock, currentBlock);
  
  console.log(`Found ${events.length} Transfer events TO this address`);
  
  const uniqueTokens = new Set();
  for (const event of events) {
    uniqueTokens.add(event.args.tokenId.toString());
  }
  
  console.log(`Unique token IDs received: ${Array.from(uniqueTokens).join(', ')}`);
  
  // Check each one
  for (const tokenId of uniqueTokens) {
    console.log(`\nChecking Token ID: ${tokenId}`);
    try {
      const owner = await positionManager.ownerOf(tokenId);
      if (owner.toLowerCase() === TARGET_ADDRESS.toLowerCase()) {
        const position = await positionManager.positions(tokenId);
        
        // Check if TORUS pool
        const isTorus = position.token0.toLowerCase() === '0xb47f575807fc5466285e1277ef8acfbb5c6686e8' &&
                       position.token1.toLowerCase() === '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1';
        
        if (isTorus) {
          console.log(`  ✅ TORUS Position!`);
          console.log(`  Liquidity: ${position.liquidity.toString()}`);
          console.log(`  tokensOwed0: ${position.tokensOwed0.toString()}`);
          console.log(`  tokensOwed1: ${position.tokensOwed1.toString()}`);
          
          const torus = Number(position.tokensOwed0) / 1e18;
          const titanx = Number(position.tokensOwed1) / 1e18;
          console.log(`  Claimable TORUS: ${torus.toFixed(6)}`);
          console.log(`  Claimable TitanX: ${(titanx / 1e6).toFixed(2)}M`);
        }
      }
    } catch (err) {
      // Skip
    }
  }
}

manualCheck().catch(console.error);