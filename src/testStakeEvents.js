const { ethers } = require('ethers');

// Contract addresses and ABI
const TORUS_CREATE_STAKE = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
const STAKED_EVENT_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "id", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "principal", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "shares", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "duration", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
    ],
    "name": "Staked",
    "type": "event"
  }
];

async function checkStakeEvents() {
  console.log('Checking for Staked events on TORUS contract...\n');
  
  // Connect to Ethereum mainnet
  const provider = new ethers.JsonRpcProvider('https://ethereum.publicnode.com');
  
  // Create contract instance
  const contract = new ethers.Contract(TORUS_CREATE_STAKE, STAKED_EVENT_ABI, provider);
  
  try {
    // Get current block
    const currentBlock = await provider.getBlockNumber();
    const deploymentBlock = 21573450; // Contract deployment block
    
    console.log(`Current block: ${currentBlock}`);
    console.log(`Checking from deployment block: ${deploymentBlock}`);
    console.log(`Block range: ${currentBlock - deploymentBlock} blocks\n`);
    
    // Create filter for Staked events
    const filter = contract.filters.Staked();
    
    // Query last 10,000 blocks as a test
    const fromBlock = currentBlock - 10000;
    const toBlock = currentBlock;
    
    console.log(`Querying recent blocks: ${fromBlock} to ${toBlock}`);
    const recentEvents = await contract.queryFilter(filter, fromBlock, toBlock);
    console.log(`Found ${recentEvents.length} Staked events in last 10,000 blocks\n`);
    
    // If no recent events, check from deployment
    if (recentEvents.length === 0) {
      console.log('No recent Staked events found. Checking from deployment...');
      
      // Check in chunks to avoid hitting limits
      const chunkSize = 45000;
      let totalEvents = 0;
      let from = deploymentBlock;
      
      while (from < currentBlock) {
        const to = Math.min(from + chunkSize, currentBlock);
        console.log(`Checking blocks ${from} to ${to}...`);
        
        try {
          const events = await contract.queryFilter(filter, from, to);
          totalEvents += events.length;
          
          if (events.length > 0) {
            console.log(`Found ${events.length} events in this chunk!`);
            
            // Show first event details
            const firstEvent = events[0];
            const args = firstEvent.args;
            console.log('\nFirst Staked event details:');
            console.log(`  User: ${args.user}`);
            console.log(`  ID: ${args.id}`);
            console.log(`  Principal: ${ethers.formatEther(args.principal)} TORUS`);
            console.log(`  Shares: ${args.shares}`);
            console.log(`  Duration: ${args.duration} days`);
            console.log(`  Timestamp: ${new Date(Number(args.timestamp) * 1000).toISOString()}`);
            console.log(`  Block: ${firstEvent.blockNumber}`);
            console.log(`  Tx Hash: ${firstEvent.transactionHash}`);
            break;
          }
        } catch (error) {
          console.error(`Error in chunk ${from}-${to}:`, error.message);
        }
        
        from = to + 1;
      }
      
      console.log(`\nTotal Staked events found: ${totalEvents}`);
    } else {
      // Show details of recent events
      console.log('Recent Staked events:');
      recentEvents.slice(0, 5).forEach((event, idx) => {
        const args = event.args;
        console.log(`\nEvent ${idx + 1}:`);
        console.log(`  User: ${args.user}`);
        console.log(`  Principal: ${ethers.formatEther(args.principal)} TORUS`);
        console.log(`  Duration: ${args.duration} days`);
        console.log(`  Block: ${event.blockNumber}`);
      });
    }
    
  } catch (error) {
    console.error('Error checking events:', error);
  }
}

// Also check for Created events for comparison
async function checkCreateEvents() {
  console.log('\n\nChecking Created events for comparison...\n');
  
  const provider = new ethers.JsonRpcProvider('https://ethereum.publicnode.com');
  
  const CREATE_EVENT_ABI = [{
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "stakeIndex", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "torusAmount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "endTime", "type": "uint256"}
    ],
    "name": "Created",
    "type": "event"
  }];
  
  const contract = new ethers.Contract(TORUS_CREATE_STAKE, CREATE_EVENT_ABI, provider);
  
  try {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 10000;
    
    const filter = contract.filters.Created();
    const events = await contract.queryFilter(filter, fromBlock, currentBlock);
    
    console.log(`Found ${events.length} Created events in last 10,000 blocks`);
    
    if (events.length > 0) {
      console.log('\nSample Created event:');
      const event = events[0];
      console.log(`  User: ${event.args.user}`);
      console.log(`  TORUS Amount: ${ethers.formatEther(event.args.torusAmount)}`);
      console.log(`  Block: ${event.blockNumber}`);
    }
  } catch (error) {
    console.error('Error checking Created events:', error);
  }
}

// Run the checks
async function main() {
  await checkStakeEvents();
  await checkCreateEvents();
}

main().catch(console.error);