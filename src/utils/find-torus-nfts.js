const { ethers } = require('ethers');

const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const provider = new ethers.JsonRpcProvider('https://ethereum-rpc.publicnode.com');

const POOL_ABI = [
  'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)'
];

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)'
];

async function findTorusNFTs() {
  console.log('=== FINDING TORUS/TITANX LP NFTs ===');
  
  try {
    const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
    const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
    
    const currentBlock = await provider.getBlockNumber();
    
    // Use a larger range to find TORUS positions (they might be older)
    const fromBlock = currentBlock - 100000; // ~2 weeks
    
    console.log(`Checking TORUS pool events from block ${fromBlock} to ${currentBlock}`);
    
    // Get all Mint events from the TORUS pool
    const mintFilter = poolContract.filters.Mint();
    const mintEvents = await poolContract.queryFilter(mintFilter, fromBlock, currentBlock);
    console.log(`Found ${mintEvents.length} Mint events in TORUS pool`);
    
    if (mintEvents.length === 0) {
      console.log('No mint events found. Pool might be newer or older than our block range.');
      return;
    }
    
    // Show details of mint events
    console.log('\n=== MINT EVENTS ANALYSIS ===');
    mintEvents.forEach((event, i) => {
      if (i < 3) {
        console.log(`Mint ${i + 1}:`);
        console.log(`  Block: ${event.blockNumber}`);
        console.log(`  Sender: ${event.args.sender}`);
        console.log(`  Owner: ${event.args.owner}`);
        console.log(`  Amount: ${event.args.amount.toString()}`);
        console.log(`  Tick Range: ${event.args.tickLower} to ${event.args.tickUpper}`);
      }
    });
    
    // Now find corresponding NFT tokens by looking at IncreaseLiquidity events
    // around the same blocks as the mint events
    console.log('\n=== FINDING CORRESPONDING NFT TOKENS ===');
    
    for (let i = 0; i < Math.min(5, mintEvents.length); i++) {
      const mintEvent = mintEvents[i];
      const blockNumber = mintEvent.blockNumber;
      
      console.log(`\nChecking block ${blockNumber} for IncreaseLiquidity events...`);
      
      // Get IncreaseLiquidity events from the same block
      const increaseLiquidityFilter = positionManager.filters.IncreaseLiquidity();
      const increaseLiquidityEvents = await positionManager.queryFilter(
        increaseLiquidityFilter, 
        blockNumber, 
        blockNumber
      );
      
      console.log(`Found ${increaseLiquidityEvents.length} IncreaseLiquidity events in block ${blockNumber}`);
      
      for (const incEvent of increaseLiquidityEvents) {
        const tokenId = incEvent.args.tokenId.toString();
        console.log(`  Checking token ID: ${tokenId}`);
        
        try {
          const positionData = await positionManager.positions(tokenId);
          
          // Check if this position matches our mint event
          if (positionData.tickLower === mintEvent.args.tickLower && 
              positionData.tickUpper === mintEvent.args.tickUpper) {
            
            console.log(`  ✅ Found matching NFT token ${tokenId}!`);
            console.log(`    Token0: ${positionData.token0}`);
            console.log(`    Token1: ${positionData.token1}`);
            console.log(`    Current Liquidity: ${positionData.liquidity.toString()}`);
            
            const owner = await positionManager.ownerOf(tokenId);
            console.log(`    Current Owner: ${owner}`);
          }
        } catch (error) {
          console.log(`  Error checking token ${tokenId}: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

findTorusNFTs();