#!/usr/bin/env node

/**
 * Compare BuyAndBurn events to actual burns
 */

const { ethers } = require('ethers');

const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function compareEventsToBurns() {
  console.log('🔍 Comparing BuyAndBurn events to actual burns...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    
    const contractABI = [
      'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
      'event TorusBurned(uint256 indexed amount)'
    ];
    
    const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, contractABI, provider);
    
    // Get first few BuyAndBurn events
    const deployBlock = 22890272;
    const endBlock = 22891000;
    
    console.log(`Checking blocks ${deployBlock} to ${endBlock}...\n`);
    
    const buyAndBurnEvents = await contract.queryFilter(
      contract.filters.BuyAndBurn(),
      deployBlock,
      endBlock
    );
    
    const torusBurnedEvents = await contract.queryFilter(
      contract.filters.TorusBurned(),
      deployBlock,
      endBlock
    );
    
    console.log(`Found ${buyAndBurnEvents.length} BuyAndBurn events`);
    console.log(`Found ${torusBurnedEvents.length} TorusBurned events\n`);
    
    // Match them up
    for (let i = 0; i < buyAndBurnEvents.length; i++) {
      const buyBurn = buyAndBurnEvents[i];
      const torusBurnedEvent = torusBurnedEvents.find(e => e.transactionHash === buyBurn.transactionHash);
      
      console.log(`BuyAndBurn event #${i + 1}:`);
      console.log(`  Block: ${buyBurn.blockNumber}`);
      console.log(`  Tx: ${buyBurn.transactionHash}`);
      console.log(`  torusBurnt parameter: ${ethers.utils.formatEther(buyBurn.args.torusBurnt)} TORUS`);
      
      if (torusBurnedEvent) {
        console.log(`  TorusBurned event found`);
        console.log(`  Args:`, torusBurnedEvent.args);
        // Try different ways to access the amount
        const burnAmount = torusBurnedEvent.args.amount || torusBurnedEvent.args[0];
        if (burnAmount) {
          console.log(`  Actual burn (TorusBurned event): ${ethers.utils.formatEther(burnAmount)} TORUS`);
        
          const eventAmount = parseFloat(ethers.utils.formatEther(buyBurn.args.torusBurnt));
          const actualAmount = parseFloat(ethers.utils.formatEther(burnAmount));
          
          if (Math.abs(eventAmount - actualAmount) > 0.000001) {
            console.log(`  ⚠️  MISMATCH: Event says ${eventAmount}, actual burn was ${actualAmount}`);
          }
        }
      } else {
        console.log(`  ❌ No TorusBurned event found in same transaction`);
      }
      
      console.log('');
    }
    
    // Theory confirmation
    console.log('\n🔍 Theory:');
    console.log('The BuyAndBurn event emits the amount that WILL be burned');
    console.log('But burnTorus() burns the ENTIRE contract balance');
    console.log('So if the contract already had TORUS, it burns more than the event amount');
    console.log('\nThis explains why totalTorusBurnt (sum of event amounts) is higher');
    console.log('than actual burns (Transfer events to 0x0)');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

compareEventsToBurns().catch(console.error);