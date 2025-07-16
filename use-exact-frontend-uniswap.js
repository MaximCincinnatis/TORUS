// Use EXACT frontend code to fetch Uniswap data
const fs = require('fs');

// First, run the frontend code directly
const runFrontendCode = `
const { fetchLPPositionsFromEvents, getTokenInfo } = require('./src/utils/uniswapV3RealOwners');

async function fetchAndSaveUniswapData() {
  console.log('🚀 Using EXACT frontend code to fetch Uniswap data...');
  
  try {
    // Run EXACTLY what the frontend runs
    console.log('📊 Fetching LP positions using frontend method...');
    const positions = await fetchLPPositionsFromEvents();
    
    console.log('📊 Fetching token info...');
    const tokenInfo = await getTokenInfo();
    
    // Read current cache
    const cacheData = JSON.parse(require('fs').readFileSync('./public/data/cached-data.json', 'utf8'));
    
    // Update with REAL data from frontend
    cacheData.lpPositions = positions;
    
    if (tokenInfo && tokenInfo.poolData) {
      cacheData.poolData = tokenInfo.poolData;
    }
    
    console.log('\\n📊 RESULTS:');
    console.log(\`  Found \${positions.length} LP positions\`);
    console.log(\`  In-range positions: \${positions.filter(p => p.inRange).length}\`);
    console.log(\`  Out-of-range positions: \${positions.filter(p => !p.inRange).length}\`);
    console.log(\`  Positions with claimable fees: \${positions.filter(p => p.claimableTorus > 0 || p.claimableTitanX > 0).length}\`);
    
    positions.forEach((pos, i) => {
      console.log(\`\\n  Position \${i + 1}:\`);
      console.log(\`    Owner: \${pos.owner}\`);
      console.log(\`    Token ID: \${pos.tokenId || 'N/A'}\`);
      console.log(\`    TORUS: \${pos.amount0.toFixed(2)}\`);
      console.log(\`    TitanX: \${pos.amount1.toFixed(2)}\`);
      console.log(\`    In Range: \${pos.inRange ? '✅' : '❌'}\`);
      console.log(\`    Claimable TORUS: \${pos.claimableTorus?.toFixed(4) || '0'}\`);
      console.log(\`    Claimable TitanX: \${pos.claimableTitanX?.toFixed(2) || '0'}\`);
      console.log(\`    APR: \${pos.estimatedAPR?.toFixed(2) || '0'}%\`);
    });
    
    // Save to cache
    require('fs').writeFileSync(
      './public/data/cached-data.json',
      JSON.stringify(cacheData, null, 2)
    );
    
    console.log('\\n✅ Cache updated with REAL Uniswap data from frontend!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fetchAndSaveUniswapData();
`;

// Create a temporary file to run the frontend code
fs.writeFileSync('./run-frontend-uniswap.js', runFrontendCode);

console.log('Created script to run EXACT frontend code.');
console.log('Run: node run-frontend-uniswap.js');