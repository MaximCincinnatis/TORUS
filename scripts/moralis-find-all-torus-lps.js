const axios = require('axios');
const { ethers } = require('ethers');
require('dotenv').config();

const MORALIS_API_KEY = process.env.MORALIS_API_KEY;
const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const TORUS_ADDRESS = '0xB47f575807fC5466285e1277Ef8aCFBB5c6686E8';

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function ownerOf(uint256 tokenId) view returns (address)'
];

async function findAllTorusLPs() {
  console.log('🔍 Comprehensive search for ALL TORUS LP positions...\n');

  const headers = {
    'X-API-Key': MORALIS_API_KEY,
    'Content-Type': 'application/json'
  };

  const provider = new ethers.providers.JsonRpcProvider('https://1rpc.io/eth');
  const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);

  const allPositions = new Map();
  const addressesToCheck = new Set();

  try {
    // Step 1: Get recent transfers to find potential LP holders
    console.log('📡 Fetching recent Uniswap V3 NFT transfers...');
    let cursor = null;
    let pageCount = 0;
    
    do {
      pageCount++;
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

        if (response.data.result) {
          console.log(`  Page ${pageCount}: ${response.data.result.length} transfers`);
          
          // Collect unique addresses
          response.data.result.forEach(transfer => {
            addressesToCheck.add(transfer.to_address);
            addressesToCheck.add(transfer.from_address);
          });
        }

        cursor = response.data.cursor;
      } catch (error) {
        console.log(`  Error on page ${pageCount}: ${error.response?.data?.message || error.message}`);
        break;
      }
    } while (cursor && pageCount < 3); // Limit pages to avoid timeout

    console.log(`\n📊 Found ${addressesToCheck.size} unique addresses to check`);

    // Step 2: Check each address for TORUS positions
    console.log('\n🔎 Checking addresses for TORUS positions...');
    let checked = 0;
    let foundCount = 0;

    for (const address of addressesToCheck) {
      if (address === '0x0000000000000000000000000000000000000000') continue;
      
      checked++;
      if (checked % 10 === 0) {
        console.log(`  Progress: ${checked}/${addressesToCheck.size} addresses checked...`);
      }

      try {
        const response = await axios.get(
          `https://deep-index.moralis.io/api/v2.2/${address}/nft`,
          { 
            headers,
            params: {
              chain: 'eth',
              token_addresses: [NFT_POSITION_MANAGER],
              limit: 100
            }
          }
        );

        if (response.data.result && response.data.result.length > 0) {
          for (const nft of response.data.result) {
            try {
              const position = await positionManager.positions(nft.token_id);
              
              // Check if it's a TORUS position
              if (position.token0.toLowerCase() === TORUS_ADDRESS.toLowerCase()) {
                const hasLiquidity = !position.liquidity.isZero();
                const hasClaimableFees = !position.tokensOwed0.isZero() || !position.tokensOwed1.isZero();
                
                allPositions.set(nft.token_id, {
                  tokenId: nft.token_id,
                  owner: address,
                  liquidity: ethers.utils.formatEther(position.liquidity),
                  claimableTorus: ethers.utils.formatEther(position.tokensOwed0),
                  claimableTitanX: ethers.utils.formatEther(position.tokensOwed1),
                  hasLiquidity: hasLiquidity,
                  hasClaimableFees: hasClaimableFees,
                  active: hasLiquidity || hasClaimableFees
                });
                
                foundCount++;
                console.log(`  ✅ Found TORUS position #${nft.token_id} (owner: ${address.substring(0, 10)}...)`);
              }
            } catch (err) {
              // Skip if can't get position details
            }
          }
        }
      } catch (error) {
        // Skip addresses with errors
      }

      // Limit to prevent timeout
      if (checked >= 50) {
        console.log('\n  (Limited search to 50 addresses to prevent timeout)');
        break;
      }
    }

    // Step 3: Also check known token IDs directly
    console.log('\n🎯 Checking known position IDs...');
    const knownTokenIds = ['1029195', '1030759', '1032346'];
    
    for (const tokenId of knownTokenIds) {
      if (!allPositions.has(tokenId)) {
        try {
          const owner = await positionManager.ownerOf(tokenId);
          const position = await positionManager.positions(tokenId);
          
          if (position.token0.toLowerCase() === TORUS_ADDRESS.toLowerCase()) {
            const hasLiquidity = !position.liquidity.isZero();
            const hasClaimableFees = !position.tokensOwed0.isZero() || !position.tokensOwed1.isZero();
            
            allPositions.set(tokenId, {
              tokenId: tokenId,
              owner: owner,
              liquidity: ethers.utils.formatEther(position.liquidity),
              claimableTorus: ethers.utils.formatEther(position.tokensOwed0),
              claimableTitanX: ethers.utils.formatEther(position.tokensOwed1),
              hasLiquidity: hasLiquidity,
              hasClaimableFees: hasClaimableFees,
              active: hasLiquidity || hasClaimableFees
            });
            
            console.log(`  ✅ Verified position #${tokenId}`);
          }
        } catch (err) {
          console.log(`  ❌ Error checking #${tokenId}`);
        }
      }
    }

    // Report findings
    const positionsArray = Array.from(allPositions.values());
    const activePositions = positionsArray.filter(p => p.active);
    const inactivePositions = positionsArray.filter(p => !p.active);

    console.log('\n📊 COMPLETE TORUS LP POSITION REPORT:\n');
    console.log(`Total TORUS positions found: ${positionsArray.length}`);
    console.log(`Active positions (with liquidity or fees): ${activePositions.length}`);
    console.log(`Inactive positions: ${inactivePositions.length}`);
    
    console.log('\n🟢 ACTIVE POSITIONS:');
    activePositions.forEach(pos => {
      console.log(`\nPosition #${pos.tokenId}`);
      console.log(`  Owner: ${pos.owner}`);
      console.log(`  Liquidity: ${parseFloat(pos.liquidity).toFixed(2)}`);
      if (pos.hasClaimableFees) {
        console.log(`  Claimable TORUS: ${parseFloat(pos.claimableTorus).toFixed(4)}`);
        console.log(`  Claimable TitanX: ${parseFloat(pos.claimableTitanX).toFixed(2)}`);
      }
    });

    if (inactivePositions.length > 0) {
      console.log('\n🔴 INACTIVE POSITIONS (no liquidity, no fees):');
      inactivePositions.forEach(pos => {
        console.log(`  #${pos.tokenId} - Owner: ${pos.owner.substring(0, 10)}...`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

findAllTorusLPs().catch(console.error);