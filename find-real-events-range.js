#!/usr/bin/env node

/**
 * Find the actual block range where Created events exist
 */

const { ethers } = require('ethers');
const fs = require('fs');

async function findRealEventsRange() {
  console.log('🔍 Finding the actual block range with Created events...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const STAKING_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  const contractABI = [
    'event Created(address indexed user, uint256 indexed stakeIndex, uint256 torusAmount, uint256 endTime, uint256 startTime)'
  ];
  const contract = new ethers.Contract(STAKING_CONTRACT, contractABI, provider);
  
  // Load cached data to see what we expect
  const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  // Find a create that we know has payment data (like the Day 17 one with huge TitanX)
  const workingCreate = cachedData.stakingData.createEvents
    .find(c => c.protocolDay === 17 && parseFloat(c.titanAmount || '0') > 0);
  
  if (workingCreate) {
    console.log('Found a working create with payment data:');
    console.log(`  ID: ${workingCreate.id}, User: ${workingCreate.user.slice(0,8)}...`);
    console.log(`  Block: ${workingCreate.blockNumber}, Day: ${workingCreate.protocolDay}`);
    console.log(`  TitanX: ${workingCreate.titanAmount}`);
    
    // Search around this block
    const centerBlock = workingCreate.blockNumber;
    const searchRadius = 1000;
    
    console.log(`\nSearching for Created events around block ${centerBlock} (±${searchRadius})...`);
    
    try {
      const events = await contract.queryFilter(
        contract.filters.Created(),
        centerBlock - searchRadius,
        centerBlock + searchRadius
      );
      
      console.log(`✅ Found ${events.length} Created events in this range`);
      
      if (events.length > 0) {
        console.log('\nFirst 10 events:');
        events.slice(0, 10).forEach((e, i) => {
          console.log(`  ${i+1}. Block ${e.blockNumber}: User ${e.args.user.slice(0,8)}..., Index ${e.args.stakeIndex}`);
        });
        
        // Check if our working create is in there
        const matchingEvent = events.find(e => 
          e.args.user.toLowerCase() === workingCreate.user.toLowerCase() &&
          e.args.stakeIndex.toString() === workingCreate.id.toString()
        );
        
        if (matchingEvent) {
          console.log(`\n🎯 Found matching event for our working create!`);
          console.log(`   Block: ${matchingEvent.blockNumber} (cached: ${workingCreate.blockNumber})`);
          
          if (matchingEvent.blockNumber !== workingCreate.blockNumber) {
            console.log('   ⚠️ Block numbers don\'t match - cached data may be incorrect');
          }
          
          // Get the transaction to verify payment data
          const tx = await provider.getTransaction(matchingEvent.transactionHash);
          
          const txABI = [
            'function createTokens(uint256 amount, uint256 stakingDays) payable',
            'function createTokensWithTitanX(uint256 amount, uint256 stakingDays, uint256 titanXAmount)'
          ];
          const txInterface = new ethers.utils.Interface(txABI);
          
          if (tx && tx.data && tx.data !== '0x') {
            try {
              const decoded = txInterface.parseTransaction({ data: tx.data, value: tx.value });
              console.log(`   💰 Payment method: ${decoded.name}`);
              
              if (decoded.name === 'createTokensWithTitanX') {
                console.log(`   💎 TitanX: ${ethers.utils.formatEther(decoded.args.titanXAmount)}`);
                console.log(`   📊 Cached TitanX: ${ethers.utils.formatEther(workingCreate.titanAmount)}`);
                
                if (decoded.args.titanXAmount.toString() === workingCreate.titanAmount) {
                  console.log('   ✅ Payment data matches!');
                } else {
                  console.log('   ❌ Payment data mismatch');
                }
              }
            } catch (e) {
              console.log(`   ❌ Could not decode: ${e.message}`);
            }
          }
        } else {
          console.log('\n❌ Could not find our working create in blockchain events');
        }
        
        // Now expand the search to cover more recent blocks
        console.log('\n🔄 Expanding search to find events for days 17-19...');
        
        const eventBlocks = events.map(e => e.blockNumber);
        const minEventBlock = Math.min(...eventBlocks);
        const maxEventBlock = Math.max(...eventBlocks);
        
        console.log(`Events exist in range: ${minEventBlock} to ${maxEventBlock}`);
        console.log('Now searching beyond this range...');
        
        // Search in the gap after the known events
        const extendedStart = maxEventBlock + 1;
        const extendedEnd = Math.min(extendedStart + 10000, 23020000);
        
        try {
          const extendedEvents = await contract.queryFilter(
            contract.filters.Created(),
            extendedStart,
            extendedEnd
          );
          
          console.log(`Found ${extendedEvents.length} additional events in blocks ${extendedStart}-${extendedEnd}`);
          
          if (extendedEvents.length > 0) {
            console.log('These additional events:');
            extendedEvents.slice(0, 5).forEach((e, i) => {
              console.log(`  ${i+1}. Block ${e.blockNumber}: User ${e.args.user.slice(0,8)}..., Index ${e.args.stakeIndex}`);
            });
          }
          
        } catch (e) {
          console.log(`Error searching extended range: ${e.message}`);
        }
        
      } else {
        console.log('❌ No events found even around the working create block');
      }
      
    } catch (e) {
      console.log(`❌ Error searching: ${e.message}`);
    }
    
  } else {
    console.log('❌ Could not find any create with payment data to use as reference');
  }
}

findRealEventsRange().catch(console.error);