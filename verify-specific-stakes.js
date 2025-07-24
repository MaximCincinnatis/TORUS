const { ethers } = require('ethers');

async function verifySpecificStakes() {
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  
  console.log('=== VERIFYING SPECIFIC DAY 14 STAKES ===\n');
  
  // First stake with tx hash
  const tx1Hash = '0xb486c10408b3a85d9a3447440ef3f07c61cd2eb3579b537f9568dc05dd3791a3';
  console.log(`Checking transaction: ${tx1Hash}`);
  
  try {
    const tx1 = await provider.getTransaction(tx1Hash);
    const receipt1 = await provider.getTransactionReceipt(tx1Hash);
    const block1 = await provider.getBlock(tx1.blockNumber);
    
    console.log(`Block: ${tx1.blockNumber}`);
    console.log(`Timestamp: ${new Date(block1.timestamp * 1000).toISOString()}`);
    console.log(`To: ${tx1.to}`);
    console.log(`Value (ETH): ${ethers.utils.formatEther(tx1.value)}`);
    
    // Check if it's a stake transaction
    const CREATE_STAKE_ADDRESS = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
    if (tx1.to && tx1.to.toLowerCase() === CREATE_STAKE_ADDRESS.toLowerCase()) {
      console.log('✓ Transaction is to Create & Stake contract');
      
      // Decode the function call
      const stakeABI = ['function stake(uint256 torusAmount, uint256 numDays)'];
      const iface = new ethers.utils.Interface(stakeABI);
      
      try {
        const decoded = iface.parseTransaction({ data: tx1.data });
        console.log(`Function: ${decoded.name}`);
        console.log(`TORUS Amount: ${ethers.utils.formatEther(decoded.args.torusAmount)} TORUS`);
        console.log(`Duration: ${decoded.args.numDays} days`);
      } catch (e) {
        console.log('Could not decode as standard stake function');
      }
      
      // Check for Staked event
      const stakedTopic = ethers.utils.id('Staked(address,uint256,uint256,uint256,uint8)');
      const stakedLogs = receipt1.logs.filter(log => 
        log.address.toLowerCase() === CREATE_STAKE_ADDRESS.toLowerCase() &&
        log.topics[0] === stakedTopic
      );
      
      if (stakedLogs.length > 0) {
        console.log(`\n✓ Found Staked event`);
        const stakeInterface = new ethers.utils.Interface([
          'event Staked(address indexed user, uint256 indexed stakeIndex, uint256 torusAmount, uint256 duration, uint8 paymentType)'
        ]);
        const parsed = stakeInterface.parseLog(stakedLogs[0]);
        console.log(`  User: ${parsed.args.user}`);
        console.log(`  Amount: ${ethers.utils.formatEther(parsed.args.torusAmount)} TORUS`);
        console.log(`  Payment Type: ${parsed.args.paymentType}`);
      }
    }
    
    // Second stake at block 22986216
    console.log('\n\nChecking block 22986216 for second stake...');
    const block2 = await provider.getBlock(22986216);
    console.log(`Block timestamp: ${new Date(block2.timestamp * 1000).toISOString()}`);
    
    // Get all transactions in this block to Create & Stake contract
    const txs = await Promise.all(
      block2.transactions.slice(0, 10).map(hash => provider.getTransaction(hash))
    );
    
    const stakeTxs = txs.filter(tx => 
      tx.to && tx.to.toLowerCase() === CREATE_STAKE_ADDRESS.toLowerCase()
    );
    
    console.log(`Found ${stakeTxs.length} transactions to Create & Stake contract in first 10 txs`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

verifySpecificStakes().catch(console.error);