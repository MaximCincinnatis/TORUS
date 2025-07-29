#!/usr/bin/env node

/**
 * Find missing LP positions more efficiently
 */

const { ethers } = require('ethers');
const fs = require('fs');

// RPC endpoints
const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function getProvider() {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(endpoint);
      await provider.getBlockNumber();
      return provider;
    } catch (e) {
      continue;
    }
  }
  throw new Error('No working RPC providers available');
}

async function findMissingLPs() {
  console.log('🔍 Finding Missing LP Positions\n');
  
  const provider = await getProvider();
  const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
  const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
  
  // Load cached data
  const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json'));
  const cachedPositions = cachedData.lpPositions || [];
  const cachedTokenIds = new Set(cachedPositions.map(p => p.tokenId));
  
  console.log(`📊 Dashboard currently shows ${cachedPositions.length} positions:\n`);
  cachedPositions.forEach(pos => {
    console.log(`  - Token ID ${pos.tokenId}: ${pos.liquidity} liquidity`);
  });
  
  // Get recent IncreaseLiquidity events to find active positions
  console.log('\n🔍 Checking recent LP activity (last 7 days)...\n');
  
  const nftABI = [
    'event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
    'event DecreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
    'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
    'function ownerOf(uint256 tokenId) view returns (address)'
  ];
  
  const nftManager = new ethers.Contract(NFT_POSITION_MANAGER, nftABI, provider);
  
  const currentBlock = await provider.getBlockNumber();
  const oneDayAgo = currentBlock - 7200; // ~1 day
  
  // Get recent liquidity changes (smaller range due to RPC limits)
  const [increaseEvents, decreaseEvents] = await Promise.all([
    nftManager.queryFilter(nftManager.filters.IncreaseLiquidity(), oneDayAgo, currentBlock),
    nftManager.queryFilter(nftManager.filters.DecreaseLiquidity(), oneDayAgo, currentBlock)
  ]);
  
  console.log(`Found ${increaseEvents.length} IncreaseLiquidity events`);
  console.log(`Found ${decreaseEvents.length} DecreaseLiquidity events\n`);
  
  // Track token IDs with recent activity
  const activeTokenIds = new Set();
  
  increaseEvents.forEach(event => {
    activeTokenIds.add(event.args.tokenId.toString());
  });
  
  decreaseEvents.forEach(event => {
    activeTokenIds.add(event.args.tokenId.toString());
  });
  
  console.log(`📊 Found ${activeTokenIds.size} positions with recent activity\n`);
  
  // Check each active position
  const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  const TORUS = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
  const missingPositions = [];
  
  console.log('🔍 Checking which positions are TORUS/WETH...\n');
  
  for (const tokenId of activeTokenIds) {
    try {
      const position = await nftManager.positions(tokenId);
      
      // Check if this is a TORUS/WETH position
      const isTorusWeth = (
        (position.token0.toLowerCase() === TORUS.toLowerCase() && position.token1.toLowerCase() === WETH.toLowerCase()) ||
        (position.token0.toLowerCase() === WETH.toLowerCase() && position.token1.toLowerCase() === TORUS.toLowerCase())
      );
      
      if (isTorusWeth && position.liquidity.gt(0)) {
        if (!cachedTokenIds.has(tokenId)) {
          // Get owner
          let owner = 'Unknown';
          try {
            owner = await nftManager.ownerOf(tokenId);
          } catch (e) {}
          
          missingPositions.push({
            tokenId,
            liquidity: position.liquidity.toString(),
            tickLower: position.tickLower,
            tickUpper: position.tickUpper,
            owner
          });
          
          console.log(`  ⚠️ MISSING: Token ID ${tokenId}`);
          console.log(`     Owner: ${owner}`);
          console.log(`     Liquidity: ${ethers.utils.formatEther(position.liquidity)}\n`);
        } else {
          console.log(`  ✅ Tracked: Token ID ${tokenId}`);
        }
      }
    } catch (e) {
      // Position might not exist or be burned
    }
  }
  
  // Also check Mint events from the pool directly (last 3 days)
  console.log('\n🔍 Checking recent Mint events on the pool...\n');
  
  const poolABI = [
    'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)'
  ];
  
  const pool = new ethers.Contract(POOL_ADDRESS, poolABI, provider);
  const halfDayAgo = currentBlock - 3600; // ~12 hours
  
  const mintEvents = await pool.queryFilter(pool.filters.Mint(), halfDayAgo, currentBlock);
  console.log(`Found ${mintEvents.length} recent Mint events\n`);
  
  // Check if NFT manager was the sender (indicates LP NFT creation)
  const nftMints = mintEvents.filter(event => 
    event.args.sender.toLowerCase() === NFT_POSITION_MANAGER.toLowerCase()
  );
  
  console.log(`${nftMints.length} mints were from NFT Position Manager\n`);
  
  // Summary
  console.log(`\n📊 AUDIT SUMMARY:`);
  console.log(`┌─────────────────────────────────────────┐`);
  console.log(`│  Dashboard tracks:    ${String(cachedPositions.length).padStart(3)} positions     │`);
  console.log(`│  Recent activity on:  ${String(activeTokenIds.size).padStart(3)} positions     │`);
  console.log(`│  Missing positions:   ${String(missingPositions.length).padStart(3)} positions     │`);
  console.log(`└─────────────────────────────────────────┘`);
  
  if (missingPositions.length > 0) {
    console.log('\n📋 Missing Position Details:\n');
    missingPositions.forEach((pos, i) => {
      console.log(`${i + 1}. Token ID: ${pos.tokenId}`);
      console.log(`   Owner: ${pos.owner}`);
      console.log(`   Liquidity: ${pos.liquidity}`);
      console.log(`   Tick Range: ${pos.tickLower} to ${pos.tickUpper}\n`);
    });
    
    // Save missing positions for recovery
    fs.writeFileSync(
      'missing-lp-positions.json',
      JSON.stringify(missingPositions, null, 2)
    );
    console.log('💾 Missing positions saved to missing-lp-positions.json');
  }
  
  // Check how LP tracking works in the update script
  console.log('\n🔍 Checking LP update mechanism...\n');
  
  const updateScript = fs.readFileSync('./smart-update-fixed.js', 'utf8');
  const lpUpdateMatch = updateScript.match(/updateLPPositionsIncrementally[\s\S]*?catch/);
  
  if (lpUpdateMatch) {
    console.log('Found LP update logic in smart-update-fixed.js');
    console.log('The script uses "updateLPPositionsIncrementally" function');
    
    // Check if it's looking for IncreaseLiquidity events
    if (updateScript.includes('IncreaseLiquidity')) {
      console.log('✅ Script checks for IncreaseLiquidity events');
    } else {
      console.log('⚠️ Script might not be checking IncreaseLiquidity events');
    }
    
    // Check if it's looking for new positions
    if (updateScript.includes('Transfer') && updateScript.includes('0x0000000000000000000000000000000000000000')) {
      console.log('✅ Script checks for new position mints (Transfer from 0x0)');
    } else {
      console.log('⚠️ Script might not be checking for new position mints');
    }
  }
}

findMissingLPs().catch(console.error);