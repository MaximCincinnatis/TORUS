#!/usr/bin/env node

/**
 * Find payment data by searching for Created events around the block numbers
 */

const { ethers } = require('ethers');
const fs = require('fs');

async function findPaymentData() {
  console.log('🔍 Searching for Created events to recover payment data...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const STAKING_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  // Load cached data
  const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  // Contract interface
  const contractABI = [
    'event Created(address indexed user, uint256 indexed stakeIndex, uint256 torusAmount, uint256 endTime, uint256 startTime)',
    'function createTokens(uint256 amount, uint256 stakingDays) payable',
    'function createTokensWithTitanX(uint256 amount, uint256 stakingDays, uint256 titanXAmount)'
  ];
  
  const contract = new ethers.Contract(STAKING_CONTRACT, contractABI, provider);
  const txInterface = new ethers.utils.Interface(contractABI);
  
  // Get creates from days 18-19 that need payment data
  const problemCreates = cachedData.stakingData.createEvents
    .filter(c => c.protocolDay >= 18 && c.protocolDay <= 19 && c.costTitanX === '0')
    .slice(0, 5); // Limit for testing
  
  console.log(`Found ${problemCreates.length} creates needing payment data`);
  
  let fixed = 0;
  
  for (const create of problemCreates) {
    console.log(`\n🔍 Searching for create ${create.id} (user: ${create.user.slice(0,8)}...)`);
    
    // Search for Created events in a range around the block
    const searchStart = create.blockNumber - 10;
    const searchEnd = create.blockNumber + 10;
    
    try {
      const events = await contract.queryFilter(
        contract.filters.Created(create.user, create.id),
        searchStart,
        searchEnd
      );
      
      console.log(`  Found ${events.length} matching events in blocks ${searchStart}-${searchEnd}`);
      
      if (events.length > 0) {
        const event = events[0];
        console.log(`  ✓ Found event in block ${event.blockNumber}, tx: ${event.transactionHash}`);
        
        // Get the transaction
        const tx = await provider.getTransaction(event.transactionHash);
        
        if (tx && tx.data && tx.data !== '0x') {
          try {
            const decoded = txInterface.parseTransaction({ data: tx.data, value: tx.value });
            console.log(`  📋 Function: ${decoded.name}`);
            
            if (decoded.name === 'createTokensWithTitanX') {
              const titanXAmount = decoded.args.titanXAmount.toString();
              create.titanAmount = titanXAmount;
              create.titanXAmount = titanXAmount;
              create.costTitanX = titanXAmount;
              create.ethAmount = '0';
              create.costETH = '0';
              fixed++;
              console.log(`  ✅ Fixed: ${ethers.utils.formatEther(titanXAmount)} TitanX`);
              
            } else if (decoded.name === 'createTokens') {
              const ethAmount = tx.value.toString();
              create.ethAmount = ethAmount;
              create.costETH = ethAmount;
              create.titanAmount = '0';
              create.titanXAmount = '0';
              create.costTitanX = '0';
              fixed++;
              console.log(`  ✅ Fixed: ${ethers.utils.formatEther(ethAmount)} ETH`);
            }
            
          } catch (e) {
            console.log(`  ❌ Could not decode transaction: ${e.message}`);
          }
        }
      } else {
        // Try broader search without user filter
        console.log(`  🔄 Trying broader search...`);
        const allEvents = await contract.queryFilter(
          contract.filters.Created(),
          create.blockNumber,
          create.blockNumber
        );
        
        console.log(`  Found ${allEvents.length} total Created events in block ${create.blockNumber}`);
        
        // Look for matching user and index
        const match = allEvents.find(e => 
          e.args.user.toLowerCase() === create.user.toLowerCase() &&
          e.args.stakeIndex.toString() === create.id.toString()
        );
        
        if (match) {
          console.log(`  ✓ Found matching event in same block!`);
          // Process the transaction...
          const tx = await provider.getTransaction(match.transactionHash);
          
          if (tx && tx.data && tx.data !== '0x') {
            try {
              const decoded = txInterface.parseTransaction({ data: tx.data, value: tx.value });
              console.log(`  📋 Function: ${decoded.name}`);
              
              if (decoded.name === 'createTokensWithTitanX') {
                const titanXAmount = decoded.args.titanXAmount.toString();
                create.titanAmount = titanXAmount;
                create.titanXAmount = titanXAmount;
                create.costTitanX = titanXAmount;
                create.ethAmount = '0';
                create.costETH = '0';
                fixed++;
                console.log(`  ✅ Fixed: ${ethers.utils.formatEther(titanXAmount)} TitanX`);
                
              } else if (decoded.name === 'createTokens') {
                const ethAmount = tx.value.toString();
                create.ethAmount = ethAmount;
                create.costETH = ethAmount;
                create.titanAmount = '0';
                create.titanXAmount = '0';
                create.costTitanX = '0';
                fixed++;
                console.log(`  ✅ Fixed: ${ethers.utils.formatEther(ethAmount)} ETH`);
              }
              
            } catch (e) {
              console.log(`  ❌ Could not decode transaction: ${e.message}`);
            }
          }
        } else {
          console.log(`  ❌ No matching event found`);
        }
      }
      
    } catch (e) {
      console.log(`  ❌ Error searching: ${e.message}`);
    }
  }
  
  if (fixed > 0) {
    // Save the fixed data
    cachedData.lastUpdated = new Date().toISOString();
    fs.writeFileSync('public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
    console.log(`\n✅ Successfully recovered payment data for ${fixed} creates!`);
    
    // Show summary
    const summary = { 18: { titanx: 0, eth: 0 }, 19: { titanx: 0, eth: 0 } };
    
    cachedData.stakingData.createEvents
      .filter(c => c.protocolDay >= 18 && c.protocolDay <= 19)
      .forEach(c => {
        const day = c.protocolDay;
        if (parseFloat(c.titanAmount || '0') > 0) {
          summary[day].titanx += parseFloat(ethers.utils.formatEther(c.titanAmount));
        }
        if (parseFloat(c.ethAmount || '0') > 0) {
          summary[day].eth += parseFloat(ethers.utils.formatEther(c.ethAmount));
        }
      });
    
    console.log('\nPayment data summary:');
    console.log(`Day 18: ${summary[18].titanx.toFixed(2)} TitanX, ${summary[18].eth.toFixed(4)} ETH`);
    console.log(`Day 19: ${summary[19].titanx.toFixed(2)} TitanX, ${summary[19].eth.toFixed(4)} ETH`);
    
  } else {
    console.log('\n⚠️  No payment data was recovered');
  }
}

findPaymentData().catch(console.error);