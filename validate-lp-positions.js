#!/usr/bin/env node

/**
 * Validate current LP positions
 */

const { ethers } = require('ethers');
const fs = require('fs');

async function validateLPPositions() {
  console.log('🔍 Validating LP Positions\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
  
  // Load current data
  const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json'));
  const positions = cachedData.lpPositions || [];
  
  console.log(`📊 Checking ${positions.length} positions...\n`);
  
  const nftABI = [
    'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
    'function ownerOf(uint256 tokenId) view returns (address)'
  ];
  
  const nftManager = new ethers.Contract(NFT_POSITION_MANAGER, nftABI, provider);
  
  const validPositions = [];
  const invalidPositions = [];
  
  for (const pos of positions) {
    console.log(`Checking position ${pos.tokenId}...`);
    
    try {
      const [currentPos, owner] = await Promise.all([
        nftManager.positions(pos.tokenId),
        nftManager.ownerOf(pos.tokenId).catch(() => null)
      ]);
      
      if (!owner) {
        console.log(`  ❌ Position burned or doesn't exist`);
        invalidPositions.push(pos);
        continue;
      }
      
      if (currentPos.liquidity.toString() === '0') {
        console.log(`  ❌ Position has 0 liquidity`);
        invalidPositions.push(pos);
        continue;
      }
      
      const liquidityMatch = currentPos.liquidity.toString() === pos.liquidity;
      const ownerMatch = owner.toLowerCase() === pos.owner.toLowerCase();
      
      if (!liquidityMatch || !ownerMatch) {
        console.log(`  ⚠️ Position data outdated:`);
        if (!liquidityMatch) {
          console.log(`     Liquidity: ${pos.liquidity} → ${currentPos.liquidity.toString()}`);
        }
        if (!ownerMatch) {
          console.log(`     Owner: ${pos.owner} → ${owner}`);
        }
      } else {
        console.log(`  ✅ Position valid`);
      }
      
      validPositions.push({
        ...pos,
        liquidity: currentPos.liquidity.toString(),
        owner: owner
      });
      
    } catch (e) {
      console.log(`  ❌ Error: ${e.message}`);
      invalidPositions.push(pos);
    }
  }
  
  console.log(`\n📊 VALIDATION RESULTS:`);
  console.log(`Valid positions: ${validPositions.length}`);
  console.log(`Invalid positions: ${invalidPositions.length}`);
  
  if (invalidPositions.length > 0) {
    console.log('\n❌ Invalid positions to remove:');
    invalidPositions.forEach(pos => {
      console.log(`- Token ID ${pos.tokenId}`);
    });
    
    // Update cached data with only valid positions
    cachedData.lpPositions = validPositions;
    if (cachedData.uniswapV3) {
      cachedData.uniswapV3.lpPositions = validPositions;
    }
    
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
    console.log('\n✅ Removed invalid positions from cached data');
  }
  
  // Check if we're missing any recent positions
  console.log('\n🔍 Checking for recent LP activity...\n');
  
  const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
  const poolABI = [
    'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)'
  ];
  
  const pool = new ethers.Contract(POOL_ADDRESS, poolABI, provider);
  const currentBlock = await provider.getBlockNumber();
  const dayAgo = currentBlock - 7200;
  
  const recentMints = await pool.queryFilter(pool.filters.Mint(), dayAgo, currentBlock);
  const nftMints = recentMints.filter(e => 
    e.args.sender.toLowerCase() === NFT_POSITION_MANAGER.toLowerCase()
  );
  
  console.log(`Recent mints from NFT Manager: ${nftMints.length}`);
  
  if (nftMints.length > 0) {
    console.log('\n📋 Recent mints (might indicate new positions):');
    nftMints.forEach(mint => {
      console.log(`- Block ${mint.blockNumber}: ${ethers.utils.formatEther(mint.args.amount)} liquidity`);
    });
  }
}

validateLPPositions().catch(console.error);