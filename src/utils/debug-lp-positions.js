const { ethers } = require('ethers');

const POOL_ADDRESS = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
const provider = new ethers.JsonRpcProvider('https://ethereum-rpc.publicnode.com');

const POOL_ABI = [
  'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
  'event Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
];

async function debugLPPositions() {
  console.log('=== DEBUGGING LP POSITIONS FOR TORUS/TITANX POOL ===');
  console.log('Pool address:', POOL_ADDRESS);
  console.log('');
  
  try {
    const poolContract = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 10000; // ~1.5 days
    
    console.log(`Fetching events from block ${fromBlock} to ${currentBlock}`);
    console.log('');
    
    // Get Mint events
    const mintFilter = poolContract.filters.Mint();
    const mintEvents = await poolContract.queryFilter(mintFilter, fromBlock, currentBlock);
    
    console.log(`Found ${mintEvents.length} Mint events`);
    
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
        console.log(`\nMint Event ${i + 1}:`);
        console.log(`  Sender: ${sender}`);
        console.log(`  Owner: ${owner}`);
        console.log(`  Amount: ${event.args.amount.toString()}`);
        console.log(`  Tick Range: ${event.args.tickLower} to ${event.args.tickUpper}`);
        console.log(`  Block: ${event.blockNumber}`);
      }
    });
    
    console.log(`\nUnique senders: ${uniqueSenders.size}`);
    console.log(`Unique owners: ${uniqueOwners.size}`);
    console.log('First 3 unique senders:', Array.from(uniqueSenders).slice(0, 3));
    console.log('First 3 unique owners:', Array.from(uniqueOwners).slice(0, 3));
    
    // Get Burn events
    const burnFilter = poolContract.filters.Burn();
    const burnEvents = await poolContract.queryFilter(burnFilter, fromBlock, currentBlock);
    console.log(`\nFound ${burnEvents.length} Burn events`);
    
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
    console.log(`\n=== ACTIVE POSITIONS (${positions.size} total) ===`);
    const activePositions = Array.from(positions.values())
      .filter(p => p.liquidity > 0)
      .sort((a, b) => Number(b.liquidity - a.liquidity));
    
    console.log(`Active positions with liquidity > 0: ${activePositions.length}`);
    
    activePositions.slice(0, 5).forEach((pos, i) => {
      console.log(`\nPosition ${i + 1}:`);
      console.log(`  Sender: ${pos.sender}`);
      console.log(`  Owner: ${pos.owner}`);
      console.log(`  Liquidity: ${pos.liquidity.toString()}`);
      console.log(`  Tick Range: ${pos.tickLower} to ${pos.tickUpper}`);
      console.log(`  Mint Count: ${pos.mintCount}`);
    });
    
    // Check if position manager is the owner
    const POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
    const positionManagerOwned = Array.from(uniqueOwners).filter(
      owner => owner.toLowerCase() === POSITION_MANAGER.toLowerCase()
    );
    
    console.log(`\n=== POSITION MANAGER CHECK ===`);
    console.log(`Position Manager address: ${POSITION_MANAGER}`);
    console.log(`Is Position Manager an owner? ${positionManagerOwned.length > 0}`);
    
    // Get current pool state
    const slot0 = await poolContract.slot0();
    console.log('\n=== CURRENT POOL STATE ===');
    console.log(`Current tick: ${slot0.tick}`);
    console.log(`Current sqrtPriceX96: ${slot0.sqrtPriceX96.toString()}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugLPPositions();