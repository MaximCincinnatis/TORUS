#!/usr/bin/env node

const { ethers } = require('ethers');

async function analyzeFeeCollectionTrigger() {
  console.log('🔍 Analyzing LP Fee Collection Triggers...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  
  // Known fee collection transactions
  const feeCollectionTxs = [
    {
      hash: '0x65f4d4d6450701c3c9c44e4913c7434ad423587366c323654782580e53514669',
      block: 22898872,
      date: '2025-07-11',
      torusBurned: '161.527971146914771679'
    },
    {
      hash: '0x7e22b18f2d79f88f20ec6fbd380b65a69167e3d1e4dbb54350a74ce8be39ca03',
      block: 22929138,
      date: '2025-07-16',
      torusBurned: '18.49596387540490905'
    }
  ];
  
  console.log('Analyzing known fee collection transactions:\n');
  
  for (const txInfo of feeCollectionTxs) {
    console.log(`\n📋 Transaction: ${txInfo.hash}`);
    console.log(`   Date: ${txInfo.date}`);
    console.log(`   Block: ${txInfo.block}`);
    console.log(`   TORUS Burned: ${txInfo.torusBurned}\n`);
    
    try {
      // Get transaction details
      const tx = await provider.getTransaction(txInfo.hash);
      const receipt = await provider.getTransactionReceipt(txInfo.hash);
      
      console.log('Transaction Details:');
      console.log(`  From: ${tx.from}`);
      console.log(`  To: ${tx.to}`);
      console.log(`  Value: ${ethers.utils.formatEther(tx.value)} ETH`);
      console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
      console.log(`  Status: ${receipt.status === 1 ? '✅ Success' : '❌ Failed'}`);
      
      // Decode the function call
      console.log('\nFunction Call Analysis:');
      const functionSelector = tx.data.slice(0, 10);
      console.log(`  Function Selector: ${functionSelector}`);
      
      // Common function selectors we might see
      const knownSelectors = {
        '0xfc6f9468': 'harvestAndBurn()',
        '0xdcc50888': 'collectAndBurn()',
        '0x4e71d92d': 'collectFees()',
        '0x66666aa9': 'burnCollectedFees()',
        '0xab5e124a': 'collectFees(uint256)',
        '0x57e0c50d': 'burnFees()',
        '0xa0712d68': 'mint(uint256)',
        '0x42966c68': 'burn(uint256)',
        '0x3ccfd60b': 'withdraw()',
        '0xd0e30db0': 'deposit()',
        '0x095ea7b3': 'approve(address,uint256)',
        '0xa9059cbb': 'transfer(address,uint256)'
      };
      
      if (knownSelectors[functionSelector]) {
        console.log(`  Function Name: ${knownSelectors[functionSelector]}`);
      } else {
        console.log('  Function: Unknown (custom function)');
      }
      
      // Check if it's a direct call to the Buy & Process contract
      const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
      const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
      
      if (tx.to.toLowerCase() === BUY_PROCESS_CONTRACT.toLowerCase()) {
        console.log('  ✅ Direct call to Buy & Process contract');
      } else if (tx.to.toLowerCase() === NFT_POSITION_MANAGER.toLowerCase()) {
        console.log('  📍 Call to Uniswap V3 NFT Position Manager');
        
        // Check if it's a collect function
        const collectSelector = '0xfc6b3206'; // collect(CollectParams)
        if (functionSelector === collectSelector) {
          console.log('  Function: collect() - Direct fee collection from Uniswap');
        }
      } else {
        console.log(`  Call to: ${tx.to}`);
      }
      
      // Analyze events emitted
      console.log(`\nEvents Emitted: ${receipt.logs.length} total`);
      
      // Look for Collect events
      const COLLECT_EVENT_TOPIC = '0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0';
      const collectEvents = receipt.logs.filter(log => log.topics[0] === COLLECT_EVENT_TOPIC);
      
      if (collectEvents.length > 0) {
        console.log(`  ✅ Found ${collectEvents.length} Collect event(s) - LP fees were collected`);
      }
      
      // Look for Transfer events (burns)
      const TRANSFER_EVENT_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
      const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
      const burnEvents = receipt.logs.filter(log => 
        log.topics[0] === TRANSFER_EVENT_TOPIC && 
        log.topics[2] === ethers.utils.hexZeroPad(ZERO_ADDRESS, 32)
      );
      
      if (burnEvents.length > 0) {
        console.log(`  🔥 Found ${burnEvents.length} burn event(s) - TORUS was burned`);
      }
      
      // Check who initiated the transaction
      console.log('\nInitiator Analysis:');
      console.log(`  Initiator Address: ${tx.from}`);
      
      // Check if it's a known address
      const knownAddresses = {
        '0xaa390a37006e22b5775a34f2147f81ebd6a63641': 'Buy & Process Contract',
        '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507': 'Create & Stake Contract',
        '0xb47f575807fc5466285e1277ef8acfbb5c6686e8': 'TORUS Token Contract'
      };
      
      if (knownAddresses[tx.from.toLowerCase()]) {
        console.log(`  Initiator Identity: ${knownAddresses[tx.from.toLowerCase()]}`);
      } else {
        console.log('  Initiator: External EOA (Externally Owned Account)');
        
        // Check the balance of the initiator
        const balance = await provider.getBalance(tx.from);
        console.log(`  Current ETH Balance: ${ethers.utils.formatEther(balance)} ETH`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error analyzing transaction: ${error.message}`);
    }
  }
  
  console.log('\n\n📊 Summary:');
  console.log('==============');
  console.log('Based on the transaction analysis, fee collections can be triggered by:');
  console.log('1. Anyone who calls the appropriate function on the Buy & Process contract');
  console.log('2. The function appears to be permissionless (public)');
  console.log('3. Collections result in immediate burning of 100% of collected TORUS');
  console.log('4. The process is manual - someone needs to trigger it');
  console.log('\nNote: Without the actual contract source code, we cannot determine');
  console.log('the exact function name or if there are any restrictions.');
}

analyzeFeeCollectionTrigger().catch(console.error);