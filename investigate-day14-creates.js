const { ethers } = require('ethers');

async function investigateDay14Creates() {
  console.log('🔍 Investigating Day 14 (July 23, 2025) Creates...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  
  // Contract setup
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  const TORUS_CONTRACT = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
  
  const createStakeABI = [
    'function userCreates(address user, uint256 index) view returns (uint256 torusAmount, uint256 duration, uint256 timestamp, uint256 titanAmount, uint256 ethAmount, bool claimed)',
    'function userCreateCount(address user) view returns (uint256)',
    'event Created(address indexed user, uint256 indexed createId, uint256 torusAmount, uint256 indexed duration, uint256 titanAmount, uint256 ethAmount)'
  ];
  
  const torusABI = [
    'function balanceOf(address account) view returns (uint256)'
  ];
  
  const createStakeContract = new ethers.Contract(CREATE_STAKE_CONTRACT, createStakeABI, provider);
  const torusContract = new ethers.Contract(TORUS_CONTRACT, torusABI, provider);
  
  // Day 14 timestamp range (July 23, 2025)
  const startTimestamp = new Date('2025-07-23T00:00:00Z').getTime() / 1000;
  const endTimestamp = new Date('2025-07-24T00:00:00Z').getTime() / 1000;
  
  console.log(`Searching for creates between ${startTimestamp} and ${endTimestamp}`);
  console.log(`Date range: ${new Date(startTimestamp * 1000).toISOString()} to ${new Date(endTimestamp * 1000).toISOString()}\n`);
  
  // Get Created events from blocks around Day 14
  // Approximate block range based on ~12 second block time
  const blocksPerDay = 86400 / 12; // ~7200 blocks per day
  const currentBlock = await provider.getBlockNumber();
  
  // Calculate approximate block range for Day 14
  // Current date (July 24, 2025) - need to go back 1 day
  const daysFromNow = 1;
  const startBlock = currentBlock - (daysFromNow * blocksPerDay) - 3600; // Add buffer
  const endBlock = currentBlock - ((daysFromNow - 1) * blocksPerDay) + 3600; // Add buffer
  
  console.log(`Scanning blocks ${startBlock} to ${endBlock}...`);
  
  try {
    // Get Created events in chunks (max 5000 blocks per query)
    const chunkSize = 5000;
    const allEvents = [];
    
    for (let block = startBlock; block <= endBlock; block += chunkSize) {
      const toBlock = Math.min(block + chunkSize - 1, endBlock);
      console.log(`Scanning blocks ${block} to ${toBlock}...`);
      
      const filter = createStakeContract.filters.Created();
      const events = await createStakeContract.queryFilter(filter, block, toBlock);
      allEvents.push(...events);
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`Found ${allEvents.length} total Created events in block range\n`);
    
    // Filter for Day 14 events
    const day14Events = [];
    
    for (const event of allEvents) {
      const block = await provider.getBlock(event.blockNumber);
      const timestamp = block.timestamp;
      
      if (timestamp >= startTimestamp && timestamp < endTimestamp) {
        // Get the create data from the contract
        const createData = await createStakeContract.userCreates(event.args.user, event.args.createId);
        
        day14Events.push({
          user: event.args.user,
          createId: event.args.createId.toString(),
          torusAmount: ethers.utils.formatEther(event.args.torusAmount),
          titanAmount: ethers.utils.formatEther(event.args.titanAmount),
          ethAmount: ethers.utils.formatEther(createData.ethAmount),
          duration: event.args.duration.toString(),
          timestamp: timestamp,
          date: new Date(timestamp * 1000).toISOString(),
          blockNumber: event.blockNumber,
          txHash: event.transactionHash
        });
      }
      
      // Rate limit
      if (allEvents.indexOf(event) % 50 === 0) {
        console.log(`Progress: ${allEvents.indexOf(event)}/${allEvents.length}`);
      }
    }
    
    console.log(`\n=== DAY 14 CREATES (${day14Events.length} total) ===\n`);
    
    // Show all Day 14 creates
    day14Events.forEach(event => {
      console.log(`User: ${event.user}`);
      console.log(`  CreateID: ${event.createId}`);
      console.log(`  TORUS Amount: ${parseFloat(event.torusAmount).toFixed(2)}`);
      console.log(`  TitanX Payment: ${parseFloat(event.titanAmount).toLocaleString()}`);
      console.log(`  ETH Payment: ${event.ethAmount}`);
      console.log(`  Duration: ${event.duration} days`);
      console.log(`  Time: ${event.date}`);
      console.log(`  Block: ${event.blockNumber}`);
      console.log(`  Tx: ${event.txHash}`);
      console.log('');
    });
    
    // Find specific users mentioned
    const targetUsers = [
      '0x43fdeb73',
      '0xfd5bc7f6',
      '0x44cb99a5'
    ];
    
    console.log('\n=== SEARCHING FOR SPECIFIC USERS ===');
    targetUsers.forEach(partial => {
      const matches = day14Events.filter(e => e.user.toLowerCase().includes(partial.toLowerCase()));
      if (matches.length > 0) {
        console.log(`\nFound ${partial}:`);
        matches.forEach(m => {
          console.log(`  ${m.user}: ${parseFloat(m.torusAmount).toFixed(2)} TORUS, ${parseFloat(m.titanAmount).toLocaleString()} TitanX`);
        });
      } else {
        console.log(`\nNot found: ${partial}`);
      }
    });
    
    // Summary
    const totalTitanX = day14Events.reduce((sum, e) => sum + parseFloat(e.titanAmount), 0);
    const totalETH = day14Events.reduce((sum, e) => sum + parseFloat(e.ethAmount), 0);
    const zeroTitanXCount = day14Events.filter(e => parseFloat(e.titanAmount) === 0).length;
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total Day 14 Creates: ${day14Events.length}`);
    console.log(`Total TitanX Used: ${totalTitanX.toLocaleString()}`);
    console.log(`Total ETH Used: ${totalETH.toFixed(4)}`);
    console.log(`Creates with 0 TitanX: ${zeroTitanXCount}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

investigateDay14Creates().catch(console.error);