const { ethers } = require('ethers');

async function analyzeBuyProcessContract() {
  console.log('🔍 Analyzing Buy & Process Contract...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  
  // First, let's check what events this contract emits
  // Based on the contract name and purpose, likely events could include:
  const contractABI = [
    // Common events for buy/burn/build operations
    'event BuyAndBurn(address indexed user, uint256 ethAmount, uint256 torusAmount, uint256 burnAmount)',
    'event BuyAndBuild(address indexed user, uint256 ethAmount, uint256 torusAmount)',
    'event Fractal(address indexed user, uint256 titanXAmount, uint256 torusAmount)',
    'event TorusBurned(uint256 amount)',
    'event EthReceived(address indexed from, uint256 amount)',
    'event TitanXReceived(address indexed from, uint256 amount)',
    
    // Try some function signatures
    'function totalEthProcessed() view returns (uint256)',
    'function totalTitanXProcessed() view returns (uint256)',
    'function totalTorusBurned() view returns (uint256)'
  ];
  
  console.log('Contract Address:', BUY_PROCESS_CONTRACT);
  console.log('Checking for events and functions...\n');
  
  try {
    // Get contract code to verify it exists
    const code = await provider.getCode(BUY_PROCESS_CONTRACT);
    console.log('Contract exists:', code.length > 2 ? 'Yes' : 'No');
    console.log('Contract size:', code.length, 'bytes\n');
    
    // Try to get some recent transactions
    const currentBlock = await provider.getBlockNumber();
    console.log('Current block:', currentBlock);
    
    // Look for transactions in the last day (approximately 7200 blocks)
    const fromBlock = currentBlock - 7200;
    console.log(`Checking transactions from block ${fromBlock} to ${currentBlock}\n`);
    
    // Get transaction count
    const filter = {
      address: BUY_PROCESS_CONTRACT,
      fromBlock: fromBlock,
      toBlock: currentBlock
    };
    
    const logs = await provider.getLogs(filter);
    console.log(`Found ${logs.length} events in the last day\n`);
    
    // Analyze event signatures
    const eventSignatures = new Set();
    logs.forEach(log => {
      if (log.topics[0]) {
        eventSignatures.add(log.topics[0]);
      }
    });
    
    console.log('Unique event signatures found:', eventSignatures.size);
    eventSignatures.forEach(sig => {
      console.log(' ', sig);
    });
    
    // Try to decode known event signatures
    const knownEvents = {
      // Common event signatures (we'll need to find the actual ones)
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef': 'Transfer',
      '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925': 'Approval'
    };
    
    console.log('\nChecking for specific operations...');
    
    // Sample some logs to understand the data
    if (logs.length > 0) {
      console.log('\nSample log data (last 5 events):');
      logs.slice(-5).forEach(async (log, i) => {
        console.log(`\nEvent ${i + 1}:`);
        console.log('  Block:', log.blockNumber);
        console.log('  Topics:', log.topics.length);
        console.log('  Data length:', log.data.length);
        
        // Get block timestamp
        try {
          const block = await provider.getBlock(log.blockNumber);
          console.log('  Timestamp:', new Date(block.timestamp * 1000).toISOString());
        } catch (e) {
          console.log('  Timestamp: Error fetching');
        }
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

analyzeBuyProcessContract().catch(console.error);