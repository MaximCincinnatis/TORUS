import { ethers } from 'ethers';
import { getProvider } from './ethersWeb3';

// Uniswap uses a helper contract called NonfungiblePositionManager
// The key is that we need to calculate uncollected fees, not just read tokensOwed

const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';

// The QuoterV2 contract can calculate exact amounts including fees
const QUOTER_V2 = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';

// Multicall3 for batch queries
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function ownerOf(uint256 tokenId) view returns (address)'
];

// This is the key - Uniswap interface likely simulates a collect call
const COLLECT_ABI = [
  'function collect(tuple(uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max)) external payable returns (uint256 amount0, uint256 amount1)'
];

export interface PositionWithFees {
  tokenId: string;
  owner: string;
  liquidity: string;
  tickLower: number;
  tickUpper: number;
  amount0: number;
  amount1: number;
  claimableTorus: number;
  claimableTitanX: number;
  inRange: boolean;
}

export async function getUniswapPositionFees(tokenId: string): Promise<PositionWithFees | null> {
  const provider = getProvider();
  const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  
  try {
    
    // Get position data
    const [position, owner] = await Promise.all([
      positionManager.positions(tokenId),
      positionManager.ownerOf(tokenId)
    ]);
    
    // The trick is to use eth_call to simulate a collect transaction
    // This will calculate the exact fees that would be collected
    const collectInterface = new ethers.utils.Interface(COLLECT_ABI);
    
    const collectParams = {
      tokenId: tokenId,
      recipient: owner, // doesn't matter for simulation
      amount0Max: ethers.constants.MaxUint256,
      amount1Max: ethers.constants.MaxUint256
    };
    
    // Encode the collect function call
    const collectData = collectInterface.encodeFunctionData('collect', [collectParams]);
    
    try {
      // Simulate the collect call
      const result = await provider.call({
        to: NFT_POSITION_MANAGER,
        data: collectData,
        from: owner // Important: call from the actual owner
      });
      
      // Decode the result
      const decoded = collectInterface.decodeFunctionResult('collect', result);
      const collectable0 = decoded.amount0;
      const collectable1 = decoded.amount1;
      
      
      // This should match what Uniswap shows!
      return {
        tokenId,
        owner,
        liquidity: position.liquidity.toString(),
        tickLower: Number(position.tickLower),
        tickUpper: Number(position.tickUpper),
        amount0: 0, // We'd need to calculate position amounts separately
        amount1: 0,
        claimableTorus: Number(ethers.utils.formatUnits(collectable0, 18)),
        claimableTitanX: Number(ethers.utils.formatUnits(collectable1, 18)),
        inRange: true // We'd need pool data to determine this
      };
      
    } catch (callError) {
      
      // Fallback to just tokensOwed
      return {
        tokenId,
        owner,
        liquidity: position.liquidity.toString(),
        tickLower: Number(position.tickLower),
        tickUpper: Number(position.tickUpper),
        amount0: 0,
        amount1: 0,
        claimableTorus: Number(ethers.utils.formatUnits(position.tokensOwed0, 18)),
        claimableTitanX: Number(ethers.utils.formatUnits(position.tokensOwed1, 18)),
        inRange: true
      };
    }
    
  } catch (error) {
    return null;
  }
}

// Test function
export async function testPositionFees() {
  
  const positions = ['1029236', '1030051', '1031465'];
  
  for (const tokenId of positions) {
    const fees = await getUniswapPositionFees(tokenId);
    if (fees) {
      
      if (fees.claimableTitanX > 38000000 && fees.claimableTitanX < 40000000) {
      }
    }
  }
}