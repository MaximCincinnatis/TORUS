const axios = require('axios');
const { ethers } = require('ethers');
require('dotenv').config();

const MORALIS_API_KEY = process.env.MORALIS_API_KEY;
const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const TORUS_ADDRESS = '0xB47f575807fC5466285e1277Ef8aCFBB5c6686E8';

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
];

async function findActiveTorusLPs() {
  console.log('🔍 Searching for active TORUS LP positions with Moralis...\n');

  const headers = {
    'X-API-Key': MORALIS_API_KEY,
    'Content-Type': 'application/json'
  };

  const provider = new ethers.providers.JsonRpcProvider('https://1rpc.io/eth');
  const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);

  const activePositions = [];

  try {
    // Start with known LP addresses
    const knownLPHolders = [
      '0xAa390a37006E22b5775A34f2147F81eBD6a63641', // Buy & Process
      '0x9BBb45e12c4a75f7406Cb38e858Fa6C68A88f30d',
      '0x16221e4ea7B456C7083A29d43b452F7b6edA2466',
      '0xCe32E10b205FBf49F3bB7132f7378751Af1832b6'
    ];

    for (const address of knownLPHolders) {
      console.log(`Checking ${address}...`);
      
      try {
        const response = await axios.get(
          `https://deep-index.moralis.io/api/v2.2/${address}/nft`,
          { 
            headers,
            params: {
              chain: 'eth',
              token_addresses: [NFT_POSITION_MANAGER],
              limit: 50
            }
          }
        );

        if (response.data.result && response.data.result.length > 0) {
          console.log(`  Found ${response.data.result.length} Uniswap V3 NFTs`);
          
          for (const nft of response.data.result) {
            try {
              const position = await positionManager.positions(nft.token_id);
              
              // Check if it's a TORUS position
              if (position.token0.toLowerCase() === TORUS_ADDRESS.toLowerCase()) {
                const hasLiquidity = !position.liquidity.isZero();
                const hasClaimableFees = !position.tokensOwed0.isZero() || !position.tokensOwed1.isZero();
                
                if (hasLiquidity || hasClaimableFees) {
                  activePositions.push({
                    tokenId: nft.token_id,
                    owner: address,
                    liquidity: ethers.utils.formatEther(position.liquidity),
                    claimableTorus: ethers.utils.formatEther(position.tokensOwed0),
                    claimableTitanX: ethers.utils.formatEther(position.tokensOwed1),
                    active: hasLiquidity
                  });
                  
                  console.log(`  ✅ Active TORUS position #${nft.token_id}`);
                }
              }
            } catch (err) {
              // Skip if can't get position details
            }
          }
        }
      } catch (error) {
        console.log(`  Error: ${error.response?.data?.message || error.message}`);
      }
    }

    // Also check recent transfers to find more addresses
    console.log('\nChecking recent Uniswap V3 transfers...');
    try {
      const transfersResponse = await axios.get(
        `https://deep-index.moralis.io/api/v2.2/nft/${NFT_POSITION_MANAGER}/transfers`,
        { 
          headers,
          params: {
            chain: 'eth',
            limit: 100
          }
        }
      );

      if (transfersResponse.data.result) {
        const checkedTokens = new Set(activePositions.map(p => p.tokenId));
        let additionalFound = 0;
        
        for (const transfer of transfersResponse.data.result) {
          if (!checkedTokens.has(transfer.token_id) && additionalFound < 10) {
            try {
              const position = await positionManager.positions(transfer.token_id);
              
              if (position.token0.toLowerCase() === TORUS_ADDRESS.toLowerCase()) {
                const hasLiquidity = !position.liquidity.isZero();
                const hasClaimableFees = !position.tokensOwed0.isZero() || !position.tokensOwed1.isZero();
                
                if (hasLiquidity || hasClaimableFees) {
                  activePositions.push({
                    tokenId: transfer.token_id,
                    owner: transfer.to_address,
                    liquidity: ethers.utils.formatEther(position.liquidity),
                    claimableTorus: ethers.utils.formatEther(position.tokensOwed0),
                    claimableTitanX: ethers.utils.formatEther(position.tokensOwed1),
                    active: hasLiquidity
                  });
                  
                  additionalFound++;
                  console.log(`  ✅ Found additional active position #${transfer.token_id}`);
                }
              }
            } catch (err) {
              // Skip
            }
          }
        }
      }
    } catch (error) {
      console.log(`  Transfer search error: ${error.response?.data?.message || error.message}`);
    }

    // Report findings
    console.log('\n📊 ACTIVE TORUS LP POSITIONS FOUND:\n');
    console.log(`Total active positions: ${activePositions.length}`);
    console.log(`Positions with liquidity: ${activePositions.filter(p => p.active).length}`);
    console.log(`Positions with only fees: ${activePositions.filter(p => !p.active).length}`);
    
    console.log('\nDetails:');
    activePositions.forEach(pos => {
      console.log(`\nPosition #${pos.tokenId}`);
      console.log(`  Owner: ${pos.owner}`);
      console.log(`  Liquidity: ${parseFloat(pos.liquidity).toFixed(2)}`);
      console.log(`  Claimable TORUS: ${parseFloat(pos.claimableTorus).toFixed(4)}`);
      console.log(`  Claimable TitanX: ${parseFloat(pos.claimableTitanX).toFixed(2)}`);
      console.log(`  Status: ${pos.active ? 'ACTIVE' : 'FEES ONLY'}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

findActiveTorusLPs().catch(console.error);