const axios = require('axios');
const { ethers } = require('ethers');
require('dotenv').config();

const MORALIS_API_KEY = process.env.MORALIS_API_KEY;
const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
const TORUS_ADDRESS = '0xB47f575807fC5466285e1277Ef8aCFBB5c6686E8';

// Position Manager ABI for decoding
const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
];

async function findAllLPsWithMoralis() {
  console.log('🔍 Finding all TORUS LP positions using Moralis...\n');

  const headers = {
    'X-API-Key': MORALIS_API_KEY,
    'Content-Type': 'application/json'
  };

  const provider = new ethers.providers.JsonRpcProvider('https://1rpc.io/eth');
  const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);

  const foundPositions = new Map();

  try {
    // Strategy 1: Get recent NFT transfers
    console.log('📡 Fetching recent Uniswap V3 NFT transfers...');
    
    let cursor = null;
    let totalFound = 0;
    let iterations = 0;
    const maxIterations = 5; // Limit iterations to save API calls

    do {
      iterations++;
      console.log(`\n🔄 Iteration ${iterations}...`);
      
      try {
        const response = await axios.get(
          `https://deep-index.moralis.io/api/v2.2/nft/${NFT_POSITION_MANAGER}/transfers`,
          { 
            headers,
            params: {
              chain: 'eth',
              limit: 100,
              cursor: cursor
            }
          }
        );

        if (response.data.result && response.data.result.length > 0) {
          console.log(`   Found ${response.data.result.length} transfers`);
          
          // Check each transferred NFT
          for (const transfer of response.data.result) {
            const tokenId = transfer.token_id;
            
            if (!foundPositions.has(tokenId)) {
              try {
                // Get position details from chain
                const position = await positionManager.positions(tokenId);
                
                // Check if it's a TORUS pool
                if (position.token0.toLowerCase() === TORUS_ADDRESS.toLowerCase()) {
                  const currentOwner = transfer.to_address;
                  
                  foundPositions.set(tokenId, {
                    tokenId,
                    owner: currentOwner,
                    liquidity: position.liquidity.toString(),
                    hasLiquidity: !position.liquidity.isZero(),
                    transferBlock: transfer.block_number,
                    transferDate: transfer.block_timestamp
                  });
                  
                  totalFound++;
                  console.log(`   ✅ Found TORUS position #${tokenId} (owner: ${currentOwner.substring(0, 10)}...)`);
                }
              } catch (err) {
                // Skip if can't get position details
              }
            }
          }
        }

        cursor = response.data.cursor;
        
      } catch (error) {
        console.log(`   ⚠️ API Error: ${error.response?.data?.message || error.message}`);
        break;
      }

    } while (cursor && iterations < maxIterations);

    // Strategy 2: Check known addresses
    console.log('\n🎯 Checking known LP addresses...');
    const knownAddresses = [
      '0xAa390a37006E22b5775A34f2147F81eBD6a63641', // Buy & Process
      '0x9BBb45e12c4a75f7406Cb38e858Fa6C68A88f30d', // Known LP
      '0x16221e4ea7B456C7083A29d43b452F7b6edA2466'  // Known LP
    ];

    for (const address of knownAddresses) {
      console.log(`\n   Checking ${address}...`);
      try {
        const response = await axios.get(
          `https://deep-index.moralis.io/api/v2.2/${address}/nft`,
          { 
            headers,
            params: {
              chain: 'eth',
              token_addresses: [NFT_POSITION_MANAGER],
              limit: 10
            }
          }
        );

        if (response.data.result && response.data.result.length > 0) {
          for (const nft of response.data.result) {
            const tokenId = nft.token_id;
            
            if (!foundPositions.has(tokenId)) {
              try {
                const position = await positionManager.positions(tokenId);
                
                if (position.token0.toLowerCase() === TORUS_ADDRESS.toLowerCase()) {
                  foundPositions.set(tokenId, {
                    tokenId,
                    owner: address,
                    liquidity: position.liquidity.toString(),
                    hasLiquidity: !position.liquidity.isZero(),
                    source: 'direct_check'
                  });
                  
                  console.log(`   ✅ Found position #${tokenId}`);
                }
              } catch (err) {
                // Skip
              }
            }
          }
        }
      } catch (error) {
        console.log(`   ⚠️ Error checking address: ${error.response?.data?.message || error.message}`);
      }
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log(`   Total unique TORUS positions found: ${foundPositions.size}`);
    console.log(`   Positions with liquidity: ${Array.from(foundPositions.values()).filter(p => p.hasLiquidity).length}`);
    console.log('\n   Found positions:');
    
    Array.from(foundPositions.values()).forEach(pos => {
      console.log(`   - #${pos.tokenId}: ${pos.owner.substring(0, 10)}... (${pos.hasLiquidity ? 'Active' : 'No liquidity'})`);
    });

    // Implementation recommendation
    console.log('\n💡 Implementation Plan:');
    console.log('   1. Create moralis-lp-updater.js that:');
    console.log('      - Fetches NFT transfers periodically');
    console.log('      - Checks position details on-chain');
    console.log('      - Updates cached-data.json with new positions');
    console.log('   2. Add to smart-update.js for incremental updates');
    console.log('   3. Use webhooks for real-time position tracking');
    console.log('   4. Keep existing RPC fallback for completeness');

    return foundPositions;

  } catch (error) {
    console.error('Unexpected error:', error);
    return foundPositions;
  }
}

// Run the discovery
findAllLPsWithMoralis().catch(console.error);