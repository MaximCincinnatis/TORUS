#!/usr/bin/env node

/**
 * Recover missing LP positions by searching the pool directly
 */

const { ethers } = require('ethers');
const fs = require('fs');

async function recoverMissingLPs() {
  console.log('🔧 Recovering Missing LP Positions\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
  const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
  const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  const TORUS = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
  
  // Load current data
  const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json'));
  const existingPositions = cachedData.lpPositions || [];
  const existingTokenIds = new Set(existingPositions.map(p => p.tokenId));
  
  console.log(`📊 Current positions: ${existingPositions.length}\n`);
  
  // Get recent Mint events from the pool
  const poolABI = [
    'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)'
  ];
  
  const pool = new ethers.Contract(POOL_ADDRESS, poolABI, provider);
  
  // Get current pool state
  const slot0 = await pool.slot0();
  console.log(`Current pool tick: ${slot0.tick}\n`);
  
  const currentBlock = await provider.getBlockNumber();
  const startBlock = currentBlock - 50000; // ~7 days
  
  console.log('🔍 Searching for LP positions created in last 7 days...\n');
  
  // Scan in chunks
  const allMints = [];
  const chunkSize = 5000;
  
  for (let start = startBlock; start <= currentBlock; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, currentBlock);
    console.log(`  Scanning blocks ${start} to ${end}...`);
    
    try {
      const events = await pool.queryFilter(pool.filters.Mint(), start, end);
      allMints.push(...events);
    } catch (e) {
      console.log(`  ⚠️ Error: ${e.message}`);
    }
  }
  
  console.log(`\nFound ${allMints.length} Mint events\n`);
  
  // Filter for NFT Position Manager mints
  const nftMints = allMints.filter(event => 
    event.args.sender.toLowerCase() === NFT_POSITION_MANAGER.toLowerCase()
  );
  
  console.log(`${nftMints.length} were from NFT Position Manager\n`);
  
  // Now find the corresponding NFT token IDs
  const nftABI = [
    'event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
    'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
    'function ownerOf(uint256 tokenId) view returns (address)'
  ];
  
  const nftManager = new ethers.Contract(NFT_POSITION_MANAGER, nftABI, provider);
  
  const foundPositions = [];
  
  console.log('🔍 Finding corresponding NFT positions...\n');
  
  // For each mint, find the IncreaseLiquidity event around the same block
  for (const mint of nftMints) {
    const block = mint.blockNumber;
    
    try {
      const events = await nftManager.queryFilter(
        nftManager.filters.IncreaseLiquidity(),
        block - 2,
        block + 2
      );
      
      for (const event of events) {
        const tokenId = event.args.tokenId.toString();
        
        if (!existingTokenIds.has(tokenId)) {
          try {
            const [position, owner] = await Promise.all([
              nftManager.positions(tokenId),
              nftManager.ownerOf(tokenId).catch(() => null)
            ]);
            
            // Verify this is TORUS/WETH
            const isTorusWeth = (
              (position.token0.toLowerCase() === TORUS.toLowerCase() && 
               position.token1.toLowerCase() === WETH.toLowerCase()) ||
              (position.token0.toLowerCase() === WETH.toLowerCase() && 
               position.token1.toLowerCase() === TORUS.toLowerCase())
            );
            
            if (isTorusWeth && position.liquidity.gt(0) && owner) {
              foundPositions.push({
                tokenId,
                owner,
                liquidity: position.liquidity.toString(),
                tickLower: position.tickLower,
                tickUpper: position.tickUpper,
                fee: position.fee,
                inRange: slot0.tick >= position.tickLower && slot0.tick <= position.tickUpper
              });
              
              console.log(`  ✅ Found missing position: ${tokenId}`);
              console.log(`     Owner: ${owner}`);
              console.log(`     Liquidity: ${ethers.utils.formatEther(position.liquidity)}\n`);
            }
          } catch (e) {
            // Position might not exist
          }
        }
      }
    } catch (e) {
      console.log(`  ⚠️ Error checking block ${block}: ${e.message}`);
    }
  }
  
  console.log(`\n📊 Found ${foundPositions.length} missing positions\n`);
  
  if (foundPositions.length > 0) {
    // Add missing positions to cached data
    console.log('💾 Adding missing positions to cached data...\n');
    
    // Import required functions
    const { calculatePositionAmountsShared, calculateClaimableFees, mapFieldNames } = require('./shared/lpCalculations');
    
    for (const pos of foundPositions) {
      // Fetch full position data
      const position = await nftManager.positions(pos.tokenId);
      
      // Calculate amounts
      const calculated = calculatePositionAmountsShared(
        position,
        slot0.sqrtPriceX96,
        slot0.tick
      );
      
      // Calculate fees
      const claimableFees = await calculateClaimableFees(
        pos.tokenId,
        pos.owner,
        position,
        provider
      );
      
      // Create full position object
      const fullPosition = mapFieldNames({
        tokenId: pos.tokenId,
        owner: pos.owner,
        liquidity: pos.liquidity,
        tickLower: pos.tickLower,
        tickUpper: pos.tickUpper,
        fee: pos.fee,
        amount0: calculated.amount0,
        amount1: calculated.amount1,
        inRange: pos.inRange,
        claimableTorus: claimableFees.claimableTorus,
        claimableWeth: claimableFees.claimableWeth,
        tokensOwed0: position.tokensOwed0.toString(),
        tokensOwed1: position.tokensOwed1.toString(),
        lastChecked: new Date().toISOString()
      });
      
      existingPositions.push(fullPosition);
    }
    
    // Update cached data
    cachedData.lpPositions = existingPositions;
    
    // Also update in uniswapV3 section if it exists
    if (cachedData.uniswapV3) {
      cachedData.uniswapV3.lpPositions = existingPositions;
    }
    
    // Save
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
    
    console.log(`✅ Successfully added ${foundPositions.length} positions`);
    console.log(`📊 Total positions now: ${existingPositions.length}`);
  } else {
    console.log('✅ No missing positions found');
  }
}

recoverMissingLPs().catch(console.error);