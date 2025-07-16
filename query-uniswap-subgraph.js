const axios = require('axios');

// Try new Graph Network endpoint
const UNISWAP_SUBGRAPH_URL = 'https://gateway.thegraph.com/api/[api-key]/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFZ';

// Fallback to try different endpoints
const FALLBACK_URLS = [
  'https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-subgraph',
  'https://api.uniswap.org/v1/pools'
];
const TORUS_POOL_ADDRESS = '0x7ff1f30f6e7eec2ff3f0d1b60739115bdf88190f';

async function queryTORUSPositions() {
  console.log('🔍 Querying Uniswap Subgraph for TORUS LP positions...\n');
  
  const query = `
    query getTORUSPositions {
      positions(
        where: {
          pool: "${TORUS_POOL_ADDRESS.toLowerCase()}"
          liquidity_gt: "0"
        }
        orderBy: liquidity
        orderDirection: desc
        first: 100
      ) {
        id
        owner
        liquidity
        depositedToken0
        depositedToken1
        withdrawnToken0
        withdrawnToken1
        collectedFeesToken0
        collectedFeesToken1
        feeGrowthInside0LastX128
        feeGrowthInside1LastX128
        tickLower {
          tickIdx
        }
        tickUpper {
          tickIdx
        }
        pool {
          token0 {
            symbol
            id
          }
          token1 {
            symbol
            id
          }
        }
        transaction {
          timestamp
          blockNumber
        }
      }
    }
  `;
  
  try {
    console.log('📡 Sending GraphQL query to Uniswap Subgraph...');
    const response = await axios.post(UNISWAP_SUBGRAPH_URL, {
      query: query
    });
    
    if (response.data.errors) {
      console.error('❌ GraphQL errors:', response.data.errors);
      return;
    }
    
    const positions = response.data.data.positions;
    console.log(`✅ Found ${positions.length} TORUS LP positions with active liquidity!\n`);
    
    positions.forEach((position, i) => {
      console.log(`${i + 1}. Position ID: ${position.id}`);
      console.log(`   Owner: ${position.owner}`);
      console.log(`   Liquidity: ${position.liquidity}`);
      console.log(`   Token0 Deposited: ${position.depositedToken0} ${position.pool.token0.symbol}`);
      console.log(`   Token1 Deposited: ${position.depositedToken1} ${position.pool.token1.symbol}`);
      console.log(`   Tick Range: ${position.tickLower.tickIdx} to ${position.tickUpper.tickIdx}`);
      console.log(`   Created: Block ${position.transaction.blockNumber}, ${new Date(position.transaction.timestamp * 1000).toISOString()}`);
      console.log(`   Collected Fees: ${position.collectedFeesToken0} ${position.pool.token0.symbol}, ${position.collectedFeesToken1} ${position.pool.token1.symbol}`);
      console.log('');
    });
    
    // Extract unique owners
    const uniqueOwners = [...new Set(positions.map(p => p.owner))];
    console.log(`📊 Summary:`);
    console.log(`   Total active positions: ${positions.length}`);
    console.log(`   Unique owners: ${uniqueOwners.length}`);
    console.log(`   Pool: ${position.pool.token0.symbol}/${position.pool.token1.symbol}`);
    
    console.log(`\n👥 Position owners:`);
    uniqueOwners.forEach((owner, i) => {
      const ownerPositions = positions.filter(p => p.owner === owner);
      console.log(`   ${i + 1}. ${owner} (${ownerPositions.length} position${ownerPositions.length > 1 ? 's' : ''})`);
    });
    
    return positions;
    
  } catch (error) {
    console.error('❌ Error querying subgraph:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    console.log('\n🔄 Fallback: Will need to use RPC method with block range...');
    return null;
  }
}

queryTORUSPositions().catch(console.error);