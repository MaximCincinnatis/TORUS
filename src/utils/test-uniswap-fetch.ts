import { fetchPoolData, fetchLPPositions } from './uniswapV3';

async function testFetch() {
  
  // Test pool data fetch
  const poolData = await fetchPoolData();
  if (poolData) {
  } else {
  }
  
  const positions = await fetchLPPositions(5, 0); // Fetch first 5 positions
  
  if (positions.length > 0) {
    positions.forEach((pos, index) => {
    });
  } else {
  }
}

testFetch().catch(console.error);