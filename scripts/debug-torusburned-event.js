#!/usr/bin/env node

/**
 * Debug TorusBurned event structure
 */

const { ethers } = require('ethers');

const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',  
  'https://eth.llamarpc.com'
];

async function debugTorusBurnedEvent() {
  console.log('🔍 Debugging TorusBurned event structure...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    
    // First, let's get the raw logs for TorusBurned events
    const deployBlock = 22890272;
    const endBlock = 22891000;
    
    // TorusBurned event signature: TorusBurned(uint256)
    const eventSignature = ethers.utils.id('TorusBurned(uint256)');
    console.log(`TorusBurned event signature: ${eventSignature}\n`);
    
    // Get logs directly
    const logs = await provider.getLogs({
      address: BUY_PROCESS_CONTRACT,
      topics: [eventSignature],
      fromBlock: deployBlock,
      toBlock: endBlock
    });
    
    console.log(`Found ${logs.length} TorusBurned events\n`);
    
    // Parse each log manually
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      console.log(`TorusBurned event #${i + 1}:`);
      console.log(`  Block: ${log.blockNumber}`);
      console.log(`  Tx: ${log.transactionHash}`);
      console.log(`  Topics: ${log.topics.join(', ')}`);
      console.log(`  Data: ${log.data}`);
      
      // Decode the amount from data
      if (log.data && log.data !== '0x') {
        const amount = ethers.BigNumber.from(log.data);
        console.log(`  Decoded amount: ${ethers.utils.formatEther(amount)} TORUS`);
      } else {
        console.log(`  No data field found`);
      }
      
      // Also check if it's an indexed parameter (in topics)
      if (log.topics.length > 1) {
        const indexedAmount = ethers.BigNumber.from(log.topics[1]);
        console.log(`  Indexed amount: ${ethers.utils.formatEther(indexedAmount)} TORUS`);
      }
      
      // Get the transaction receipt to cross-check
      const receipt = await provider.getTransactionReceipt(log.transactionHash);
      
      // Find BuyAndBurn event in the same transaction
      const buyAndBurnSig = ethers.utils.id('BuyAndBurn(uint256,uint256,address)');
      const buyAndBurnLog = receipt.logs.find(l => 
        l.topics[0] === buyAndBurnSig && 
        l.address.toLowerCase() === BUY_PROCESS_CONTRACT.toLowerCase()
      );
      
      if (buyAndBurnLog) {
        // BuyAndBurn has indexed titanXAmount and torusBurnt
        const torusBurntFromEvent = ethers.BigNumber.from(buyAndBurnLog.topics[2]);
        console.log(`  BuyAndBurn torusBurnt parameter: ${ethers.utils.formatEther(torusBurntFromEvent)} TORUS`);
      }
      
      console.log('');
    }
    
    // Now let's try a different approach with the contract interface
    console.log('\nTrying with contract interface and different ABI definitions...\n');
    
    // Try different ABI definitions
    const abiVariations = [
      ['event TorusBurned(uint256 amount)'],
      ['event TorusBurned(uint256 indexed amount)'],
      ['event TorusBurned(uint256)']
    ];
    
    for (const abi of abiVariations) {
      console.log(`Testing ABI: ${abi[0]}`);
      try {
        const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, abi, provider);
        const events = await contract.queryFilter(
          contract.filters.TorusBurned(),
          deployBlock,
          endBlock
        );
        
        if (events.length > 0) {
          console.log(`  Found ${events.length} events`);
          const firstEvent = events[0];
          console.log(`  First event args:`, firstEvent.args);
          if (firstEvent.args && firstEvent.args.length > 0) {
            console.log(`  Amount: ${ethers.utils.formatEther(firstEvent.args[0])} TORUS`);
          }
        }
      } catch (e) {
        console.log(`  Error: ${e.message}`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugTorusBurnedEvent().catch(console.error);