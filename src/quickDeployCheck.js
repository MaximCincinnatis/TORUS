const { ethers } = require('ethers');

async function quickCheck() {
  const provider = new ethers.JsonRpcProvider('https://ethereum.publicnode.com');
  const contractAddress = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  // Check specific blocks around the suspected deployment
  const blocksToCheck = [
    21573450,  // From test script
    22890272,  // From dashboard code
    22890437,  // First event we found
  ];
  
  for (const block of blocksToCheck) {
    try {
      const code = await provider.getCode(contractAddress, block);
      const hasCode = code !== '0x' && code !== '0x0';
      
      if (hasCode && block > 0) {
        // Check previous block
        const prevCode = await provider.getCode(contractAddress, block - 1);
        const prevHasCode = prevCode !== '0x' && prevCode !== '0x0';
        if (!prevHasCode) {
        }
      }
    } catch (error) {
    }
  }
  
  // Also check current state
  const currentBlock = await provider.getBlockNumber();
  const currentCode = await provider.getCode(contractAddress);
}

quickCheck().catch(console.error);