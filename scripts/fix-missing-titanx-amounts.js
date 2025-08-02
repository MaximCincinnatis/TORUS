#!/usr/bin/env node

/**
 * Fix missing TitanX amounts for creates and stakes
 * Fetches from blockchain and updates cached-data.json
 */

const { ethers } = require('ethers');
const fs = require('fs');

async function fixMissingTitanXAmounts() {
  console.log('🔧 Fixing missing TitanX amounts for creates and stakes...\n');
  
  try {
    // Load existing data
    const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
    
    // TitanX contract for Transfer events
    const TITANX_ADDRESS = '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1';
    const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
    
    const titanxAbi = ['event Transfer(address indexed from, address indexed to, uint256 value)'];
    const titanxContract = new ethers.Contract(TITANX_ADDRESS, titanxAbi, provider);
    
    let fixedCreates = 0;
    let fixedStakes = 0;
    
    // Fix creates with missing titanAmount
    console.log('📊 Checking creates for missing TitanX amounts...');
    
    // First count how many need fixing
    let needsFixing = 0;
    for (const create of cachedData.stakingData.createEvents) {
      if ((!create.titanAmount || create.titanAmount === "0") && 
          (!create.costETH || create.costETH === "0")) {
        needsFixing++;
      }
    }
    console.log(`Found ${needsFixing} creates that need TitanX amount fixing`);
    
    for (let i = 0; i < cachedData.stakingData.createEvents.length; i++) {
      const create = cachedData.stakingData.createEvents[i];
      
      // Skip if already has titanAmount > 0 or has ETH cost
      if ((create.titanAmount && create.titanAmount !== "0") || 
          (create.costETH && create.costETH !== "0")) {
        continue;
      }
      
      try {
        // Skip if no transaction hash
        if (!create.transactionHash) {
          console.log(`⚠️  Skipping create ${create.eventId} - no transaction hash`);
          continue;
        }
        
        // Fetch TitanX transfers in this transaction
        const receipt = await provider.getTransactionReceipt(create.transactionHash);
        if (!receipt) {
          console.log(`⚠️  Skipping create ${create.eventId} - no receipt found`);
          continue;
        }
        
        // Look for TitanX transfer TO the create/stake contract
        const transfers = await titanxContract.queryFilter(
          titanxContract.filters.Transfer(null, CREATE_STAKE_CONTRACT),
          receipt.blockNumber,
          receipt.blockNumber
        );
        
        // Find transfer in same transaction
        const titanTransfer = transfers.find(t => t.transactionHash === create.transactionHash);
        
        if (titanTransfer) {
          cachedData.stakingData.createEvents[i].titanAmount = titanTransfer.args.value.toString();
          cachedData.stakingData.createEvents[i].rawCostTitanX = titanTransfer.args.value.toString();
          fixedCreates++;
          console.log(`✅ Fixed create ${create.eventId}: ${ethers.utils.formatUnits(titanTransfer.args.value, 9)} TitanX`);
        }
      } catch (err) {
        console.log(`⚠️  Error processing create ${create.eventId}: ${err.message}`);
      }
    }
    
    // Fix stakes - ensure rawCostTitanX is set
    console.log('\n📊 Checking stakes for missing rawCostTitanX...');
    for (let i = 0; i < cachedData.stakingData.stakeEvents.length; i++) {
      const stake = cachedData.stakingData.stakeEvents[i];
      
      if (!stake.rawCostTitanX && stake.titanAmount) {
        cachedData.stakingData.stakeEvents[i].rawCostTitanX = stake.titanAmount;
        fixedStakes++;
      }
    }
    
    // Save updated data
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
    
    console.log(`\n✅ Fixed ${fixedCreates} creates and ${fixedStakes} stakes`);
    console.log('✅ cached-data.json updated successfully');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the fix
fixMissingTitanXAmounts();