const { ethers } = require('ethers');

async function verifyDay14StakeOnChain() {
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  
  console.log('=== VERIFYING DAY 14 STAKE ON-CHAIN ===\n');
  
  // The transaction we found
  const txHash = '0xb486c10408b3a85d9a3447440ef3f07c61cd2eb3579b537f9568dc05dd3791a3';
  
  console.log(`Fetching transaction: ${txHash}\n`);
  
  try {
    // Get transaction
    const tx = await provider.getTransaction(txHash);
    console.log('Transaction details:');
    console.log(`  From: ${tx.from}`);
    console.log(`  To: ${tx.to}`);
    console.log(`  Block: ${tx.blockNumber}`);
    console.log(`  ETH sent: ${ethers.utils.formatEther(tx.value)}`);
    
    // Get transaction receipt for logs
    const receipt = await provider.getTransactionReceipt(txHash);
    console.log(`  Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
    
    // Decode the stake event
    const stakedEventSig = ethers.utils.id('Staked(address,uint256,uint256,uint256,uint256)');
    const stakeLog = receipt.logs.find(log => log.topics[0] === stakedEventSig);
    
    if (stakeLog) {
      console.log('\nStake Event Found:');
      const decoded = ethers.utils.defaultAbiCoder.decode(
        ['uint256', 'uint256', 'uint256', 'uint256'],
        stakeLog.data
      );
      
      const stakeIndex = decoded[0];
      const principal = decoded[1];
      const stakingDays = decoded[2];
      const shares = decoded[3];
      
      console.log(`  User: ${ethers.utils.hexStripZeros(stakeLog.topics[1])}`);
      console.log(`  Stake Index: ${stakeIndex.toString()}`);
      console.log(`  Principal (TORUS): ${ethers.utils.formatEther(principal)}`);
      console.log(`  Staking Days: ${stakingDays.toString()}`);
      console.log(`  Shares: ${shares.toString()}`);
    }
    
    // Check for TitanX transfers
    const transferSig = ethers.utils.id('Transfer(address,address,uint256)');
    const TITANX_ADDRESS = '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1';
    const CREATE_STAKE_ADDRESS = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
    
    console.log('\nChecking for TitanX transfers...');
    let titanXTransferred = ethers.BigNumber.from(0);
    
    receipt.logs.forEach(log => {
      if (log.address.toLowerCase() === TITANX_ADDRESS.toLowerCase() && 
          log.topics[0] === transferSig) {
        const to = ethers.utils.hexStripZeros(log.topics[2]);
        if (to.toLowerCase() === CREATE_STAKE_ADDRESS.toLowerCase()) {
          const amount = ethers.BigNumber.from(log.data);
          titanXTransferred = titanXTransferred.add(amount);
          console.log(`  TitanX Transfer: ${ethers.utils.formatEther(amount)} TITANX`);
          console.log(`  From: ${ethers.utils.hexStripZeros(log.topics[1])}`);
          console.log(`  To: ${to}`);
        }
      }
    });
    
    console.log(`\nTotal TitanX transferred: ${ethers.utils.formatEther(titanXTransferred)}`);
    
    // Get block timestamp
    const block = await provider.getBlock(tx.blockNumber);
    const date = new Date(block.timestamp * 1000);
    console.log(`\nTimestamp: ${date.toISOString()}`);
    console.log(`Protocol Day: ${Math.floor((date - new Date('2025-07-10T00:00:00Z')) / (24 * 60 * 60 * 1000)) + 1}`);
    
  } catch (error) {
    console.log('Error:', error.message);
  }
}

verifyDay14StakeOnChain().catch(console.error);