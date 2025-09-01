const { ethers } = require('ethers');

async function findDeploymentBlock() {
  const provider = new ethers.JsonRpcProvider('https://ethereum.publicnode.com');
  const contractAddress = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  
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
      break;
    }
  }
  
  if (deploymentBlock) {
    // Get the deployment transaction
    const block = await provider.getBlock(deploymentBlock);
    
    // Try to find the contract creation transaction
    for (const txHash of block.transactions) {
      const tx = await provider.getTransaction(txHash);
      const receipt = await provider.getTransactionReceipt(txHash);
      
      if (receipt && receipt.contractAddress && 
          receipt.contractAddress.toLowerCase() === contractAddress.toLowerCase()) {
        break;
      }
    }
  }
}

findDeploymentBlock().catch(console.error);