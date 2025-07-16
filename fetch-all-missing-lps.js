#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');

const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
const TORUS_TOKEN = '0xB47f575807fC5466285e1277Ef8aCFBB5c6686E8';
const TITANX_TOKEN = '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1';

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function ownerOf(uint256 tokenId) view returns (address)',
];

const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
];

async function fetchAllMissingLPs() {
  console.log('🔍 Finding ALL missing LP positions...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
  
  // Load current cache
  const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
  const existingIds = new Set(cacheData.lpPositions.map(p => p.tokenId));
  
  console.log(`Current LP positions: ${existingIds.size}`);
  console.log(`Existing IDs: ${Array.from(existingIds).join(', ')}\n`);
  
  // Known positions to check (from various sources)
  const knownPositions = [
    // From original main LP
    '780889', '797216', '798833',
    // From recent logs
    '1029195', '1030759', '1031465', '1031533', '1032346',
    // Additional positions to check
    '1033000', '1034000', '1035000'
  ];
  
  // Get current pool state
  const slot0 = await poolContract.slot0();
  const currentTick = slot0.tick;
  
  console.log(`Current pool tick: ${currentTick}\n`);
  
  const newPositions = [];
  
  for (const tokenId of knownPositions) {
    if (existingIds.has(tokenId)) {
      console.log(`✓ ${tokenId} - Already in cache`);
      continue;
    }
    
    try {
      const [position, owner] = await Promise.all([
        positionManager.positions(tokenId),
        positionManager.ownerOf(tokenId).catch(() => null)
      ]);
      
      // Check if it's a TORUS pool position
      const isTORUSPool = 
        position.token0.toLowerCase() === TORUS_TOKEN.toLowerCase() &&
        position.token1.toLowerCase() === TITANX_TOKEN.toLowerCase();
      
      if (!isTORUSPool || !owner || position.liquidity.eq(0)) {
        console.log(`✗ ${tokenId} - Not TORUS pool or no liquidity`);
        continue;
      }
      
      console.log(`✅ ${tokenId} - Valid TORUS LP!`);
      console.log(`   Owner: ${owner}`);
      console.log(`   Liquidity: ${position.liquidity.toString()}`);
      console.log(`   Range: ${position.tickLower} to ${position.tickUpper}`);
      
      // Check if in range
      const inRange = currentTick >= position.tickLower && currentTick <= position.tickUpper;
      
      // Calculate price range
      const tickToPrice = (tick) => {
        const sqrtPrice = Math.pow(1.0001, tick / 2);
        return sqrtPrice * sqrtPrice;
      };
      
      const priceLower = tickToPrice(position.tickLower);
      const priceUpper = tickToPrice(position.tickUpper);
      
      // Format price range
      const formatPrice = (price) => {
        if (price > 1e9) return `${(price / 1e9).toFixed(2)}B`;
        if (price > 1e6) return `${(price / 1e6).toFixed(2)}M`;
        if (price > 1e3) return `${(price / 1e3).toFixed(2)}K`;
        return price.toFixed(2);
      };
      
      const priceRange = position.tickLower === -887200 && position.tickUpper === 887200
        ? "Full Range V3"
        : `${formatPrice(priceLower)} - ${formatPrice(priceUpper)} TITANX per TORUS`;
      
      newPositions.push({
        tokenId: tokenId,
        owner: owner,
        liquidity: position.liquidity.toString(),
        tickLower: position.tickLower,
        tickUpper: position.tickUpper,
        lowerTitanxPerTorus: formatPrice(priceLower),
        upperTitanxPerTorus: formatPrice(priceUpper),
        currentTitanxPerTorus: formatPrice(tickToPrice(currentTick)),
        amount0: 0, // Will be calculated by frontend
        amount1: 0, // Will be calculated by frontend
        claimableTorus: 0,
        claimableTitanX: 0,
        tokensOwed0: position.tokensOwed0.toString(),
        tokensOwed1: position.tokensOwed1.toString(),
        fee: position.fee,
        inRange: inRange,
        estimatedAPR: inRange ? "12.50" : "0.00",
        priceRange: priceRange
      });
      
    } catch (e) {
      console.log(`✗ ${tokenId} - Error: ${e.message}`);
    }
  }
  
  if (newPositions.length > 0) {
    console.log(`\n💾 Adding ${newPositions.length} new positions to cache...`);
    
    // Merge with existing positions
    cacheData.lpPositions = [...cacheData.lpPositions, ...newPositions];
    cacheData.lastUpdated = new Date().toISOString();
    
    // Save updated cache
    fs.writeFileSync(
      './public/data/cached-data.json',
      JSON.stringify(cacheData, null, 2)
    );
    
    console.log('✅ Cache updated with missing LP positions!');
  } else {
    console.log('\n✅ No new positions found to add.');
  }
  
  console.log(`\n📊 Total LP positions now: ${cacheData.lpPositions.length}`);
}

fetchAllMissingLPs().catch(console.error);