#!/usr/bin/env node

/**
 * Recovers payment data by getting transaction hashes from event logs
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function recoverPaymentDataDirect() {
  console.log('🔍 Recovering payment data from event transactions...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const STAKING_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  // Load cached data
  const dataPath = path.join(__dirname, 'public/data/cached-data.json');
  const cachedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  
  // Contract ABI for decoding function calls
  const contractABI = [
    'function stakeTokens(uint256 stakeAmount, uint256 stakingDays) payable',
    'function stakeTokensWithTitanX(uint256 stakeAmount, uint256 stakingDays, uint256 titanXAmount)',
    'function createTokens(uint256 amount, uint256 stakingDays) payable', 
    'function createTokensWithTitanX(uint256 amount, uint256 stakingDays, uint256 titanXAmount)'
  ];
  
  const iface = new ethers.utils.Interface(contractABI);
  
  // Set up event filters
  const stakeEventABI = 'event Staked(address indexed user, uint256 indexed stakeIndex, uint256 principal, uint256 shares, uint256 stakingDays, uint256 startTime)';
  const createEventABI = 'event Created(address indexed user, uint256 indexed stakeIndex, uint256 torusAmount, uint256 endTime, uint256 startTime)';
  
  const contract = new ethers.Contract(STAKING_CONTRACT, [stakeEventABI, createEventABI], provider);
  
  let fixedCreates = 0;
  let sampleCount = 0;
  
  console.log('Recovering create payment data for days 18-19...');
  
  // Focus on creates from days 18-19 that have zero payment data
  const problematicCreates = cachedData.stakingData.createEvents
    .filter(c => c.protocolDay >= 18 && c.protocolDay <= 19 && c.costTitanX === '0')
    .slice(0, 10); // Limit to first 10 for testing
  
  console.log(`Found ${problematicCreates.length} creates needing payment data recovery`);
  
  for (const create of problematicCreates) {
    try {
      console.log(`\n🔍 Processing create ${create.id} from block ${create.blockNumber}...`);
      
      // Get all Created events from this block
      const createdEvents = await contract.queryFilter(
        contract.filters.Created(),
        create.blockNumber,
        create.blockNumber
      );
      
      // Find the specific event for this create
      const matchingEvent = createdEvents.find(e => 
        e.args.user.toLowerCase() === create.user.toLowerCase() && 
        e.args.stakeIndex.toString() === create.id.toString()
      );
      
      if (matchingEvent) {
        console.log(`  ✓ Found matching event in tx: ${matchingEvent.transactionHash}`);
        
        // Get the transaction details
        const tx = await provider.getTransaction(matchingEvent.transactionHash);
        
        if (tx && tx.data && tx.data !== '0x') {
          try {
            const decoded = iface.parseTransaction({ data: tx.data, value: tx.value });
            console.log(`  📋 Function called: ${decoded.name}`);
            
            if (decoded.name === 'createTokensWithTitanX') {
              const titanXAmount = decoded.args.titanXAmount.toString();
              create.titanAmount = titanXAmount;
              create.titanXAmount = titanXAmount;
              create.costTitanX = titanXAmount;
              create.ethAmount = '0';
              create.costETH = '0';
              fixedCreates++;
              console.log(`  ✅ Fixed with ${ethers.utils.formatEther(titanXAmount)} TitanX`);
            } else if (decoded.name === 'createTokens') {
              const ethAmount = tx.value.toString();
              create.ethAmount = ethAmount;
              create.costETH = ethAmount;
              create.titanAmount = '0';
              create.titanXAmount = '0';
              create.costTitanX = '0';
              fixedCreates++;
              console.log(`  ✅ Fixed with ${ethers.utils.formatEther(ethAmount)} ETH`);
            }
          } catch (e) {
            console.log(`  ❌ Could not decode transaction: ${e.message}`);
          }
        } else {
          console.log(`  ⚠️  No transaction data found`);
        }
      } else {
        console.log(`  ❌ Could not find matching Created event`);
      }
    } catch (e) {
      console.log(`  ❌ Error processing create ${create.id}: ${e.message}`);
    }
  }
  
  // Save updated data
  if (fixedCreates > 0) {
    cachedData.lastUpdated = new Date().toISOString();
    fs.writeFileSync(dataPath, JSON.stringify(cachedData, null, 2));
    console.log(`\n✅ Successfully recovered payment data for ${fixedCreates} creates`);
  } else {
    console.log(`\n⚠️  No payment data was recovered`);
  }
  
  // Show results
  const titanxByDay = { 18: 0, 19: 0 };
  let ethByDay = { 18: 0, 19: 0 };
  
  cachedData.stakingData.createEvents
    .filter(e => e.protocolDay >= 18 && e.protocolDay <= 19)
    .forEach(c => {
      const day = c.protocolDay;
      const titanx = parseFloat(c.titanAmount || '0');
      const eth = parseFloat(c.ethAmount || '0');
      
      if (titanx > 0) {
        titanxByDay[day] += parseFloat(ethers.utils.formatEther(c.titanAmount));
      }
      if (eth > 0) {
        ethByDay[day] += parseFloat(ethers.utils.formatEther(c.ethAmount));
      }
    });
  
  console.log('\nPayment data summary for days 18-19:');
  console.log(`Day 18: ${titanxByDay[18].toFixed(2)} TitanX, ${ethByDay[18].toFixed(4)} ETH`);
  console.log(`Day 19: ${titanxByDay[19].toFixed(2)} TitanX, ${ethByDay[19].toFixed(4)} ETH`);
}

// Run the recovery
recoverPaymentDataDirect().catch(console.error);