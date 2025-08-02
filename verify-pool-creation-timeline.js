const { ethers } = require('ethers');

// Contract addresses
const CONTRACTS = {
  TORUS: '0xb47f575807fc5466285e1277ef8acfbb5c6686e8',
  TITANX: '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1',
  POOL: '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F',
  UNISWAP_FACTORY: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  POSITION_MANAGER: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
};

// ABIs
const POOL_ABI = [
  'event Initialize(uint160 sqrtPriceX96, int24 tick)',
  'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'
];

const FACTORY_ABI = [
  'event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)'
];

// Working RPC providers
const WORKING_RPC_PROVIDERS = [
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.payload.de',
  'https://eth-mainnet.public.blastapi.io',
  'https://rpc.flashbots.net',
  'https://eth.drpc.org'
];

let currentProviderIndex = 0;

function getNextProvider() {
  const provider = new ethers.providers.JsonRpcProvider(WORKING_RPC_PROVIDERS[currentProviderIndex]);
  currentProviderIndex = (currentProviderIndex + 1) % WORKING_RPC_PROVIDERS.length;
  return provider;
}

async function findPoolInitialization() {
  console.log('🔍 TORUS/TITANX Pool Timeline Verification');
  console.log('==========================================\n');
  
  const provider = getNextProvider();
  const pool = new ethers.Contract(CONTRACTS.POOL, POOL_ABI, provider);
  const factory = new ethers.Contract(CONTRACTS.UNISWAP_FACTORY, FACTORY_ABI, provider);
  
  const currentBlock = await provider.getBlockNumber();
  console.log(`📊 Current block: ${currentBlock}`);
  console.log(`🎯 Pool address: ${CONTRACTS.POOL}\n`);
  
  // The block that's currently used as starting point
  const ASSUMED_START_BLOCK = 22890272;
  console.log(`⚡ Currently using block ${ASSUMED_START_BLOCK} as starting point`);
  
  try {
    // Get block timestamp for assumed start
    const assumedBlock = await provider.getBlock(ASSUMED_START_BLOCK);
    console.log(`📅 Block ${ASSUMED_START_BLOCK} timestamp: ${new Date(assumedBlock.timestamp * 1000).toISOString()}\n`);
    
    // Search for Initialize event
    console.log('🔍 Searching for pool Initialize event...');
    
    // Start searching from a reasonable range before the assumed block
    const searchStart = ASSUMED_START_BLOCK - 50000; // ~7 days before
    const searchEnd = ASSUMED_START_BLOCK + 10000;   // ~1.5 days after
    
    console.log(`📍 Searching blocks ${searchStart} to ${searchEnd}...`);
    
    // Search in chunks to avoid rate limits
    const chunkSize = 5000;
    let initializeBlock = null;
    let initializeEvent = null;
    
    for (let start = searchStart; start <= searchEnd; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, searchEnd);
      
      try {
        console.log(`  Checking blocks ${start}-${end}...`);
        const initFilter = pool.filters.Initialize();
        const events = await pool.queryFilter(initFilter, start, end);
        
        if (events.length > 0) {
          initializeEvent = events[0];
          initializeBlock = initializeEvent.blockNumber;
          break;
        }
      } catch (e) {
        if (e.message.includes('range') || e.message.includes('timeout')) {
          console.log(`  ⚠️  RPC error, switching provider...`);
          const newProvider = getNextProvider();
          pool._provider = newProvider;
          // Retry with smaller chunk
          const smallerChunkSize = 1000;
          for (let smallStart = start; smallStart <= end; smallStart += smallerChunkSize) {
            const smallEnd = Math.min(smallStart + smallerChunkSize - 1, end);
            try {
              const events = await pool.queryFilter(pool.filters.Initialize(), smallStart, smallEnd);
              if (events.length > 0) {
                initializeEvent = events[0];
                initializeBlock = initializeEvent.blockNumber;
                break;
              }
            } catch (smallError) {
              continue;
            }
          }
          if (initializeBlock) break;
        }
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    if (initializeBlock) {
      const initBlock = await provider.getBlock(initializeBlock);
      console.log(`\n✅ FOUND POOL INITIALIZATION!`);
      console.log(`   Block: ${initializeBlock}`);
      console.log(`   Date: ${new Date(initBlock.timestamp * 1000).toISOString()}`);
      console.log(`   Transaction: ${initializeEvent.transactionHash}`);
      console.log(`   Initial sqrtPriceX96: ${initializeEvent.args.sqrtPriceX96.toString()}`);
      console.log(`   Initial tick: ${initializeEvent.args.tick}`);
      
      // Check if assumed block is before initialization
      if (ASSUMED_START_BLOCK < initializeBlock) {
        console.log(`\n⚠️  WARNING: Currently using block ${ASSUMED_START_BLOCK} which is ${initializeBlock - ASSUMED_START_BLOCK} blocks BEFORE pool creation!`);
        console.log(`   This is actually GOOD - we're not missing any events.`);
      } else if (ASSUMED_START_BLOCK > initializeBlock) {
        console.log(`\n❌ CRITICAL: Currently using block ${ASSUMED_START_BLOCK} which is ${ASSUMED_START_BLOCK - initializeBlock} blocks AFTER pool creation!`);
        console.log(`   We might be missing early LP positions!`);
      } else {
        console.log(`\n✅ Perfect! Block ${ASSUMED_START_BLOCK} is exactly the pool initialization block.`);
      }
    } else {
      console.log('\n⚠️  Could not find Initialize event in searched range');
      console.log('   Pool might be older or newer than expected');
    }
    
    // Now search for first Mint events
    console.log('\n🔍 Searching for first Mint events (LP positions)...');
    
    const mintSearchStart = initializeBlock || ASSUMED_START_BLOCK - 10000;
    const mintSearchEnd = Math.min(mintSearchStart + 50000, currentBlock);
    
    console.log(`📍 Searching for Mints from block ${mintSearchStart} to ${mintSearchEnd}...`);
    
    const firstMints = [];
    const mintFilter = pool.filters.Mint();
    
    for (let start = mintSearchStart; start <= mintSearchEnd && firstMints.length < 10; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, mintSearchEnd);
      
      try {
        console.log(`  Checking blocks ${start}-${end}...`);
        const events = await pool.queryFilter(mintFilter, start, end);
        
        for (const event of events) {
          if (firstMints.length < 10) {
            const block = await provider.getBlock(event.blockNumber);
            firstMints.push({
              block: event.blockNumber,
              date: new Date(block.timestamp * 1000).toISOString(),
              tx: event.transactionHash,
              owner: event.args.owner,
              tickLower: event.args.tickLower,
              tickUpper: event.args.tickUpper,
              amount0: ethers.utils.formatUnits(event.args.amount0, 18),
              amount1: ethers.utils.formatUnits(event.args.amount1, 18)
            });
          }
        }
        
        if (events.length > 0) {
          console.log(`    Found ${events.length} Mint events`);
        }
      } catch (e) {
        console.log(`    ⚠️  Error: ${e.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    if (firstMints.length > 0) {
      console.log(`\n✅ Found ${firstMints.length} early Mint events:`);
      firstMints.forEach((mint, i) => {
        console.log(`\n  ${i + 1}. Block ${mint.block} (${mint.date})`);
        console.log(`     Owner: ${mint.owner}`);
        console.log(`     TORUS amount: ${parseFloat(mint.amount0).toFixed(2)}`);
        console.log(`     TITANX amount: ${parseFloat(mint.amount1).toFixed(2)}`);
        console.log(`     Ticks: [${mint.tickLower}, ${mint.tickUpper}]`);
        console.log(`     Tx: ${mint.tx}`);
      });
      
      const firstMintBlock = firstMints[0].block;
      if (ASSUMED_START_BLOCK > firstMintBlock) {
        console.log(`\n❌ CRITICAL: First Mint at block ${firstMintBlock}, but we start at ${ASSUMED_START_BLOCK}`);
        console.log(`   Missing ${ASSUMED_START_BLOCK - firstMintBlock} blocks of potential LP activity!`);
      } else {
        console.log(`\n✅ Good: We start at block ${ASSUMED_START_BLOCK}, first Mint at ${firstMintBlock}`);
        console.log(`   We're not missing any LP positions.`);
      }
    }
    
    // Final summary
    console.log('\n📊 SUMMARY');
    console.log('==========');
    console.log(`Current search start block: ${ASSUMED_START_BLOCK}`);
    if (initializeBlock) {
      console.log(`Pool initialization block: ${initializeBlock}`);
      console.log(`Difference: ${ASSUMED_START_BLOCK - initializeBlock} blocks`);
    }
    if (firstMints.length > 0) {
      console.log(`First LP position block: ${firstMints[0].block}`);
      console.log(`Difference from start: ${ASSUMED_START_BLOCK - firstMints[0].block} blocks`);
    }
    
    console.log('\n📋 RECOMMENDATIONS:');
    if (initializeBlock && ASSUMED_START_BLOCK > initializeBlock) {
      console.log(`❌ Update DEPLOYMENT_BLOCK and POOL_CREATION_BLOCK to ${initializeBlock} or earlier`);
    } else {
      console.log(`✅ Current block ${ASSUMED_START_BLOCK} is safe to use`);
    }
    
    // Check recent activity
    console.log('\n🔍 Checking recent pool activity...');
    const recentBlock = currentBlock - 100;
    const recentEvents = await pool.queryFilter(mintFilter, recentBlock, currentBlock);
    console.log(`Found ${recentEvents.length} Mint events in last 100 blocks`);
    
    // Get current pool state
    const slot0 = await pool.slot0();
    console.log('\n📊 Current pool state:');
    console.log(`   Current tick: ${slot0.tick}`);
    console.log(`   Current price: ${Math.pow(1.0001, slot0.tick).toFixed(6)} TITANX per TORUS`);
    
  } catch (error) {
    console.error('\n❌ Error during verification:', error.message);
  }
}

// Run the verification
findPoolInitialization().catch(console.error);