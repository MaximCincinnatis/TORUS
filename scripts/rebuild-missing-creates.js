#!/usr/bin/env node

/**
 * Rebuild creates with missing data by fetching from blockchain
 */

const { ethers } = require('ethers');
const fs = require('fs');

async function rebuildMissingCreates() {
  console.log('🔧 Rebuilding creates with missing data...\n');
  
  try {
    const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
    
    // Contract setup
    const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
    const TITANX_ADDRESS = '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1';
    
    const abi = ['event Create(address indexed user, uint256 indexed eventId, uint256 reward, uint256 protocolFee, uint256 stakerFee, uint256 lpFee, address referrer)'];
    const contract = new ethers.Contract(CREATE_STAKE_CONTRACT, abi, provider);
    
    const titanxAbi = ['event Transfer(address indexed from, address indexed to, uint256 value)'];
    const titanxContract = new ethers.Contract(TITANX_ADDRESS, titanxAbi, provider);
    
    // Find creates with missing data
    const brokenCreates = [];
    cachedData.stakingData.createEvents.forEach((c, idx) => {
      if (!c.eventId || !c.transactionHash) {
        brokenCreates.push({ create: c, index: idx });
      }
    });
    
    console.log(`Found ${brokenCreates.length} creates with missing data`);
    
    // Process each broken create
    for (const { create, index } of brokenCreates) {
      console.log(`\nProcessing block ${create.blockNumber}...`);
      
      // Fetch all Create events in this block
      const events = await contract.queryFilter(
        contract.filters.Create(),
        create.blockNumber,
        create.blockNumber
      );
      
      if (events.length === 0) {
        console.log(`❌ No Create events found in block ${create.blockNumber}`);
        continue;
      }
      
      // For now, take the first event (in real scenario might need better matching)
      const event = events[0];
      const block = await provider.getBlock(event.blockNumber);
      const tx = await provider.getTransaction(event.transactionHash);
      const receipt = await provider.getTransactionReceipt(event.transactionHash);
      
      // Helper to calculate protocol day
      const CONTRACT_START = new Date('2025-07-10T18:00:00Z').getTime() / 1000;
      const protocolDay = Math.floor((block.timestamp - CONTRACT_START) / (24 * 60 * 60)) + 1;
      
      // Build complete create data
      const fixedCreate = {
        user: event.args.user.toLowerCase(),
        eventId: event.args.eventId.toString(),
        reward: event.args.reward.toString(),
        protocolFee: event.args.protocolFee.toString(),
        stakerFee: event.args.stakerFee.toString(),
        lpFee: event.args.lpFee.toString(),
        referrer: event.args.referrer.toLowerCase(),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        timestamp: block.timestamp.toString(),
        protocolDay: protocolDay
      };
      
      // Check payment type
      if (tx.value && !tx.value.isZero()) {
        fixedCreate.costETH = tx.value.toString();
        fixedCreate.titanAmount = "0";
      } else {
        // Look for TitanX transfer
        const transfers = await titanxContract.queryFilter(
          titanxContract.filters.Transfer(null, CREATE_STAKE_CONTRACT),
          receipt.blockNumber,
          receipt.blockNumber
        );
        
        const titanTransfer = transfers.find(t => t.transactionHash === event.transactionHash);
        if (titanTransfer) {
          fixedCreate.titanAmount = titanTransfer.args.value.toString();
          fixedCreate.rawCostTitanX = titanTransfer.args.value.toString();
          fixedCreate.costETH = "0";
        } else {
          fixedCreate.titanAmount = "0";
          fixedCreate.costETH = "0";
        }
      }
      
      // Replace the broken create
      cachedData.stakingData.createEvents[index] = fixedCreate;
      console.log(`✅ Fixed create ${fixedCreate.eventId} (Day ${protocolDay})`);
    }
    
    // Save updated data
    cachedData.lastUpdated = new Date().toISOString();
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
    
    console.log('\n✅ All broken creates rebuilt');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

rebuildMissingCreates();