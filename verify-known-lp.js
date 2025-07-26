#!/usr/bin/env node

const { ethers } = require('ethers');

// Configuration  
const ALCHEMY_URL = 'https://eth-mainnet.g.alchemy.com/v2/demo';
const provider = new ethers.providers.JsonRpcProvider(ALCHEMY_URL);

const NFT_POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function ownerOf(uint256 tokenId) external view returns (address)'
];

async function main() {
  console.log('=== VERIFYING KNOWN LP POSITIONS ===');
  
  try {
    const nftManager = new ethers.Contract('0xC36442b4a4522E871399CD717aBDD847Ab11FE88', NFT_POSITION_MANAGER_ABI, provider);

    // Only check our 3 known positions
    const knownTokenIds = [1030759, 1032346, 1029195];
    
    console.log('Checking our 3 known token IDs...');
    console.log('');

    for (const tokenId of knownTokenIds) {
      console.log(`Token ID ${tokenId}:`);
      
      try {
        const position = await nftManager.positions(tokenId);
        const owner = await nftManager.ownerOf(tokenId);
        
        console.log(`  Owner: ${owner}`);
        console.log(`  Token0: ${position.token0}`);
        console.log(`  Token1: ${position.token1}`);
        console.log(`  Fee: ${position.fee.toString()}`);
        console.log(`  Liquidity: ${position.liquidity.toString()}`);
        console.log(`  Active: ${position.liquidity.gt(0)}`);
        console.log(`  Tick Range: ${position.tickLower} to ${position.tickUpper}`);
        
      } catch (error) {
        console.log(`  ERROR: ${error.message}`);
      }
      console.log('');
    }

    // Load dashboard data for comparison
    const dashboardData = JSON.parse(require('fs').readFileSync('public/data/cached-data.json', 'utf8'));
    console.log('=== DASHBOARD COMPARISON ===');
    console.log('Dashboard has', dashboardData.lpPositions.length, 'LP positions');
    console.log('Dashboard token IDs:', dashboardData.lpPositions.map(p => p.tokenId).join(', '));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main().catch(console.error);