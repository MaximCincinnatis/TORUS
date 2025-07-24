const { ethers } = require('ethers');

async function findDay14Blocks() {
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  
  // Day 14 timestamps
  const day14Start = new Date('2025-07-23T00:00:00Z').getTime() / 1000;
  const day14End = new Date('2025-07-24T00:00:00Z').getTime() / 1000;
  
  console.log('Finding blocks for Day 14 (July 23, 2025)...');
  console.log(`Target timestamps: ${day14Start} to ${day14End}`);
  
  // Get current block
  const currentBlock = await provider.getBlockNumber();
  const currentBlockData = await provider.getBlock(currentBlock);
  console.log(`\nCurrent block: ${currentBlock}`);
  console.log(`Current timestamp: ${currentBlockData.timestamp} (${new Date(currentBlockData.timestamp * 1000).toISOString()})`);
  
  // Binary search for start of Day 14
  let low = currentBlock - 20000; // ~2.7 days back
  let high = currentBlock;
  let startBlock = 0;
  
  console.log('\nSearching for start of Day 14...');
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const block = await provider.getBlock(mid);
    
    if (block.timestamp < day14Start) {
      low = mid + 1;
    } else {
      startBlock = mid;
      high = mid - 1;
    }
    
    if ((high - low) % 100 === 0) {
      console.log(`  Narrowing... blocks ${low} to ${high}`);
    }
  }
  
  // Binary search for end of Day 14
  low = startBlock;
  high = currentBlock;
  let endBlock = 0;
  
  console.log('\nSearching for end of Day 14...');
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const block = await provider.getBlock(mid);
    
    if (block.timestamp < day14End) {
      endBlock = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
    
    if ((high - low) % 100 === 0) {
      console.log(`  Narrowing... blocks ${low} to ${high}`);
    }
  }
  
  // Verify
  const startBlockData = await provider.getBlock(startBlock);
  const endBlockData = await provider.getBlock(endBlock);
  
  console.log('\n=== RESULTS ===');
  console.log(`Day 14 starts at block: ${startBlock}`);
  console.log(`  Timestamp: ${startBlockData.timestamp} (${new Date(startBlockData.timestamp * 1000).toISOString()})`);
  console.log(`Day 14 ends at block: ${endBlock}`);
  console.log(`  Timestamp: ${endBlockData.timestamp} (${new Date(endBlockData.timestamp * 1000).toISOString()})`);
  console.log(`Total blocks in Day 14: ${endBlock - startBlock + 1}`);
  
  // Now check for Created events in this range
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  const abi = ['event Created(address indexed user, uint256 indexed createId, uint256 torusAmount, uint256 indexed duration, uint256 titanAmount, uint256 ethAmount)'];
  const contract = new ethers.Contract(CREATE_STAKE_CONTRACT, abi, provider);
  
  console.log('\n=== CHECKING FOR CREATED EVENTS ===');
  const chunkSize = 2000;
  let totalEvents = 0;
  
  for (let block = startBlock; block <= endBlock; block += chunkSize) {
    const toBlock = Math.min(block + chunkSize - 1, endBlock);
    console.log(`Scanning blocks ${block} to ${toBlock}...`);
    
    const filter = contract.filters.Created();
    const events = await contract.queryFilter(filter, block, toBlock);
    totalEvents += events.length;
    
    if (events.length > 0) {
      console.log(`  Found ${events.length} Created events!`);
      // Show first few
      events.slice(0, 3).forEach(e => {
        console.log(`    User: ${e.args.user}, TORUS: ${ethers.utils.formatEther(e.args.torusAmount)}, Block: ${e.blockNumber}`);
      });
    }
  }
  
  console.log(`\nTotal Created events on Day 14: ${totalEvents}`);
}

findDay14Blocks().catch(console.error);