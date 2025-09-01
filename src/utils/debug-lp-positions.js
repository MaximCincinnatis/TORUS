const { ethers } = require('ethers');

const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
const provider = new ethers.JsonRpcProvider('https://ethereum-rpc.publicnode.com');

const POOL_ABI = [
  'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
  'event Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
];

async function debugLPPositions() {
  
  try {
    const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 10000; // ~1.5 days
    
    
    // Get Mint events
    const mintFilter = poolContract.filters.Mint();
    const mintEvents = await poolContract.queryFilter(mintFilter, fromBlock, currentBlock);
    
    
    // Analyze mint events
    const uniqueSenders = new Set();
    const uniqueOwners = new Set();
    const positions = new Map();
    
    mintEvents.forEach((event, i) => {
      const sender = event.args.sender;
      const owner = event.args.owner;
      uniqueSenders.add(sender);
      uniqueOwners.add(owner);
      
      // Track positions by a key
      const key = `${sender}-${event.args.tickLower}-${event.args.tickUpper}`;
      const existing = positions.get(key) || { 
        sender, 
        owner,
        liquidity: BigInt(0),
        tickLower: event.args.tickLower,
        tickUpper: event.args.tickUpper,
        mintCount: 0
      };
      
      existing.liquidity += BigInt(event.args.amount);
      existing.mintCount++;
      positions.set(key, existing);
      
      if (i < 3) {
      }
    });
    
    
    // Get Burn events
    const burnFilter = poolContract.filters.Burn();
    const burnEvents = await poolContract.queryFilter(burnFilter, fromBlock, currentBlock);
    
    // Process burns
    burnEvents.forEach((event) => {
      const owner = event.args.owner;
      const key = `${owner}-${event.args.tickLower}-${event.args.tickUpper}`;
      const existing = positions.get(key);
      
      if (existing) {
        existing.liquidity -= BigInt(event.args.amount);
        if (existing.liquidity <= 0) {
          positions.delete(key);
        }
      }
    });
    
    // Show active positions
    const activePositions = Array.from(positions.values())
      .filter(p => p.liquidity > 0)
      .sort((a, b) => Number(b.liquidity - a.liquidity));
    
    
    activePositions.slice(0, 5).forEach((pos, i) => {
    });
    
    // Check if position manager is the owner
    const POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
    const positionManagerOwned = Array.from(uniqueOwners).filter(
      owner => owner.toLowerCase() === POSITION_MANAGER.toLowerCase()
    );
    
    
    // Get current pool state
    const slot0 = await poolContract.slot0();
    
  } catch (error) {
  }
}

debugLPPositions();