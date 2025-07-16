// Restore the simple working approach - just use tokensOwed from Uniswap position contract
const fs = require('fs');
const { ethers } = require('ethers');

const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
];

async function restoreSimpleClaimable() {
  console.log('🔧 Restoring simple claimable yield from Uniswap positions...');
  
  const provider = new ethers.providers.JsonRpcProvider('https://1rpc.io/eth');
  const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  
  try {
    // Load cached data
    const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    
    // We know position 1029195 had claimable yield that was working
    // Let's check what the contract actually returns
    console.log('\n📊 Checking each position directly from Uniswap:');
    
    for (const cachedPos of cacheData.lpPositions) {
      try {
        // Get position data directly from Uniswap NFT Position Manager
        const position = await positionManager.positions(cachedPos.tokenId);
        
        console.log(`\nPosition ${cachedPos.tokenId}:`);
        console.log(`  Raw tokensOwed0: ${position.tokensOwed0.toString()}`);
        console.log(`  Raw tokensOwed1: ${position.tokensOwed1.toString()}`);
        
        // Convert to decimal - these are the claimable amounts
        const claimableTorus = parseFloat(ethers.utils.formatEther(position.tokensOwed0));
        const claimableTitanX = parseFloat(ethers.utils.formatEther(position.tokensOwed1));
        
        console.log(`  Claimable TORUS: ${claimableTorus.toFixed(6)}`);
        console.log(`  Claimable TitanX: ${claimableTitanX.toLocaleString('en-US')}`);
        
        // Update cached position
        cachedPos.claimableTorus = claimableTorus;
        cachedPos.claimableTitanX = claimableTitanX;
        
        // Special check for known positions
        if (cachedPos.tokenId === '1029195') {
          console.log('  ✅ This is the position that should have ~13.6 TORUS + 1.27B TitanX');
        }
        
        if (cachedPos.owner.toLowerCase() === '0xce32e10b205fbf49f3bb7132f7378751af1832b6') {
          console.log(`  ⭐ This is a 32b6 position - ${cachedPos.inRange ? 'IN RANGE' : 'OUT OF RANGE'}`);
          if (cachedPos.inRange && claimableTorus === 0 && claimableTitanX === 0) {
            console.log('  ⚠️  In-range but no claimable - might need uncollected fee calculation');
          }
        }
        
      } catch (e) {
        console.error(`Error checking position ${cachedPos.tokenId}:`, e.message);
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
    
    console.log('\n✅ Restored simple claimable yield!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

restoreSimpleClaimable().catch(console.error);