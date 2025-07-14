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
  
  console.log('Direct check of TORUS positions for 0xCe32E10b205FBf49F3bB7132f7378751Af1832b6\n');
  
  const positions = ['1029236', '1030051', '1031465'];
  
  for (const tokenId of positions) {
    console.log(`\n=== TOKEN ID ${tokenId} ===`);
    
    try {
      // Call positions function directly
      const result = await contract.positions(tokenId);
      
      console.log('Raw result:', result);
      
      // Access by index as returned by the contract
      const tokensOwed0 = result[10]; // tokensOwed0 is at index 10
      const tokensOwed1 = result[11]; // tokensOwed1 is at index 11
      
      console.log(`\nParsed values:`);
      console.log(`tokensOwed0 (raw): ${tokensOwed0.toString()}`);
      console.log(`tokensOwed1 (raw): ${tokensOwed1.toString()}`);
      
      // Convert to human readable
      const torus = Number(tokensOwed0) / 1e18;
      const titanx = Number(tokensOwed1) / 1e18;
      
      console.log(`\nHuman readable:`);
      console.log(`TORUS: ${torus.toFixed(6)}`);
      console.log(`TitanX: ${titanx.toFixed(2)} (${(titanx / 1e6).toFixed(2)}M)`);
      
      if (titanx > 38000000 && titanx < 40000000) {
        console.log('\n🎯 FOUND THE 39M TITANX POSITION!');
      }
      
      // Also check with alternate calculation in case there's precision loss
      const tokensOwed0BigInt = BigInt(tokensOwed0.toString());
      const tokensOwed1BigInt = BigInt(tokensOwed1.toString());
      
      console.log(`\nBigInt calculation:`);
      console.log(`tokensOwed0: ${tokensOwed0BigInt.toString()}`);
      console.log(`tokensOwed1: ${tokensOwed1BigInt.toString()}`);
      
    } catch (err) {
      console.error(`Error checking ${tokenId}:`, err);
    }
  }
}

directCheck().catch(console.error);