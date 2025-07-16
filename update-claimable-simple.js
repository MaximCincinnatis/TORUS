// Simple update for claimable fees - just use tokensOwed from contract
const fs = require('fs');
const { ethers } = require('ethers');

const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
];

async function updateClaimableSimple() {
  console.log('💰 Updating claimable fees from contract...');
  
  const provider = new ethers.providers.JsonRpcProvider('https://1rpc.io/eth');
  const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  
  try {
    // Load cached data
    const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    
    console.log('\n📊 Checking each position for claimable fees:');
    
    let totalPositionsWithFees = 0;
    
    for (const cachedPos of cacheData.lpPositions) {
      try {
        const position = await positionManager.positions(cachedPos.tokenId);
        
        // Get claimable amounts directly from tokensOwed
        const claimableTorus = parseFloat(ethers.utils.formatEther(position.tokensOwed0));
        const claimableTitanX = parseFloat(ethers.utils.formatEther(position.tokensOwed1));
        
        // Update cached position
        cachedPos.claimableTorus = claimableTorus;
        cachedPos.claimableTitanX = claimableTitanX;
        
        // Calculate simple APR if position has value
        if (cachedPos.amount0 > 0 && claimableTorus > 0) {
          // Assume fees accumulated over ~7 days
          const dailyYield = claimableTorus / 7 / cachedPos.amount0;
          cachedPos.estimatedAPR = Math.min(dailyYield * 365 * 100, 999);
        } else {
          cachedPos.estimatedAPR = 0;
        }
        
        if (claimableTorus > 0 || claimableTitanX > 0) {
          totalPositionsWithFees++;
          console.log(`\nPosition ${cachedPos.tokenId} (${cachedPos.owner.slice(0, 10)}...):`);
          console.log(`  Claimable TORUS: ${claimableTorus.toFixed(6)}`);
          console.log(`  Claimable TitanX: ${claimableTitanX.toLocaleString('en-US', {maximumFractionDigits: 2})}`);
          console.log(`  Position TORUS: ${cachedPos.amount0.toFixed(4)}`);
          console.log(`  APR: ${cachedPos.estimatedAPR.toFixed(2)}%`);
          
          // Show price in USD terms
          const torusValueUSD = claimableTorus * 0.00005; // ~$0.00005 per TORUS
          const titanXValueUSD = claimableTitanX * 0.0000002; // ~$200 per 1B TitanX
          const totalValueUSD = torusValueUSD + titanXValueUSD;
          console.log(`  Value: $${totalValueUSD.toFixed(2)} (TORUS: $${torusValueUSD.toFixed(2)}, TitanX: $${titanXValueUSD.toFixed(2)})`);
        }
        
      } catch (e) {
        console.error(`Error updating position ${cachedPos.tokenId}:`, e.message);
      }
    }
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`Positions with claimable fees: ${totalPositionsWithFees}`);
    
    const totalClaimableTorus = cacheData.lpPositions.reduce((sum, p) => sum + (p.claimableTorus || 0), 0);
    const totalClaimableTitanX = cacheData.lpPositions.reduce((sum, p) => sum + (p.claimableTitanX || 0), 0);
    
    console.log(`Total claimable TORUS: ${totalClaimableTorus.toFixed(6)}`);
    console.log(`Total claimable TitanX: ${totalClaimableTitanX.toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    
    // Value in USD
    const totalTorusUSD = totalClaimableTorus * 0.00005;
    const totalTitanXUSD = totalClaimableTitanX * 0.0000002;
    console.log(`Total value: $${(totalTorusUSD + totalTitanXUSD).toFixed(2)}`);
    
    // Save updated cache
    cacheData.lastUpdated = new Date().toISOString();
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cacheData, null, 2));
    
    console.log('\n✅ Claimable fees updated!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

updateClaimableSimple().catch(console.error);