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
  console.log('Testing Create event fetch with correct deployment block...\n');
  
  // Connect to Ethereum mainnet
  const provider = new ethers.JsonRpcProvider('https://ethereum.publicnode.com');
  
  // Create contract instance
  const contract = new ethers.Contract(TORUS_CREATE_STAKE, CREATE_EVENT_ABI, provider);
  
  try {
    const currentBlock = await provider.getBlockNumber();
    const deploymentBlock = 21573450; // Correct deployment block
    
    console.log(`Current block: ${currentBlock}`);
    console.log(`Deployment block: ${deploymentBlock}`);
    console.log(`Total blocks since deployment: ${currentBlock - deploymentBlock}\n`);
    
    // Test fetching from a specific range
    const testFromBlock = currentBlock - 50000;
    const testToBlock = currentBlock;
    
    console.log(`Testing fetch from block ${testFromBlock} to ${testToBlock}...`);
    const filter = contract.filters.Created();
    const events = await contract.queryFilter(filter, testFromBlock, testToBlock);
    
    console.log(`Found ${events.length} Created events in last 50,000 blocks\n`);
    
    // Show some stats
    if (events.length > 0) {
      const totalTorus = events.reduce((sum, event) => {
        return sum + parseFloat(ethers.formatEther(event.args.torusAmount));
      }, 0);
      
      console.log('Event Statistics:');
      console.log(`  Total TORUS created: ${totalTorus.toFixed(2)}`);
      console.log(`  Average TORUS per create: ${(totalTorus / events.length).toFixed(2)}`);
      console.log(`  First event block: ${events[0].blockNumber}`);
      console.log(`  Last event block: ${events[events.length - 1].blockNumber}\n`);
      
      // Show first few events
      console.log('First 3 events:');
      events.slice(0, 3).forEach((event, i) => {
        console.log(`  ${i + 1}. User: ${event.args.user}`);
        console.log(`     TORUS: ${ethers.formatEther(event.args.torusAmount)}`);
        console.log(`     Block: ${event.blockNumber}`);
      });
      
      // Estimate total creates
      const blocksPerEvent = 50000 / events.length;
      const totalBlocksSinceDeployment = currentBlock - deploymentBlock;
      const estimatedTotalCreates = Math.round(totalBlocksSinceDeployment / blocksPerEvent);
      
      console.log(`\nEstimated total creates since deployment: ~${estimatedTotalCreates}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testCreateFetch().catch(console.error);