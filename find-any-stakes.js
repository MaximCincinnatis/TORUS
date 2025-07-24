const { ethers } = require('ethers');

// RPC endpoint
const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');

// Contract addresses
const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';

async function findAnyStakes() {
  try {
    console.log('Searching for ANY stake transactions...');
    
    // Let's check the last 100 blocks
    const currentBlock = await provider.getBlockNumber();
    const startBlock = currentBlock - 100;
    
    console.log(`Checking blocks ${startBlock} to ${currentBlock}...`);
    
    // Get transactions to the stake contract
    for (let blockNum = currentBlock; blockNum > startBlock; blockNum--) {
      const block = await provider.getBlockWithTransactions(blockNum);
      
      for (const tx of block.transactions) {
        if (tx.to && tx.to.toLowerCase() === CREATE_STAKE_CONTRACT.toLowerCase()) {
          console.log(`\nFound transaction to stake contract!`);
          console.log('Block:', blockNum);
          console.log('From:', tx.from);
          console.log('Hash:', tx.hash);
          console.log('Timestamp:', new Date(block.timestamp * 1000).toISOString());
          
          // Get the transaction receipt
          const receipt = await provider.getTransactionReceipt(tx.hash);
          console.log('Status:', receipt.status === 1 ? 'Success' : 'Failed');
          
          // Check if it's a stake by looking at the method signature
          const methodId = tx.data.substring(0, 10);
          console.log('Method ID:', methodId);
          
          // stakeTorus method ID would be the first 4 bytes of keccak256("stakeTorus(uint256,uint256,uint256)")
          // Let's see what methods are being called
        }
      }
    }
    
    console.log('\nDone checking blocks.');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

findAnyStakes().catch(console.error);