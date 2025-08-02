/**
 * Shared TitanX Helper Functions
 * 
 * Provides utilities for extracting actual TitanX amounts from stake transactions.
 * This solves the issue where contract.getStakePositions() returns ETH-equivalent
 * values instead of actual TitanX amounts.
 */

const { ethers } = require('ethers');
const { CONTRACT_ADDRESSES, EVENT_TOPICS } = require('./contractConstants');

/**
 * Gets the actual TitanX amount from a stake transaction by finding
 * the Transfer event to the stake contract.
 * 
 * @param {string} transactionHash - The stake transaction hash
 * @param {ethers.providers.Provider} provider - Ethereum provider
 * @returns {Promise<string>} Raw TitanX amount (in wei) or '0' if not found
 */
async function getActualTitanXFromStake(transactionHash, provider) {
  try {
    const receipt = await provider.getTransactionReceipt(transactionHash);
    if (!receipt) {
      console.warn(`No receipt found for tx ${transactionHash}`);
      return '0';
    }
    
    const TITANX = CONTRACT_ADDRESSES.TITANX.toLowerCase();
    const STAKE_CONTRACT = CONTRACT_ADDRESSES.CREATE_STAKE.toLowerCase();
    const TRANSFER_TOPIC = EVENT_TOPICS.TRANSFER;
    
    // Find TitanX transfer TO stake contract
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === TITANX && 
          log.topics[0] === TRANSFER_TOPIC &&
          log.topics.length >= 3) {
        
        // Decode the 'to' address from topics[2]
        const to = ethers.utils.defaultAbiCoder.decode(['address'], log.topics[2])[0];
        
        if (to.toLowerCase() === STAKE_CONTRACT) {
          // This is the TitanX transfer to the stake contract
          return log.data; // Raw amount in wei
        }
      }
    }
    
    // No TitanX transfer found (might be an ETH-only operation)
    console.warn(`No TitanX transfer to stake contract found in tx ${transactionHash}`);
    return '0';
    
  } catch (error) {
    console.error(`Error getting TitanX from stake tx ${transactionHash}:`, error.message);
    return '0';
  }
}

/**
 * Test function to verify the helper works correctly
 */
async function testTitanXExtraction() {
  const provider = new ethers.providers.JsonRpcProvider('https://ethereum.publicnode.com');
  
  console.log('Testing TitanX extraction from known stake transactions...\n');
  
  const testCases = [
    { 
      tx: '0x49000b392520edcf7670da5299986194da1f6f754fdf7d7888bf98d82ceef030',
      expected: '475695.166088614873474811',
      type: 'ETH stake (swap)'
    },
    { 
      tx: '0x5ba07dfaf1edad3efdafc0f9275a41cd3f7efbc713c2ffcaf60d1a51513fe328',
      expected: '3048452.870891455581',
      type: 'Direct TitanX stake'
    },
    { 
      tx: '0x997f0b44628cb310b21c9b219cc38ba606474fdfff269217733dedbcd3a42537',
      expected: '13209962.440529640851',
      type: 'Direct TitanX stake'
    },
    { 
      tx: '0xd95b6b6be35c6482110924c74ca180d603c8a757f495b9fca225ea3112c400ff',
      expected: '38166110.1496196277732',
      type: 'Direct TitanX stake (38M)'
    }
  ];
  
  for (const testCase of testCases) {
    try {
      const rawAmount = await getActualTitanXFromStake(testCase.tx, provider);
      const formatted = ethers.utils.formatEther(rawAmount);
      
      console.log(`Transaction: ${testCase.tx}`);
      console.log(`  Type: ${testCase.type}`);
      console.log(`  Expected: ${testCase.expected} TitanX`);
      console.log(`  Got: ${formatted} TitanX`);
      console.log(`  ✅ Match: ${formatted === testCase.expected}\n`);
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}\n`);
    }
  }
}

module.exports = {
  getActualTitanXFromStake,
  testTitanXExtraction
};

// Run test if called directly
if (require.main === module) {
  testTitanXExtraction().catch(console.error);
}