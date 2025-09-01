const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';

// Using the exact ABI from Etherscan
const ABI = [
  {
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "positions",
    "outputs": [
      {"internalType": "uint96", "name": "nonce", "type": "uint96"},
      {"internalType": "address", "name": "operator", "type": "address"},
      {"internalType": "address", "name": "token0", "type": "address"},
      {"internalType": "address", "name": "token1", "type": "address"},
      {"internalType": "uint24", "name": "fee", "type": "uint24"},
      {"internalType": "int24", "name": "tickLower", "type": "int24"},
      {"internalType": "int24", "name": "tickUpper", "type": "int24"},
      {"internalType": "uint128", "name": "liquidity", "type": "uint128"},
      {"internalType": "uint256", "name": "feeGrowthInside0LastX128", "type": "uint256"},
      {"internalType": "uint256", "name": "feeGrowthInside1LastX128", "type": "uint256"},
      {"internalType": "uint128", "name": "tokensOwed0", "type": "uint128"},
      {"internalType": "uint128", "name": "tokensOwed1", "type": "uint128"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

async function directCheck() {
  const contract = new ethers.Contract(NFT_POSITION_MANAGER, ABI, provider);
  
  
  const positions = ['1029236', '1030051', '1031465'];
  
  for (const tokenId of positions) {
    
    try {
      // Call positions function directly
      const result = await contract.positions(tokenId);
      
      
      // Access by index as returned by the contract
      const tokensOwed0 = result[10]; // tokensOwed0 is at index 10
      const tokensOwed1 = result[11]; // tokensOwed1 is at index 11
      
      
      // Convert to human readable
      const torus = Number(tokensOwed0) / 1e18;
      const titanx = Number(tokensOwed1) / 1e18;
      
      
      if (titanx > 38000000 && titanx < 40000000) {
      }
      
      // Also check with alternate calculation in case there's precision loss
      const tokensOwed0BigInt = BigInt(tokensOwed0.toString());
      const tokensOwed1BigInt = BigInt(tokensOwed1.toString());
      
      
    } catch (err) {
    }
  }
}

directCheck().catch(console.error);