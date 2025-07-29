#!/usr/bin/env node

const { ethers } = require('ethers');

async function verifyEarlyBlocks() {
  console.log('🔍 Checking if Created events exist in earlier blocks...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const STAKING_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  const contract = new ethers.Contract(STAKING_CONTRACT, [
    'event Created(address indexed user, uint256 indexed stakeIndex, uint256 torusAmount, uint256 endTime, uint256 startTime)',
    'function createTokens(uint256 amount, uint256 stakingDays) payable',
    'function createTokensWithTitanX(uint256 amount, uint256 stakingDays, uint256 titanXAmount)'
  ], provider);
  
  const txInterface = new ethers.utils.Interface([
    'function createTokens(uint256 amount, uint256 stakingDays) payable',
    'function createTokensWithTitanX(uint256 amount, uint256 stakingDays, uint256 titanXAmount)'
  ]);
  
  // Test a few specific blocks from the "day 18" creates that are actually in 23012xxx range
  const testBlocks = [23012170, 23012485, 23012581, 23012715];
  
  let found = 0;
  
  for (const blockNum of testBlocks) {
    try {
      console.log(`\nChecking block ${blockNum}...`);
      
      const events = await contract.queryFilter(
        contract.filters.Created(),
        blockNum,
        blockNum
      );
      
      if (events.length > 0) {
        console.log(`  ✓ Found ${events.length} Created events`);
        found += events.length;
        
        // Get payment data for first event
        const event = events[0];
        const tx = await provider.getTransaction(event.transactionHash);
        
        if (tx && tx.data && tx.data !== '0x') {
          try {
            const decoded = txInterface.parseTransaction({ data: tx.data, value: tx.value });
            console.log(`  💰 Payment method: ${decoded.name}`);
            
            if (decoded.name === 'createTokensWithTitanX') {
              console.log(`  💎 TitanX amount: ${ethers.utils.formatEther(decoded.args.titanXAmount)}`);
            } else if (decoded.name === 'createTokens') {
              console.log(`  💎 ETH amount: ${ethers.utils.formatEther(tx.value)}`);
            }
            
            // Show event details
            console.log(`  📋 User: ${event.args.user.slice(0,8)}..., Index: ${event.args.stakeIndex}`);
            
          } catch (e) {
            console.log(`  ❌ Could not decode tx: ${e.message}`);
          }
        }
        
      } else {
        console.log(`  ❌ No Created events found`);
      }
      
    } catch (e) {
      console.log(`  ❌ Error: ${e.message}`);
    }
  }
  
  console.log(`\n📊 Summary: Found ${found} total Created events in test blocks`);
  
  if (found > 0) {
    console.log('\n✅ The Created events DO exist in the blockchain!');
    console.log('🔧 The issue is with protocol day calculation in smart-update-fixed.js');
    console.log('📝 These events from earlier blocks got incorrectly assigned to days 18-19');
    console.log('💡 We can recover payment data from these transactions!');
  } else {
    console.log('\n❌ No events found - data may be invalid');
  }
}

verifyEarlyBlocks().catch(console.error);