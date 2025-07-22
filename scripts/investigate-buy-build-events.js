const { ethers } = require('ethers');

async function investigate() {
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  
  // Let's check one specific transaction we know is an ETH build
  const txHash = '0x868223b1d543ef11958860c9f37a5903a049b35f61b67757075a145e2c012549'; // Unknown selector 0x53ad9b96
  
  try {
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);
    
    console.log('Transaction Details:');
    console.log('From:', tx.from);
    console.log('To:', tx.to);
    console.log('Value (ETH):', ethers.utils.formatEther(tx.value));
    console.log('Function selector:', tx.data.slice(0, 10));
    console.log('Gas Used:', receipt.gasUsed.toString());
    
    // Decode the logs to find BuyAndBuild event
    const iface = new ethers.utils.Interface([
      'event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)'
    ]);
    
    console.log('\nEvent Logs:');
    receipt.logs.forEach((log, i) => {
      try {
        const parsed = iface.parseLog(log);
        if (parsed.name === 'BuyAndBuild') {
          console.log(`\nBuyAndBuild Event:`);
          console.log('tokenAllocated (raw):', parsed.args.tokenAllocated.toString());
          console.log('tokenAllocated (formatted):', ethers.utils.formatEther(parsed.args.tokenAllocated));
          console.log('torusPurchased:', ethers.utils.formatEther(parsed.args.torusPurchased));
        }
      } catch (e) {
        // Not a BuyAndBuild event
      }
    });
    
    // Check if this is related to the Create & Stake contract
    console.log('\nChecking if tx is from Create & Stake contract...');
    const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
    if (tx.from.toLowerCase() === CREATE_STAKE_CONTRACT.toLowerCase()) {
      console.log('YES - This transaction is from the Create & Stake contract!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

investigate();