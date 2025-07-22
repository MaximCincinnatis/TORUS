const { ethers } = require('ethers');

async function findBuyProcessLPPositions() {
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
  const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
  const TORUS_TOKEN = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
  const TITANX_TOKEN = '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1';
  
  console.log('🔍 Deep Search for Buy & Process LP Positions\n');
  
  // NFT Position Manager ABI
  const NFT_MANAGER_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
    'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
    'function ownerOf(uint256 tokenId) view returns (address)',
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
    'event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
    'event DecreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
    'event Collect(uint256 indexed tokenId, address recipient, uint256 amount0, uint256 amount1)'
  ];
  
  const POOL_ABI = [
    'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
    'event Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
    'event Collect(address indexed owner, address recipient, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount0, uint128 amount1)',
    'function positions(bytes32 positionKey) view returns (uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
  ];
  
  const nftManager = new ethers.Contract(NFT_POSITION_MANAGER, NFT_MANAGER_ABI, provider);
  const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
  
  try {
    // Method 1: Check if Buy & Process owns any NFT positions directly
    console.log('Method 1: Checking NFT balance of Buy & Process contract...');
    const nftBalance = await nftManager.balanceOf(BUY_PROCESS_CONTRACT);
    console.log(`Buy & Process owns ${nftBalance.toString()} NFT position(s)\n`);
    
    if (nftBalance.gt(0)) {
      console.log('Found NFT positions! Fetching details...\n');
      
      for (let i = 0; i < nftBalance.toNumber(); i++) {
        try {
          const tokenId = await nftManager.tokenOfOwnerByIndex(BUY_PROCESS_CONTRACT, i);
          const position = await nftManager.positions(tokenId);
          
          console.log(`NFT Position ${i + 1} (Token ID: ${tokenId}):`);
          console.log(`  Token0: ${position.token0}`);
          console.log(`  Token1: ${position.token1}`);
          console.log(`  Fee Tier: ${position.fee / 10000}%`);
          console.log(`  Liquidity: ${position.liquidity.toString()}`);
          console.log(`  Tick Range: ${position.tickLower} to ${position.tickUpper}`);
          console.log(`  Tokens Owed 0: ${position.tokensOwed0.toString()}`);
          console.log(`  Tokens Owed 1: ${position.tokensOwed1.toString()}\n`);
          
          // Check if this is a TORUS/TitanX position
          if ((position.token0.toLowerCase() === TORUS_TOKEN.toLowerCase() && 
               position.token1.toLowerCase() === TITANX_TOKEN.toLowerCase()) ||
              (position.token1.toLowerCase() === TORUS_TOKEN.toLowerCase() && 
               position.token0.toLowerCase() === TITANX_TOKEN.toLowerCase())) {
            console.log('  ✅ This is a TORUS/TitanX position!\n');
          }
        } catch (e) {
          console.log(`  Error fetching position ${i}: ${e.message}\n`);
        }
      }
    }
    
    // Method 2: Check for direct positions in the pool (non-NFT positions)
    console.log('\nMethod 2: Checking for direct positions in the pool...');
    
    // Look for Mint events where Buy & Process is the owner
    const currentBlock = await provider.getBlockNumber();
    const deploymentBlock = 21310000; // Approximate deployment block
    
    console.log(`Searching from deployment block ${deploymentBlock} to current block ${currentBlock}`);
    console.log('This will search in chunks...\n');
    
    const chunkSize = 5000;
    let totalMints = 0;
    let buyProcessMints = [];
    
    for (let fromBlock = deploymentBlock; fromBlock < currentBlock; fromBlock += chunkSize) {
      const toBlock = Math.min(fromBlock + chunkSize - 1, currentBlock);
      
      try {
        const mintFilter = pool.filters.Mint(null, BUY_PROCESS_CONTRACT);
        const mints = await pool.queryFilter(mintFilter, fromBlock, toBlock);
        
        if (mints.length > 0) {
          console.log(`Found ${mints.length} mints in blocks ${fromBlock}-${toBlock}`);
          buyProcessMints.push(...mints);
        }
        
        totalMints += mints.length;
      } catch (e) {
        // Skip chunk if error
      }
      
      // Progress indicator
      if ((fromBlock - deploymentBlock) % 50000 === 0) {
        const progress = ((fromBlock - deploymentBlock) / (currentBlock - deploymentBlock) * 100).toFixed(1);
        console.log(`Progress: ${progress}%`);
      }
    }
    
    console.log(`\nTotal mints by Buy & Process: ${buyProcessMints.length}`);
    
    if (buyProcessMints.length > 0) {
      console.log('\nMint events details:');
      for (const mint of buyProcessMints) {
        console.log(`Block ${mint.blockNumber}:`);
        console.log(`  Amount: ${mint.args.amount.toString()}`);
        console.log(`  Amount0: ${ethers.utils.formatEther(mint.args.amount0)} TORUS`);
        console.log(`  Amount1: ${ethers.utils.formatEther(mint.args.amount1)} TitanX`);
        console.log(`  Tick Range: ${mint.args.tickLower} to ${mint.args.tickUpper}`);
        console.log(`  Tx: ${mint.transactionHash}\n`);
      }
    }
    
    // Method 3: Look for Collect events
    console.log('\nMethod 3: Searching for fee collection events...');
    
    let totalCollects = 0;
    let buyProcessCollects = [];
    
    for (let fromBlock = currentBlock - 100000; fromBlock < currentBlock; fromBlock += chunkSize) {
      const toBlock = Math.min(fromBlock + chunkSize - 1, currentBlock);
      
      try {
        const collectFilter = pool.filters.Collect(BUY_PROCESS_CONTRACT);
        const collects = await pool.queryFilter(collectFilter, fromBlock, toBlock);
        
        if (collects.length > 0) {
          console.log(`Found ${collects.length} collects in blocks ${fromBlock}-${toBlock}`);
          buyProcessCollects.push(...collects);
        }
        
        totalCollects += collects.length;
      } catch (e) {
        // Skip chunk if error
      }
    }
    
    console.log(`\nTotal fee collections by Buy & Process: ${buyProcessCollects.length}`);
    
    if (buyProcessCollects.length > 0) {
      console.log('\nRecent fee collections:');
      for (const collect of buyProcessCollects.slice(-5)) {
        console.log(`Block ${collect.blockNumber}:`);
        console.log(`  Amount0: ${ethers.utils.formatEther(collect.args.amount0)} TORUS`);
        console.log(`  Amount1: ${ethers.utils.formatEther(collect.args.amount1)} TitanX`);
        console.log(`  Recipient: ${collect.args.recipient}`);
        console.log(`  Tx: ${collect.transactionHash}\n`);
      }
    }
    
    // Method 4: Check NFT Collect events
    console.log('\nMethod 4: Checking NFT position collect events...');
    
    const nftCollectFilter = nftManager.filters.Collect();
    const nftCollects = await nftManager.queryFilter(nftCollectFilter, currentBlock - 10000, currentBlock);
    
    const buyProcessNFTCollects = nftCollects.filter(event => 
      event.args.recipient.toLowerCase() === BUY_PROCESS_CONTRACT.toLowerCase()
    );
    
    console.log(`Found ${buyProcessNFTCollects.length} NFT fee collections to Buy & Process`);
    
    if (buyProcessNFTCollects.length > 0) {
      console.log('\nRecent NFT fee collections:');
      for (const collect of buyProcessNFTCollects.slice(-5)) {
        console.log(`Token ID ${collect.args.tokenId}:`);
        console.log(`  Amount0: ${ethers.utils.formatEther(collect.args.amount0)}`);
        console.log(`  Amount1: ${ethers.utils.formatEther(collect.args.amount1)}`);
        console.log(`  Block: ${collect.blockNumber}`);
        console.log(`  Tx: ${collect.transactionHash}\n`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

findBuyProcessLPPositions().catch(console.error);