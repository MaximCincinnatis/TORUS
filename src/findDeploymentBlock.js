const { ethers } = require('ethers');

async function findDeploymentBlock() {
  const provider = new ethers.JsonRpcProvider('https://ethereum.publicnode.com');
  const contractAddress = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  console.log('Finding deployment block for contract:', contractAddress);
  
  // Binary search to find deployment block
  let low = 21000000; // Start from a reasonable block
  let high = await provider.getBlockNumber();
  let deploymentBlock = null;
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    
    try {
      const code = await provider.getCode(contractAddress, mid);
      const prevCode = await provider.getCode(contractAddress, mid - 1);
      
      if (code !== '0x' && prevCode === '0x') {
        // Found exact deployment block
        deploymentBlock = mid;
        console.log(`\n✅ Found exact deployment block: ${mid}`);
        break;
      } else if (code !== '0x') {
        // Contract exists, search earlier
        high = mid - 1;
      } else {
        // Contract doesn't exist, search later
        low = mid + 1;
      }
      
      if (low === high) {
        deploymentBlock = low;
        break;
      }
    } catch (error) {
      console.error(`Error checking block ${mid}:`, error.message);
      break;
    }
  }
  
  if (deploymentBlock) {
    // Get the deployment transaction
    const block = await provider.getBlock(deploymentBlock);
    console.log(`Block timestamp: ${new Date(block.timestamp * 1000).toISOString()}`);
    console.log(`Block date: ${new Date(block.timestamp * 1000).toLocaleDateString()}`);
    
    // Try to find the contract creation transaction
    for (const txHash of block.transactions) {
      const tx = await provider.getTransaction(txHash);
      const receipt = await provider.getTransactionReceipt(txHash);
      
      if (receipt && receipt.contractAddress && 
          receipt.contractAddress.toLowerCase() === contractAddress.toLowerCase()) {
        console.log(`\nDeployment transaction found:`);
        console.log(`  Hash: ${tx.hash}`);
        console.log(`  From: ${tx.from}`);
        console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
        console.log(`  Block: ${receipt.blockNumber}`);
        break;
      }
    }
  }
}

findDeploymentBlock().catch(console.error);