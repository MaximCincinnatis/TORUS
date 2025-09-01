const { ethers } = require('ethers');

// Contract address and ABI
const TORUS_CREATE_STAKE = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
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

async function testCreateFetch() {
  
  // Connect to Ethereum mainnet
  const provider = new ethers.JsonRpcProvider('https://ethereum.publicnode.com');
  
  // Create contract instance
  const contract = new ethers.Contract(TORUS_CREATE_STAKE, CREATE_EVENT_ABI, provider);
  
  try {
    const currentBlock = await provider.getBlockNumber();
    const deploymentBlock = 21573450; // Correct deployment block
    
    
    // Test fetching from a specific range
    const testFromBlock = currentBlock - 50000;
    const testToBlock = currentBlock;
    
    const filter = contract.filters.Created();
    const events = await contract.queryFilter(filter, testFromBlock, testToBlock);
    
    
    // Show some stats
    if (events.length > 0) {
      const totalTorus = events.reduce((sum, event) => {
        return sum + parseFloat(ethers.formatEther(event.args.torusAmount));
      }, 0);
      
      
      // Show first few events
      events.slice(0, 3).forEach((event, i) => {
      });
      
      // Estimate total creates
      const blocksPerEvent = 50000 / events.length;
      const totalBlocksSinceDeployment = currentBlock - deploymentBlock;
      const estimatedTotalCreates = Math.round(totalBlocksSinceDeployment / blocksPerEvent);
      
    }
    
  } catch (error) {
  }
}

testCreateFetch().catch(console.error);