const { ethers } = require('ethers');

const CONTRACTS = {
  TORUS: '0xb47f575807fc5466285e1277ef8acfbb5c6686e8',
  TITANX: '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1',
  POOL: '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F',
  UNISWAP_FACTORY: '0x1F98431c8aD98523631AE4a59f267346ea31F984'
};

const FACTORY_ABI = [
  'event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)',
  'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)'
];

const POOL_ABI = [
  'event Initialize(uint160 sqrtPriceX96, int24 tick)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'
];

async function findPoolCreation() {
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const factory = new ethers.Contract(CONTRACTS.UNISWAP_FACTORY, FACTORY_ABI, provider);
  const pool = new ethers.Contract(CONTRACTS.POOL, POOL_ABI, provider);
  
  console.log('🔍 Finding TORUS pool creation details...\n');
  
  try {
    // First verify this is the correct pool
    const poolAddress = await factory.getPool(CONTRACTS.TORUS, CONTRACTS.TITANX, 10000);
    console.log(`✅ Pool address from factory: ${poolAddress}`);
    console.log(`✅ Expected pool address: ${CONTRACTS.POOL}`);
    console.log(`✅ Match: ${poolAddress.toLowerCase() === CONTRACTS.POOL.toLowerCase()}\n`);
    
    // Try to find PoolCreated event in recent blocks (limited by RPC)
    console.log('🔍 Searching for PoolCreated event...');
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current block: ${currentBlock}`);
    
    // Search in chunks due to RPC limitations
    const searchRanges = [
      { from: currentBlock - 10000, to: currentBlock, name: 'last 10k blocks' },
      { from: currentBlock - 50000, to: currentBlock - 10000, name: '10k-50k blocks ago' },
      { from: currentBlock - 100000, to: currentBlock - 50000, name: '50k-100k blocks ago' },
      { from: currentBlock - 200000, to: currentBlock - 100000, name: '100k-200k blocks ago' },
      { from: currentBlock - 500000, to: currentBlock - 200000, name: '200k-500k blocks ago' }
    ];
    
    let poolCreationBlock = null;
    
    for (const range of searchRanges) {
      try {
        console.log(`  Searching ${range.name} (${range.from} to ${range.to})...`);
        
        // Search for PoolCreated event
        const filter = factory.filters.PoolCreated(CONTRACTS.TORUS, CONTRACTS.TITANX, 10000);
        const events = await factory.queryFilter(filter, range.from, range.to);
        
        if (events.length > 0) {
          const event = events[0];
          poolCreationBlock = event.blockNumber;
          const block = await provider.getBlock(poolCreationBlock);
          
          console.log(`\n🎯 FOUND POOL CREATION!`);
          console.log(`   Block: ${poolCreationBlock}`);
          console.log(`   Date: ${new Date(block.timestamp * 1000).toISOString()}`);
          console.log(`   Transaction: ${event.transactionHash}`);
          break;
        }
      } catch (e) {
        if (e.message.includes('ranges over 10000 blocks')) {
          console.log(`    ❌ Range too large: ${e.message}`);
          // Try smaller chunks
          const chunkSize = 5000;
          for (let start = range.from; start < range.to; start += chunkSize) {
            const end = Math.min(start + chunkSize, range.to);
            try {
              console.log(`      Trying smaller chunk ${start}-${end}...`);
              const filter = factory.filters.PoolCreated(CONTRACTS.TORUS, CONTRACTS.TITANX, 10000);
              const events = await factory.queryFilter(filter, start, end);
              
              if (events.length > 0) {
                const event = events[0];
                poolCreationBlock = event.blockNumber;
                const block = await provider.getBlock(poolCreationBlock);
                
                console.log(`\n🎯 FOUND POOL CREATION!`);
                console.log(`   Block: ${poolCreationBlock}`);
                console.log(`   Date: ${new Date(block.timestamp * 1000).toISOString()}`);
                console.log(`   Transaction: ${event.transactionHash}`);
                break;
              }
            } catch (chunkError) {
              console.log(`      Chunk failed: ${chunkError.message}`);
            }
          }
          if (poolCreationBlock) break;
        } else {
          console.log(`    ❌ Search failed: ${e.message}`);
        }
      }
    }
    
    if (!poolCreationBlock) {
      console.log('\n⚠️  Could not find PoolCreated event in recent blocks');
      console.log('Pool might be older than our search range or use different approach');
      
      // Try to get pool initialization instead
      console.log('\n🔍 Searching for Initialize event...');
      
      for (const range of searchRanges.slice(0, 3)) { // Only try recent ranges
        try {
          console.log(`  Searching Initialize in ${range.name}...`);
          const initFilter = pool.filters.Initialize();
          const initEvents = await pool.queryFilter(initFilter, range.from, range.to);
          
          if (initEvents.length > 0) {
            const event = initEvents[0];
            const block = await provider.getBlock(event.blockNumber);
            
            console.log(`\n🎯 FOUND POOL INITIALIZATION!`);
            console.log(`   Block: ${event.blockNumber}`);
            console.log(`   Date: ${new Date(block.timestamp * 1000).toISOString()}`);
            console.log(`   Transaction: ${event.transactionHash}`);
            poolCreationBlock = event.blockNumber;
            break;
          }
        } catch (e) {
          console.log(`    ❌ Initialize search failed: ${e.message}`);
        }
      }
    }
    
    // If still no luck, estimate based on TORUS token creation
    if (!poolCreationBlock) {
      console.log('\n📅 Could not find exact creation block, estimating...');
      console.log('TORUS project likely launched in 2024, so pool created after block ~19000000');
      poolCreationBlock = 19000000; // Rough estimate for 2024
    }
    
    console.log(`\n📊 RECOMMENDED SEARCH RANGE:`);
    console.log(`   Start from block: ${poolCreationBlock}`);
    console.log(`   Current block: ${currentBlock}`);
    console.log(`   Total blocks to search: ${currentBlock - poolCreationBlock}`);
    console.log(`   This is much more reasonable than searching all 952k positions!\n`);
    
    // Additional Uniswap tools suggestion
    console.log('🛠️  OTHER UNISWAP TOOLS TO CONSIDER:');
    console.log('1. Uniswap Subgraph (GraphQL): https://thegraph.com/hosted-service/subgraph/uniswap/uniswap-v3');
    console.log('   - Query: positions where pool = TORUS/TitanX pool address');
    console.log('   - Much more efficient than RPC calls');
    console.log('2. Uniswap Labs API (if available)');
    console.log('3. Search Mint events in smaller 5k block chunks from pool creation forward');
    console.log('4. Use ethers.js event filters with specific pool address');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findPoolCreation().catch(console.error);