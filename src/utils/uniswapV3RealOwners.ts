import { ethers } from 'ethers';
import { getProvider } from './ethersWeb3';
import { calculateTokenAmounts, isPositionInRange } from './uniswapV3Math';
import { findAllPositionsForAddress } from './findAllPositionsForAddress';

const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';

const POOL_ABI = [
  'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
];

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
];

export interface SimpleLPPosition {
  tokenId: string;
  owner: string;
  liquidity: string;
  tickLower: number;
  tickUpper: number;
  torusAmount: number;  // Standard field - required
  titanxAmount: number; // Standard field - required
  inRange: boolean;
  isActive: boolean;     // Whether the position has liquidity and is active
  // Optional enhanced fields
  claimableTorus?: number;
  claimableTitanX?: number;
  estimatedAPR?: number;
  priceRange?: string;
  // Legacy fields for backward compatibility (deprecated)
  amount0?: number;
  amount1?: number;
}

// Fallback approach: Try checking known NFT token IDs directly
async function tryDirectNFTApproach(positionManager: any, poolInfo: any): Promise<SimpleLPPosition[]> {
  const positions: SimpleLPPosition[] = [];
  
  // Try checking token IDs in a reasonable range
  // Most Uniswap V3 positions are created sequentially
  const provider = getProvider();
  const currentBlock = await provider.getBlockNumber();
  
  // Try to find recent NFT positions (last 50 token IDs)
  for (let i = 0; i < 50; i++) {
    try {
      // We'll try some common token ID ranges
      const tokenIds = [
        currentBlock - i, // Recent blocks as token IDs
        500000 + i,       // Mid-range token IDs
        600000 + i,       // Higher range
        100000 + i        // Lower range
      ];
      
      for (const tokenId of tokenIds) {
        try {
          const positionData = await positionManager.positions(tokenId);
          
          // Check if this NFT position is for our TORUS pool
          const isTORUSPool = (
            (positionData.token0.toLowerCase() === '0xb47f575807fc5466285e1277ef8acfbb5c6686e8') && // TORUS
            (positionData.token1.toLowerCase() === '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1')    // TitanX
          );
          
          if (isTORUSPool && positionData.liquidity > 0) {
            const realOwner = await positionManager.ownerOf(tokenId);
            
            // Calculate token amounts
            const amounts = calculateTokenAmounts(
              positionData.liquidity.toString(),
              poolInfo.sqrtPriceX96,
              positionData.tickLower,
              positionData.tickUpper,
              18, 18
            );
            
            // Determine which token is which based on pool configuration
            const token0IsTorus = poolInfo.token0.toLowerCase() === '0xb47f575807fc5466285e1277ef8acfbb5c6686e8'.toLowerCase();
            
            positions.push({
              tokenId: tokenId.toString(),
              owner: realOwner,
              liquidity: positionData.liquidity.toString(),
              tickLower: positionData.tickLower,
              tickUpper: positionData.tickUpper,
              torusAmount: token0IsTorus ? amounts.amount0 : amounts.amount1,
              titanxAmount: token0IsTorus ? amounts.amount1 : amounts.amount0,
              inRange: isPositionInRange(poolInfo.currentTick, positionData.tickLower, positionData.tickUpper),
              isActive: positionData.liquidity > 0
            });
          }
        } catch (error) {
          // Token ID doesn't exist or not readable, continue
          continue;
        }
      }
    } catch (error) {
      // Continue trying other ranges
      continue;
    }
  }
  
  return positions;
}

export async function getPoolInfo() {
  const provider = getProvider();
  const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
  
  try {
    const [slot0, token0Address, token1Address] = await Promise.all([
      poolContract.slot0(),
      poolContract.token0(),
      poolContract.token1()
    ]);
    
    return {
      sqrtPriceX96: slot0.sqrtPriceX96.toString(),
      currentTick: slot0.tick,
      token0: token0Address,
      token1: token1Address
    };
  } catch (error) {
    throw error;
  }
}

// Debug function to test specific token IDs
async function debugSpecificPosition(tokenId: string, positionManager: any) {
  try {
    const owner = await positionManager.ownerOf(tokenId);
    const position = await positionManager.positions(tokenId);
    
    
    return { owner, position };
  } catch (error) {
    return null;
  }
}

