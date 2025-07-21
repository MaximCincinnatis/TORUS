import { ethers } from 'ethers';
import { getProvider } from './ethersWeb3';
import { calculateTokenAmounts, isPositionInRange } from './uniswapV3Math';
import type { SimpleLPPosition } from './uniswapV3RealOwners';

const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';

// Pool ABI for the functions we need
const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() view returns (uint128)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
  'event Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)'
];


// Use the standard SimpleLPPosition from uniswapV3RealOwners
export type { SimpleLPPosition } from './uniswapV3RealOwners';

export async function getPoolInfo() {
  const provider = getProvider();
  const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
  
  try {
    const [slot0, totalLiquidity, token0Address, token1Address] = await Promise.all([
      poolContract.slot0(),
      poolContract.liquidity(),
      poolContract.token0(),
      poolContract.token1()
    ]);
    
    return {
      sqrtPriceX96: slot0.sqrtPriceX96.toString(),
      currentTick: slot0.tick,
      totalLiquidity: totalLiquidity.toString(),
      token0: token0Address,
      token1: token1Address
    };
  } catch (error) {
    console.error('Error fetching pool info:', error);
    throw error;
  }
}

export async function fetchLPPositionsFromEvents(fromBlock?: number): Promise<SimpleLPPosition[]> {
  const provider = getProvider();
  const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
  
  try {
    console.log('🔍 fetchLPPositionsFromEvents called - using Pool events approach');
    // Get current pool state
    const poolInfo = await getPoolInfo();
    console.log('Pool info retrieved:', poolInfo);
    const currentBlock = await provider.getBlockNumber();
    const startBlock = fromBlock || currentBlock - 50000; // Maximum RPC block range limit
    
    console.log(`Fetching Pool Mint events from block ${startBlock} to ${currentBlock}`);
    
    // Get Mint events from the pool
    const mintFilter = poolContract.filters.Mint();
    const mintEvents = await poolContract.queryFilter(mintFilter, startBlock, currentBlock);
    console.log(`Found ${mintEvents.length} Mint events`);
    
    // Get Burn events
    const burnFilter = poolContract.filters.Burn();
    const burnEvents = await poolContract.queryFilter(burnFilter, startBlock, currentBlock);
    console.log(`Found ${burnEvents.length} Burn events`);
    
    // Track positions by tick range (since we can't easily get individual NFT owners)
    const positions = new Map<string, SimpleLPPosition>();
    
    // Process Mint events
    console.log('Processing Mint events...');
    for (const event of mintEvents) {
      if ('args' in event && event.args) {
        // Use tick range as the key since all positions go through Position Manager
        const key = `${event.args.tickLower}-${event.args.tickUpper}`;
        
        console.log(`Mint event - Amount: ${event.args.amount}, Ticks: ${event.args.tickLower} to ${event.args.tickUpper}`);
        
        const existing = positions.get(key) || {
          tokenId: key, // Use the key as a pseudo-tokenId
          owner: 'Uniswap V3 Position Manager', // Since we can't easily track individual owners
          liquidity: '0',
          tickLower: event.args.tickLower,
          tickUpper: event.args.tickUpper,
          torusAmount: 0,
          titanxAmount: 0,
          inRange: false
        };
        
        // Add liquidity
        const newLiquidity = (BigInt(existing.liquidity) + BigInt(event.args.amount)).toString();
        positions.set(key, {
          ...existing,
          liquidity: newLiquidity
        });
      }
    }
    
    // Process Burn events
    console.log('Processing Burn events...');
    for (const event of burnEvents) {
      if ('args' in event && event.args) {
        const key = `${event.args.tickLower}-${event.args.tickUpper}`;
        const existing = positions.get(key);
        if (existing) {
          // Subtract liquidity
          const newLiquidity = BigInt(existing.liquidity) - BigInt(event.args.amount);
          if (newLiquidity > BigInt(0)) {
            positions.set(key, {
              ...existing,
              liquidity: newLiquidity.toString()
            });
          } else {
            positions.delete(key);
          }
        }
      }
    }
    
    // Calculate token amounts for active positions
    const activePositions: SimpleLPPosition[] = [];
    for (const position of positions.values()) {
      if (BigInt(position.liquidity) > BigInt(0)) {
        const amounts = calculateTokenAmounts(
          position.liquidity,
          poolInfo.sqrtPriceX96,
          position.tickLower,
          position.tickUpper,
          18, // Both tokens have 18 decimals
          18
        );
        
        // Determine which token is which based on pool configuration
        const token0IsTorus = poolInfo.token0.toLowerCase() === '0xb47f575807fc5466285e1277ef8acfbb5c6686e8'.toLowerCase();
        
        activePositions.push({
          ...position,
          torusAmount: token0IsTorus ? amounts.amount0 : amounts.amount1,
          titanxAmount: token0IsTorus ? amounts.amount1 : amounts.amount0,
          inRange: isPositionInRange(poolInfo.currentTick, position.tickLower, position.tickUpper)
        });
      }
    }
    
    console.log(`Processed ${activePositions.length} active LP positions`);
    if (activePositions.length > 0) {
      console.log('Sample position:', activePositions[0]);
    }
    
    return activePositions.sort((a, b) => 
      BigInt(b.liquidity) > BigInt(a.liquidity) ? 1 : -1
    );
  } catch (error) {
    console.error('Error fetching LP positions:', error);
    return [];
  }
}

// Determine which token is TORUS and which is TitanX
export async function getTokenInfo() {
  const provider = getProvider();
  const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
  
  const [token0, token1] = await Promise.all([
    poolContract.token0(),
    poolContract.token1()
  ]);
  
  // Known addresses
  const TORUS_ADDRESS = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
  const TITANX_ADDRESS = '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1';
  
  const token0Lower = token0.toLowerCase();
  const token1Lower = token1.toLowerCase();
  
  return {
    token0IsTorus: token0Lower === TORUS_ADDRESS.toLowerCase(),
    token0IsTitanX: token0Lower === TITANX_ADDRESS.toLowerCase(),
    token1IsTorus: token1Lower === TORUS_ADDRESS.toLowerCase(),
    token1IsTitanX: token1Lower === TITANX_ADDRESS.toLowerCase(),
    torusDecimals: 18,
    titanXDecimals: 18
  };
}