const { ethers } = require('ethers');

// Option 1: Uniswap V3 Subgraph
const UNISWAP_V3_SUBGRAPH = 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3';

// Option 2: Uniswap's Position Viewer contract (if deployed on mainnet)
const POSITION_VIEWER = '0x91ae842A5Ffd8d12023116943e72A606179294f3'; // Example address

async function getPositionFromSubgraph(tokenId) {
  
  const query = `
    {
      position(id: "${tokenId}") {
        id
        owner
        liquidity
        token0 {
          symbol
          decimals
        }
        token1 {
          symbol
          decimals
        }
        collectedFeesToken0
        collectedFeesToken1
        feeGrowthInside0LastX128
        feeGrowthInside1LastX128
        pool {
          token0Price
          token1Price
          feeGrowthGlobal0X128
          feeGrowthGlobal1X128
          tick
        }
        tickLower {
          tickIdx
          feeGrowthOutside0X128
          feeGrowthOutside1X128
        }
        tickUpper {
          tickIdx
          feeGrowthOutside0X128
          feeGrowthOutside1X128
        }
      }
    }
  `;
  
  try {
    const response = await fetch(UNISWAP_V3_SUBGRAPH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    
    const data = await response.json();
    
    if (data.data && data.data.position) {
      const position = data.data.position;
      // The subgraph might have fee data we can use
    }
  } catch (error) {
  }
}

// Option 3: Use Uniswap's SDK
async function useUniswapSDK() {
  
}

// Option 4: Call Uniswap's API directly
async function checkUniswapAPI() {
  // Uniswap might have a public API endpoint
  
  // The Uniswap interface likely uses their own API
  const possibleEndpoints = [
    'https://api.uniswap.org/v1/positions',
    'https://interface.gateway.uniswap.org/v1/positions',
    'https://app.uniswap.org/api/positions'
  ];
  
  possibleEndpoints.forEach(endpoint => /* console removed */);
}

async function main() {
  
  // Test subgraph
  await getPositionFromSubgraph('1031465');
  
  // Show SDK options
  await useUniswapSDK();
  
  // Check API options
  await checkUniswapAPI();
  
}

main().catch(console.error);