export async function fetchLPPositionsFromEvents(): Promise<SimpleLPPosition[]> {
  const provider = getProvider();
  const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
  const positionManager = new ethers.Contract(NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
  
  try {
    
    // Test some known token IDs first
    await debugSpecificPosition('780889', positionManager);
    await debugSpecificPosition('797216', positionManager);
    await debugSpecificPosition('798833', positionManager);
    
    // Test finding ALL positions for the target address
    await findAllPositionsForAddress('0xCe32E10b205FBf49F3bB7132f7378751Af1832b6');
    
    try {
      const network = await provider.getNetwork();
    } catch (networkError) {
      throw networkError;
    }
    
    let poolInfo;
    try {
      poolInfo = await getPoolInfo();
    } catch (poolError) {
      throw poolError;
    }
    
    const currentBlock = await provider.getBlockNumber();
    const startBlock = currentBlock - 50000; // Maximum RPC block range limit
    
    
    // Get Mint events from TORUS pool
    const mintFilter = poolContract.filters.Mint();
    const mintEvents = await poolContract.queryFilter(mintFilter, startBlock, currentBlock);
    
    if (mintEvents.length === 0) {
      
      // Try a smaller, more recent range
      const recentStartBlock = currentBlock - 10000;
      const recentMintEvents = await poolContract.queryFilter(mintFilter, recentStartBlock, currentBlock);
      
      if (recentMintEvents.length === 0) {
        
        // Fallback: Try to find positions by checking NFT token IDs directly
        // This is less efficient but may catch positions we missed
        const directPositions = await tryDirectNFTApproach(positionManager, poolInfo);
        return directPositions;
      }
      // Use recent events if found
      mintEvents.length = 0;
      mintEvents.push(...recentMintEvents);
    }
    
    // Track found positions by token ID to avoid duplicates
    const foundPositions = new Map<string, SimpleLPPosition>();
    
    // For each mint event, find the corresponding NFT position and real owner
    for (let i = 0; i < Math.min(mintEvents.length, 15); i++) {
      const mintEvent = mintEvents[i];
      if (!('args' in mintEvent) || !mintEvent.args) continue;
      
      const blockNumber = mintEvent.blockNumber;
      
      
      // Find IncreaseLiquidity events in nearby blocks
      const searchFromBlock = blockNumber - 2;
      const searchToBlock = blockNumber + 2;
      
      try {
        const increaseLiquidityFilter = positionManager.filters.IncreaseLiquidity();
        const increaseLiquidityEvents = await positionManager.queryFilter(
          increaseLiquidityFilter, 
          searchFromBlock, 
          searchToBlock
        );
        
        
        // Look for matching NFT positions
        for (const incEvent of increaseLiquidityEvents) {
          if (!('args' in incEvent) || !incEvent.args) continue;
          
          const tokenId = incEvent.args.tokenId.toString();
          
          try {
            const positionData = await positionManager.positions(tokenId);
            
            // Check if this NFT position is for our TORUS pool
            const isTORUSPool = (
              (positionData.token0.toLowerCase() === '0xb47f575807fc5466285e1277ef8acfbb5c6686e8') && // TORUS
              (positionData.token1.toLowerCase() === '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1')    // TitanX
            );
            
            // Check if tick ranges match
            const ticksMatch = (
              positionData.tickLower === mintEvent.args.tickLower &&
              positionData.tickUpper === mintEvent.args.tickUpper
            );
            
            if (isTORUSPool && ticksMatch && positionData.liquidity > 0) {
              // Get the REAL owner of the NFT
              const realOwner = await positionManager.ownerOf(tokenId);
              
              // Special debug for the address with known claimable yield
              if (realOwner.toLowerCase() === '0xce32e10b205fbf49f3bb7132f7378751af1832b6') {
              }
              
              
              // Calculate actual token amounts
              try {
                const amounts = calculateTokenAmounts(
                  positionData.liquidity.toString(),
                  poolInfo.sqrtPriceX96,
                  Number(positionData.tickLower),
                  Number(positionData.tickUpper),
                  18, // Both tokens have 18 decimals
                  18
                );
                
                
                // Calculate claimable fees by simulating a collect call
                // This is what Uniswap interface does to show accurate fees
                let claimableTorus = 0;
                let claimableTitanX = 0;
                
                try {
                  // Simulate collect to get actual claimable amounts
                  const collectInterface = new ethers.utils.Interface([
                    'function collect(tuple(uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max)) returns (uint256 amount0, uint256 amount1)'
                  ]);
                  
                  const collectParams = {
                    tokenId: tokenId,
                    recipient: realOwner,
                    amount0Max: '0xffffffffffffffffffffffffffffffff', // MaxUint128
                    amount1Max: '0xffffffffffffffffffffffffffffffff'  // MaxUint128
                  };
                  
                  const collectData = collectInterface.encodeFunctionData('collect', [collectParams]);
                  
                  const result = await provider.call({
                    to: NFT_POSITION_MANAGER,
                    data: collectData,
                    from: realOwner
                  });
                  
                  const decoded = collectInterface.decodeFunctionResult('collect', result);
                  claimableTorus = Number(ethers.utils.formatUnits(decoded.amount0, 18));
                  claimableTitanX = Number(ethers.utils.formatUnits(decoded.amount1, 18));
                  
                  
                } catch (err) {
                  // Fallback to tokensOwed if simulation fails
                  const tokensOwed0Str = positionData.tokensOwed0.toString();
                  const tokensOwed1Str = positionData.tokensOwed1.toString();
                  claimableTorus = parseFloat(tokensOwed0Str) / 1e18;
                  claimableTitanX = parseFloat(tokensOwed1Str) / 1e18;
                }
                
                
                
                // Determine which token is which based on pool configuration
                const token0IsTorus = poolInfo.token0.toLowerCase() === '0xb47f575807fc5466285e1277ef8acfbb5c6686e8'.toLowerCase();
                
                const position: SimpleLPPosition = {
                  tokenId,
                  owner: realOwner,
                  liquidity: positionData.liquidity.toString(),
                  tickLower: Number(positionData.tickLower),
                  tickUpper: Number(positionData.tickUpper),
                  torusAmount: token0IsTorus ? amounts.amount0 : amounts.amount1,
                  titanxAmount: token0IsTorus ? amounts.amount1 : amounts.amount0,
                  inRange: isPositionInRange(poolInfo.currentTick, Number(positionData.tickLower), Number(positionData.tickUpper)),
                  isActive: positionData.liquidity > 0,
                  claimableTorus,
                  claimableTitanX
                };
                
                foundPositions.set(tokenId, position);
                
              } catch (calcError) {
                // Still add position with basic info
                const position: SimpleLPPosition = {
                  tokenId,
                  owner: realOwner,
                  liquidity: positionData.liquidity.toString(),
                  tickLower: Number(positionData.tickLower),
                  tickUpper: Number(positionData.tickUpper),
                  torusAmount: 0,
                  titanxAmount: 0,
                  inRange: false,
                  isActive: positionData.liquidity > 0,
                  claimableTorus: 0,
                  claimableTitanX: 0
                };
                foundPositions.set(tokenId, position);
              }
            }
            
          } catch (error) {
            // Position might not exist or be readable
            continue;
          }
        }
        
      } catch (error) {
        // Skip blocks we can't read
        continue;
      }
    }
    
    const positions = Array.from(foundPositions.values());
    
    if (positions.length > 0) {
      const uniqueOwners = new Set(positions.map(p => p.owner));
      
      positions.forEach((pos, i) => {
      });
    } else {
    }
    
    return positions.sort((a, b) => 
      BigInt(b.liquidity) > BigInt(a.liquidity) ? 1 : -1
    );
    
  } catch (error) {
    
    // Try to provide more specific error info
    if (error instanceof Error) {
      if (error.message.includes('network')) {
      } else if (error.message.includes('timeout')) {
      } else if (error.message.includes('rate limit')) {
      } else if (error.message.includes('block range')) {
      }
    }
    
    return [];
  }
}

// Get token info to identify which is TORUS and which is TitanX  
export async function getTokenInfo() {
  // We already know from our analysis:
  // Token0 = TORUS (0xb47f575807fc5466285e1277ef8acfbb5c6686e8)
  // Token1 = TitanX (0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1)
  
  return {
    token0IsTorus: true,
    token0IsTitanX: false,
    token1IsTorus: false,  
    token1IsTitanX: true,
    torusDecimals: 18,
    titanXDecimals: 18
  };
}