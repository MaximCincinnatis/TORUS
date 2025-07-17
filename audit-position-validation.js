#!/usr/bin/env node

/**
 * Audit Script for Position Validation Implementation
 * Checks the updated validation logic for accuracy and safety
 */

const { ethers } = require('ethers');
const fs = require('fs');

// Test with working RPC providers
const RPC_PROVIDERS = [
  'https://eth.drpc.org',
  'https://rpc.payload.de',
  'https://eth-mainnet.public.blastapi.io'
];

async function getWorkingProvider() {
  for (const url of RPC_PROVIDERS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(url);
      await provider.getBlockNumber();
      console.log(`✅ Connected to RPC: ${url}`);
      return provider;
    } catch (e) {
      console.log(`❌ Failed RPC: ${url}`);
      continue;
    }
  }
  throw new Error('No working RPC providers');
}

async function auditPositionValidation() {
  try {
    console.log('🔍 Position Validation Audit');
    console.log('============================');
    
    // Get working provider
    const provider = await getWorkingProvider();
    
    // Load current cached data
    const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    const positions = cachedData.lpPositions || [];
    
    console.log(`\n📦 Auditing ${positions.length} positions from cache`);
    
    // Uniswap V3 Position Manager contract
    const positionManagerAddress = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
    const positionManagerABI = [
      'function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
      'function ownerOf(uint256 tokenId) external view returns (address)'
    ];
    const positionManager = new ethers.Contract(positionManagerAddress, positionManagerABI, provider);
    
    const auditResults = {
      total: positions.length,
      valid: 0,
      invalid: 0,
      errors: 0,
      details: []
    };
    
    // Expected token addresses
    const torusToken = '0xB47f575807fC5466285e1277Ef8aCFBB5c6686E8'.toLowerCase();
    const titanxToken = '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1'.toLowerCase();
    
    console.log(`\n🔍 Auditing each position...`);
    
    for (const position of positions) {
      try {
        console.log(`\n📋 Position ${position.tokenId}:`);
        
        // Get on-chain data
        const [positionData, currentOwner] = await Promise.all([
          positionManager.positions(position.tokenId),
          positionManager.ownerOf(position.tokenId).catch(() => null)
        ]);
        
        const currentLiquidity = positionData.liquidity.toString();
        const hasLiquidity = currentLiquidity !== '0';
        const token0Lower = positionData.token0.toLowerCase();
        const token1Lower = positionData.token1.toLowerCase();
        
        const isCorrectPool = (token0Lower === torusToken && token1Lower === titanxToken) ||
                            (token0Lower === titanxToken && token1Lower === torusToken);
        
        console.log(`  Owner: ${currentOwner ? currentOwner.substring(0,10) + '...' : 'NONE'}`);
        console.log(`  Liquidity: ${currentLiquidity}`);
        console.log(`  Token0: ${positionData.token0}`);
        console.log(`  Token1: ${positionData.token1}`);
        console.log(`  Correct Pool: ${isCorrectPool ? '✅' : '❌'}`);
        console.log(`  Has Liquidity: ${hasLiquidity ? '✅' : '❌'}`);
        console.log(`  Exists: ${currentOwner ? '✅' : '❌'}`);
        
        if (currentOwner && hasLiquidity && isCorrectPool) {
          console.log(`  🟢 VALID POSITION`);
          auditResults.valid++;
        } else {
          console.log(`  🔴 INVALID POSITION - Should be removed`);
          auditResults.invalid++;
          auditResults.details.push({
            tokenId: position.tokenId,
            reason: !currentOwner ? 'No owner (burned)' : 
                   !hasLiquidity ? 'Zero liquidity' :
                   !isCorrectPool ? 'Wrong pool' : 'Unknown'
          });
        }
        
      } catch (error) {
        console.log(`  ⚠️  ERROR: ${error.message}`);
        auditResults.errors++;
        auditResults.details.push({
          tokenId: position.tokenId,
          reason: `Error: ${error.message.substring(0,50)}...`
        });
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log(`\n📊 Audit Summary:`);
    console.log(`  Total positions: ${auditResults.total}`);
    console.log(`  Valid positions: ${auditResults.valid} (${((auditResults.valid/auditResults.total)*100).toFixed(1)}%)`);
    console.log(`  Invalid positions: ${auditResults.invalid} (${((auditResults.invalid/auditResults.total)*100).toFixed(1)}%)`);
    console.log(`  Errors: ${auditResults.errors}`);
    
    if (auditResults.invalid > 0 || auditResults.errors > 0) {
      console.log(`\n🔍 Issues Found:`);
      auditResults.details.forEach(detail => {
        console.log(`  - Position ${detail.tokenId}: ${detail.reason}`);
      });
    }
    
    if (auditResults.invalid === 0 && auditResults.errors === 0) {
      console.log(`\n✅ All positions are valid! No cleanup needed.`);
    } else {
      console.log(`\n⚠️  ${auditResults.invalid + auditResults.errors} positions need attention.`);
    }
    
    return auditResults;
    
  } catch (error) {
    console.error(`\n❌ Audit failed:`, error.message);
    process.exit(1);
  }
}

// Run the audit
auditPositionValidation();