const { ethers } = require('ethers');

async function analyzeETHFlowInBurns() {
  console.log('🔍 Analyzing ETH flow in Buy & Process contract...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  
  // Extended ABI with more functions
  const contractABI = [
    'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
    'event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)',
    'function ethUsedForBurns() view returns (uint256)',
    'function ethUsedForBuilds() view returns (uint256)',
    'function totalETHBurn() view returns (uint256)',
    'function totalTorusBurnt() view returns (uint256)'
  ];
  
  const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, contractABI, provider);
  
  try {
    // Get all ETH-related state variables
    console.log('📊 Contract ETH State Variables:');
    console.log('================================\n');
    
    const [ethUsedForBurns, totalETHBurn, totalTorusBurnt] = await Promise.all([
      contract.ethUsedForBurns().catch(() => null),
      contract.totalETHBurn().catch(() => null),
      contract.totalTorusBurnt().catch(() => null)
    ]);
    
    // Try to get ethUsedForBuilds if it exists
    const ethUsedForBuilds = await contract.ethUsedForBuilds().catch(() => null);
    
    if (ethUsedForBurns) {
      console.log('ethUsedForBurns:', ethers.utils.formatEther(ethUsedForBurns), 'ETH');
    }
    
    if (ethUsedForBuilds) {
      console.log('ethUsedForBuilds:', ethers.utils.formatEther(ethUsedForBuilds), 'ETH');
    }
    
    if (totalETHBurn) {
      console.log('totalETHBurn:', ethers.utils.formatEther(totalETHBurn), 'ETH');
    }
    
    if (totalTorusBurnt) {
      console.log('totalTorusBurnt:', ethers.utils.formatEther(totalTorusBurnt), 'TORUS');
    }
    
    // Get contract balance
    const contractBalance = await provider.getBalance(BUY_PROCESS_CONTRACT);
    console.log('\nContract ETH Balance:', ethers.utils.formatEther(contractBalance), 'ETH');
    
    // Analyze internal transactions
    console.log('\n\n📈 Analyzing ETH Transfers to Contract:');
    console.log('=====================================\n');
    
    // Get recent blocks to check for ETH transfers
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 10000; // Check last ~1.5 days
    
    // Get all transactions to the contract
    console.log(`Checking transactions from block ${fromBlock} to ${currentBlock}...`);
    
    // Function signatures that might use ETH
    const ETH_FUNCTIONS = {
      '0x1e7d0fb0': 'swapETHForTorusAndBurn',
      '0x53ad9b96': 'swapETHForTorusAndBuild',
      '0xd0e30db0': 'deposit', // Common for WETH-like contracts
      '': 'ETH Transfer (no data)'
    };
    
    // Sample some recent transactions
    const logs = await provider.getLogs({
      address: BUY_PROCESS_CONTRACT,
      fromBlock: fromBlock,
      toBlock: currentBlock
    });
    
    console.log(`Found ${logs.length} events in recent blocks\n`);
    
    // Now let's trace ETH flow through specific burn transactions
    console.log('🔬 Tracing ETH flow in burn operations:');
    console.log('======================================\n');
    
    // Get some BuyAndBurn events to trace
    const burnEvents = await contract.queryFilter(
      contract.filters.BuyAndBurn(),
      currentBlock - 5000,
      currentBlock
    );
    
    console.log(`Analyzing ${Math.min(5, burnEvents.length)} recent burn events...\n`);
    
    for (let i = 0; i < Math.min(5, burnEvents.length); i++) {
      const event = burnEvents[i];
      const tx = await provider.getTransaction(event.transactionHash);
      const receipt = await provider.getTransactionReceipt(event.transactionHash);
      
      console.log(`Burn Event ${i + 1}:`);
      console.log(`  Tx Hash: ${event.transactionHash}`);
      console.log(`  Block: ${event.blockNumber}`);
      console.log(`  From: ${tx.from}`);
      console.log(`  ETH sent: ${ethers.utils.formatEther(tx.value)} ETH`);
      console.log(`  Gas used: ${receipt.gasUsed.toString()}`);
      console.log(`  Function: ${tx.data.slice(0, 10)} (${ETH_FUNCTIONS[tx.data.slice(0, 10)] || 'Unknown'})`);
      console.log(`  TORUS burned: ${ethers.utils.formatEther(event.args.torusBurnt)} TORUS`);
      console.log(`  TitanX amount: ${ethers.utils.formatEther(event.args.titanXAmount)} TitanX\n`);
    }
    
    // Summary
    console.log('\n📋 Summary:');
    console.log('===========\n');
    console.log('The ethUsedForBurns value tracks ETH that was used internally by the contract');
    console.log('for burn operations, likely through the swapETHForTorusAndBurn function.');
    console.log('\nThis ETH is first converted to TitanX, then to TORUS, which is then burned.');
    console.log('The BuyAndBurn event shows the TitanX amount used, not the original ETH amount.');
    console.log('\nTo track individual ETH amounts for burns, we would need to:');
    console.log('1. Monitor swapETHForTorusAndBurn function calls specifically');
    console.log('2. Track the ETH value sent with those transactions');
    console.log('3. Or decode the internal contract state changes');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeETHFlowInBurns().catch(console.error);