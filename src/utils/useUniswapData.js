const { ethers } = require('ethers');

// Option 1: Uniswap V3 Subgraph
const UNISWAP_V3_SUBGRAPH = 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3';

// Option 2: Uniswap's Position Viewer contract (if deployed on mainnet)
const POSITION_VIEWER = '0x91ae842A5Ffd8d12023116943e72A606179294f3'; // Example address

async function getPositionFromSubgraph(tokenId) {
  console.log(`\nFetching position ${tokenId} from Uniswap Subgraph...`);
  
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
    console.log('Subgraph response:', JSON.stringify(data, null, 2));
    
    if (data.data && data.data.position) {
      const position = data.data.position;
      console.log('\n✅ Found position data from Uniswap subgraph!');
      console.log(`Owner: ${position.owner}`);
      console.log(`Liquidity: ${position.liquidity}`);
      // The subgraph might have fee data we can use
    }
  } catch (error) {
    console.error('Subgraph error:', error);
  }
}

// Option 3: Use Uniswap's SDK
async function useUniswapSDK() {
  console.log('\nUniswap SDK options:');
  console.log('1. @uniswap/v3-sdk - Has Position class with fee calculation methods');
  console.log('2. @uniswap/sdk-core - Core utilities');
  console.log('3. @uniswap/smart-order-router - Can calculate position values');
  
  console.log('\nTo use Uniswap SDK:');
  console.log('npm install @uniswap/v3-sdk @uniswap/sdk-core');
  console.log('\nThen use Position.fromAmounts() or similar methods');
}

// Option 4: Call Uniswap's API directly
async function checkUniswapAPI() {
  // Uniswap might have a public API endpoint
  console.log('\nChecking for Uniswap API endpoints...');
  
  // The Uniswap interface likely uses their own API
  const possibleEndpoints = [
    'https://api.uniswap.org/v1/positions',
    'https://interface.gateway.uniswap.org/v1/positions',
    'https://app.uniswap.org/api/positions'
  ];
  
  console.log('Possible API endpoints to explore:');
  possibleEndpoints.forEach(endpoint => console.log(`- ${endpoint}`));
}

async function main() {
  console.log('=== Options for getting data from Uniswap ===\n');
  
  // Test subgraph
  await getPositionFromSubgraph('1031465');
  
  // Show SDK options
  await useUniswapSDK();
  
  // Check API options
  await checkUniswapAPI();
  
  console.log('\n🎯 BEST APPROACH:');
  console.log('Use @uniswap/v3-sdk which has the SAME fee calculation logic');
  console.log('that the Uniswap interface uses!');
}

main().catch(console.error);