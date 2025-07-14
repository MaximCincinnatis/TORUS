import { fetchPoolData, fetchLPPositions } from './uniswapV3';

async function testFetch() {
  console.log('Testing Uniswap V3 data fetching...\n');
  
  // Test pool data fetch
  console.log('1. Fetching pool data...');
  const poolData = await fetchPoolData();
  if (poolData) {
    console.log('✅ Pool data fetched successfully:');
    console.log(`   - Pool ID: ${poolData.id}`);
    console.log(`   - Current tick: ${poolData.tick}`);
    console.log(`   - Total Value Locked: $${parseFloat(poolData.totalValueLockedUSD).toLocaleString()}`);
  } else {
    console.log('❌ Failed to fetch pool data');
  }
  
  console.log('\n2. Fetching LP positions...');
  const positions = await fetchLPPositions(5, 0); // Fetch first 5 positions
  
  if (positions.length > 0) {
    console.log(`✅ Fetched ${positions.length} positions:`);
    positions.forEach((pos, index) => {
      console.log(`\n   Position ${index + 1}:`);
      console.log(`   - Owner: ${pos.owner}`);
      console.log(`   - Liquidity: ${pos.liquidity}`);
      console.log(`   - Token0 (${pos.token0.symbol}): ${pos.depositedToken0}`);
      console.log(`   - Token1 (${pos.token1.symbol}): ${pos.depositedToken1}`);
    });
  } else {
    console.log('❌ No positions found or error fetching');
  }
}

testFetch().catch(console.error);