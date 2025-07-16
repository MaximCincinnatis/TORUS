// Fix claimable yield by simulating collect() like Uniswap interface does
const fs = require('fs');
const { ethers } = require('ethers');

const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function collect(tuple(uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max)) returns (uint256 amount0, uint256 amount1)'
];

async function getClaimableBySimulation(provider, tokenId, owner) {
  try {
    // Create collect interface
    const collectInterface = new ethers.utils.Interface([
      'function collect(tuple(uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max)) returns (uint256 amount0, uint256 amount1)'
    ]);
    
    // Prepare collect parameters
    const collectParams = {
      tokenId: tokenId,
      recipient: owner,
      amount0Max: ethers.constants.MaxUint128,
      amount1Max: ethers.constants.MaxUint128
    };
    
    // Encode the function call
    const collectData = collectInterface.encodeFunctionData('collect', [collectParams]);
    
    // Simulate the collect call using eth_call
    const result = await provider.call({
      to: NFT_POSITION_MANAGER,
      data: collectData,
      from: owner // Must call from actual owner
    });
    
    // Decode the result
    const decoded = collectInterface.decodeFunctionResult('collect', result);
    
    return {
      claimableTorus: parseFloat(ethers.utils.formatEther(decoded.amount0)),
      claimableTitanX: parseFloat(ethers.utils.formatEther(decoded.amount1))
    };
    
  } catch (error) {
    console.error(`Error simulating collect for ${tokenId}:`, error.message);
    return { claimableTorus: 0, claimableTitanX: 0 };
  }
}

async function fixClaimableWithSimulation() {
  console.log('🔧 Fixing claimable yield using Uniswap collect() simulation...');
  
  const provider = new ethers.providers.JsonRpcProvider('https://1rpc.io/eth');
  const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  
  try {
    // Load cached data
    const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    
    console.log('\n📊 Simulating collect() for each position:');
    
    for (const cachedPos of cacheData.lpPositions) {
      try {
        // Get current owner
        const owner = await positionManager.ownerOf(cachedPos.tokenId);
        
        console.log(`\nPosition ${cachedPos.tokenId} (${owner.slice(0, 10)}...):`);
        
        // First show what tokensOwed says
        const position = await positionManager.positions(cachedPos.tokenId);
        const tokensOwed0 = parseFloat(ethers.utils.formatEther(position.tokensOwed0));
        const tokensOwed1 = parseFloat(ethers.utils.formatEther(position.tokensOwed1));
        
        console.log(`  tokensOwed: ${tokensOwed0.toFixed(6)} TORUS, ${tokensOwed1.toFixed(2)} TitanX`);
        
        // Now simulate collect to get actual claimable
        const simulated = await getClaimableBySimulation(provider, cachedPos.tokenId, owner);
        
        console.log(`  Simulated collect: ${simulated.claimableTorus.toFixed(6)} TORUS, ${simulated.claimableTitanX.toFixed(2)} TitanX`);
        
        // Update cached data with simulated amounts
        cachedPos.claimableTorus = simulated.claimableTorus;
        cachedPos.claimableTitanX = simulated.claimableTitanX;
        
        // Special attention to 32b6 positions
        if (owner.toLowerCase() === '0xce32e10b205fbf49f3bb7132f7378751af1832b6') {
          console.log(`  ⭐ This is the 32b6 position - ${cachedPos.inRange ? 'IN RANGE' : 'OUT OF RANGE'}`);
        }
        
        // Calculate APR if has claimable
        if (simulated.claimableTorus > 0 || simulated.claimableTitanX > 0) {
          const positionValueUSD = (cachedPos.amount0 * 0.00005) + (cachedPos.amount1 * 0.0000002);
          const claimableValueUSD = (simulated.claimableTorus * 0.00005) + (simulated.claimableTitanX * 0.0000002);
          
          // Assume 30 days accumulation
          const dailyYield = claimableValueUSD / 30;
          const apr = (dailyYield * 365 / positionValueUSD) * 100;
          
          cachedPos.estimatedAPR = Math.min(apr, 200);
          console.log(`  APR: ${cachedPos.estimatedAPR.toFixed(2)}%`);
        }
        
      } catch (e) {
        console.error(`Error processing position ${cachedPos.tokenId}:`, e.message);
      }
    }
    
    // Summary
    const totalClaimableTorus = cacheData.lpPositions.reduce((sum, p) => sum + (p.claimableTorus || 0), 0);
    const totalClaimableTitanX = cacheData.lpPositions.reduce((sum, p) => sum + (p.claimableTitanX || 0), 0);
    
    console.log('\n📊 Summary:');
    console.log(`Total claimable TORUS: ${totalClaimableTorus.toFixed(6)}`);
    console.log(`Total claimable TitanX: ${totalClaimableTitanX.toLocaleString('en-US')}`);
    
    // Save updated cache
    cacheData.lastUpdated = new Date().toISOString();
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cacheData, null, 2));
    
    console.log('\n✅ Fixed claimable yield using proper Uniswap simulation!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixClaimableWithSimulation().catch(console.error);