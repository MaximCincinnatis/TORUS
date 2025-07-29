#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');

async function debugEvents() {
  console.log('🔍 Debugging event structure...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const STAKING_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  // Load cached data
  const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  // Get one problematic create
  const testCreate = cachedData.stakingData.createEvents
    .find(c => c.protocolDay === 18 && c.costTitanX === '0');
  
  if (!testCreate) {
    console.log('No test create found');
    return;
  }
  
  console.log('Test create:', {
    id: testCreate.id,
    user: testCreate.user,
    blockNumber: testCreate.blockNumber,
    protocolDay: testCreate.protocolDay
  });
  
  // Get the block
  const block = await provider.getBlockWithTransactions(testCreate.blockNumber);
  console.log(`\nBlock ${testCreate.blockNumber} has ${block.transactions.length} transactions`);
  
  // Find transactions to the staking contract
  const stakingTxs = block.transactions.filter(tx => 
    tx.to && tx.to.toLowerCase() === STAKING_CONTRACT.toLowerCase()
  );
  
  console.log(`Found ${stakingTxs.length} transactions to staking contract`);
  
  // Get receipts for these transactions
  for (let i = 0; i < Math.min(stakingTxs.length, 3); i++) {
    const tx = stakingTxs[i];
    console.log(`\nTransaction ${i + 1}: ${tx.hash}`);
    console.log(`  From: ${tx.from}`);
    console.log(`  Value: ${ethers.utils.formatEther(tx.value)} ETH`);
    
    const receipt = await provider.getTransactionReceipt(tx.hash);
    console.log(`  Status: ${receipt.status ? 'success' : 'failed'}`);
    console.log(`  Logs: ${receipt.logs.length}`);
    
    // Check if any logs are Created events
    const createdEventTopic = ethers.utils.id('Created(address,uint256,uint256,uint256,uint256)');
    const createdLogs = receipt.logs.filter(log => 
      log.topics[0] === createdEventTopic && 
      log.address.toLowerCase() === STAKING_CONTRACT.toLowerCase()
    );
    
    if (createdLogs.length > 0) {
      console.log(`  ✓ Found ${createdLogs.length} Created events`);
      
      // Decode the event
      const eventABI = 'event Created(address indexed user, uint256 indexed stakeIndex, uint256 torusAmount, uint256 endTime, uint256 startTime)';
      const eventIface = new ethers.utils.Interface([eventABI]);
      
      createdLogs.forEach((log, idx) => {
        try {
          const parsed = eventIface.parseLog(log);
          console.log(`    Event ${idx}: user=${parsed.args.user}, index=${parsed.args.stakeIndex.toString()}`);
          
          // Check if this matches our test create
          if (parsed.args.user.toLowerCase() === testCreate.user.toLowerCase() && 
              parsed.args.stakeIndex.toString() === testCreate.id.toString()) {
            console.log(`    🎯 MATCH! This is our create`);
            
            // Now decode the transaction
            const contractABI = [
              'function createTokens(uint256 amount, uint256 stakingDays) payable',
              'function createTokensWithTitanX(uint256 amount, uint256 stakingDays, uint256 titanXAmount)'
            ];
            const txIface = new ethers.utils.Interface(contractABI);
            
            try {
              const decoded = txIface.parseTransaction({ data: tx.data, value: tx.value });
              console.log(`    💰 Payment: ${decoded.name}`);
              if (decoded.name === 'createTokensWithTitanX') {
                console.log(`    💎 TitanX: ${ethers.utils.formatEther(decoded.args.titanXAmount)}`);
              } else if (decoded.name === 'createTokens') {
                console.log(`    💎 ETH: ${ethers.utils.formatEther(tx.value)}`);
              }
            } catch (e) {
              console.log(`    ❌ Could not decode tx: ${e.message}`);
            }
          }
        } catch (e) {
          console.log(`    ❌ Could not parse log: ${e.message}`);
        }
      });
    } else {
      console.log(`  No Created events found`);
    }
  }
}

debugEvents().catch(console.error);