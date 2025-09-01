const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const TARGET = '0xCe32E10b205FBf49F3bB7132f7378751Af1832b6';

const ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
];

async function findAllNFTs() {
  const contract = new ethers.Contract(NFT_POSITION_MANAGER, ABI, provider);
  
  
  // Method 1: Get balance and enumerate
  try {
    const balance = await contract.balanceOf(TARGET);
    
    const torusPositions = [];
    
    for (let i = 0; i < balance; i++) {
      try {
        const tokenId = await contract.tokenOfOwnerByIndex(TARGET, i);
        
        const position = await contract.positions(tokenId);
        
        const isTorus = position.token0.toLowerCase() === '0xb47f575807fc5466285e1277ef8acfbb5c6686e8' &&
                       position.token1.toLowerCase() === '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1';
        
        if (isTorus) {
          
          const torus = Number(position.tokensOwed0) / 1e18;
          const titanx = Number(position.tokensOwed1) / 1e18;
          
          
          if (titanx > 38000000 && titanx < 40000000) {
          }
          
          torusPositions.push({
            tokenId: tokenId.toString(),
            liquidity: position.liquidity.toString(),
            tokensOwed0: position.tokensOwed0.toString(),
            tokensOwed1: position.tokensOwed1.toString(),
            claimableTorus: torus,
            claimableTitanX: titanx
          });
        } else {
        }
      } catch (err) {
      }
    }
    
    
    const totalTorus = torusPositions.reduce((sum, p) => sum + p.claimableTorus, 0);
    const totalTitanX = torusPositions.reduce((sum, p) => sum + p.claimableTitanX, 0);
    
    
  } catch (err) {
  }
}

findAllNFTs().catch(console.error);