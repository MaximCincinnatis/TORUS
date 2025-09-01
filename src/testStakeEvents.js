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
  
  // Connect to Ethereum mainnet
  const provider = new ethers.JsonRpcProvider('https://ethereum.publicnode.com');
  
  // Create contract instance
  const contract = new ethers.Contract(TORUS_CREATE_STAKE, STAKED_EVENT_ABI, provider);
  
  try {
    // Get current block
    const currentBlock = await provider.getBlockNumber();
    const deploymentBlock = 21573450; // Contract deployment block
    
    
    // Create filter for Staked events
    const filter = contract.filters.Staked();
    
    // Query last 10,000 blocks as a test
    const fromBlock = currentBlock - 10000;
    const toBlock = currentBlock;
    
    const recentEvents = await contract.queryFilter(filter, fromBlock, toBlock);
    
    // If no recent events, check from deployment
    if (recentEvents.length === 0) {
      
      // Check in chunks to avoid hitting limits
      const chunkSize = 45000;
      let totalEvents = 0;
      let from = deploymentBlock;
      
      while (from < currentBlock) {
        const to = Math.min(from + chunkSize, currentBlock);
        
        try {
          const events = await contract.queryFilter(filter, from, to);
          totalEvents += events.length;
          
          if (events.length > 0) {
            
            // Show first event details
            const firstEvent = events[0];
            const args = firstEvent.args;
            break;
          }
        } catch (error) {
        }
        
        from = to + 1;
      }
      
    } else {
      // Show details of recent events
      recentEvents.slice(0, 5).forEach((event, idx) => {
        const args = event.args;
      });
    }
    
  } catch (error) {
  }
}

// Also check for Created events for comparison
async function checkCreateEvents() {
  
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
    
    
    if (events.length > 0) {
      const event = events[0];
    }
  } catch (error) {
  }
}

// Run the checks
async function main() {
  await checkStakeEvents();
  await checkCreateEvents();
}

main().catch(console.error);