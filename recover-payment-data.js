#!/usr/bin/env node

/**
 * Recovers payment data from transaction input data
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function recoverPaymentData() {
  console.log('🔍 Recovering payment data from transaction input data...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  
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
  
  let fixedStakes = 0;
  let fixedCreates = 0;
  
  // Fix stakes with missing payment data (days 17-19)
  console.log('Recovering stake payment data...');
  for (const stake of cachedData.stakingData.stakeEvents) {
    if (stake.costTitanX === '0' && stake.protocolDay >= 17) {
      try {
        // Get the transaction that created this stake
        const txHash = await getTransactionHashForEvent(provider, stake.blockNumber, 'Staked', stake.user, stake.id);
        if (txHash) {
          const tx = await provider.getTransaction(txHash);
          
          if (tx && tx.data && tx.data !== '0x') {
            try {
              const decoded = iface.parseTransaction({ data: tx.data, value: tx.value });
              
              if (decoded.name === 'stakeTokensWithTitanX') {
                stake.costTitanX = decoded.args.titanXAmount.toString();
                stake.rawCostTitanX = decoded.args.titanXAmount.toString();
                stake.costETH = '0';
                stake.rawCostETH = '0';
                fixedStakes++;
                console.log(`  ✓ Fixed stake ${stake.id}: ${ethers.utils.formatEther(decoded.args.titanXAmount)} TitanX`);
              } else if (decoded.name === 'stakeTokens') {
                stake.costETH = tx.value.toString();
                stake.rawCostETH = tx.value.toString();
                stake.costTitanX = '0';
                stake.rawCostTitanX = '0';
                fixedStakes++;
                console.log(`  ✓ Fixed stake ${stake.id}: ${ethers.utils.formatEther(tx.value)} ETH`);
              }
            } catch (e) {
              console.log(`  ⚠ Could not decode transaction for stake ${stake.id}`);
            }
          }
        }
      } catch (e) {
        console.log(`  ✗ Error recovering stake ${stake.id}: ${e.message}`);
      }
    }
  }
  
  console.log('\nRecovering create payment data...');
  for (const create of cachedData.stakingData.createEvents) {
    if (create.costTitanX === '0' && create.protocolDay >= 17) {
      try {
        // Get the transaction that created this create
        const txHash = await getTransactionHashForEvent(provider, create.blockNumber, 'Created', create.user, create.id);
        if (txHash) {
          const tx = await provider.getTransaction(txHash);
          
          if (tx && tx.data && tx.data !== '0x') {
            try {
              const decoded = iface.parseTransaction({ data: tx.data, value: tx.value });
              
              if (decoded.name === 'createTokensWithTitanX') {
                create.titanAmount = decoded.args.titanXAmount.toString();
                create.titanXAmount = decoded.args.titanXAmount.toString();
                create.costTitanX = decoded.args.titanXAmount.toString();
                create.ethAmount = '0';
                create.costETH = '0';
                fixedCreates++;
                console.log(`  ✓ Fixed create ${create.id}: ${ethers.utils.formatEther(decoded.args.titanXAmount)} TitanX`);
              } else if (decoded.name === 'createTokens') {
                create.ethAmount = tx.value.toString();
                create.costETH = tx.value.toString();
                create.titanAmount = '0';
                create.titanXAmount = '0';
                create.costTitanX = '0';
                fixedCreates++;
                console.log(`  ✓ Fixed create ${create.id}: ${ethers.utils.formatEther(tx.value)} ETH`);
              }
            } catch (e) {
              console.log(`  ⚠ Could not decode transaction for create ${create.id}`);
            }
          }
        }
      } catch (e) {
        console.log(`  ✗ Error recovering create ${create.id}: ${e.message}`);
      }
    }
  }
  
  // Save updated data
  cachedData.lastUpdated = new Date().toISOString();
  fs.writeFileSync(dataPath, JSON.stringify(cachedData, null, 2));
  
  console.log(`\n✅ Recovered payment data for ${fixedStakes} stakes and ${fixedCreates} creates`);
  
  // Verify the fix
  const titanxByDay = { 17: 0, 18: 0, 19: 0 };
  
  cachedData.stakingData.createEvents
    .filter(e => e.protocolDay >= 17 && e.protocolDay <= 19)
    .forEach(c => {
      const amount = parseFloat(c.titanAmount || '0');
      if (amount > 0) {
        titanxByDay[c.protocolDay] += parseFloat(ethers.utils.formatEther(c.titanAmount));
      }
    });
  
  console.log('\nTitanX used for creates by day (after recovery):');
  console.log('Day 17:', titanxByDay[17].toFixed(2), 'TitanX');
  console.log('Day 18:', titanxByDay[18].toFixed(2), 'TitanX');  
  console.log('Day 19:', titanxByDay[19].toFixed(2), 'TitanX');
}

// Helper function to find transaction hash for an event
async function getTransactionHashForEvent(provider, blockNumber, eventName, user, index) {
  try {
    const block = await provider.getBlockWithTransactions(blockNumber);
    
    // Look for transactions to the staking contract
    const STAKING_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
    
    for (const tx of block.transactions) {
      if (tx.to && tx.to.toLowerCase() === STAKING_CONTRACT.toLowerCase()) {
        // Get transaction receipt to check logs
        const receipt = await provider.getTransactionReceipt(tx.hash);
        
        // Look for the specific event log
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() === STAKING_CONTRACT.toLowerCase()) {
            try {
              // Check if this log matches our event
              const eventABI = eventName === 'Staked' ? 
                'event Staked(address indexed user, uint256 indexed stakeIndex, uint256 principal, uint256 shares, uint256 stakingDays, uint256 startTime)' :
                'event Created(address indexed user, uint256 indexed stakeIndex, uint256 torusAmount, uint256 endTime, uint256 startTime)';
                
              const eventIface = new ethers.utils.Interface([eventABI]);
              const parsed = eventIface.parseLog(log);
              
              if (parsed.name === eventName && 
                  parsed.args.user.toLowerCase() === user.toLowerCase() && 
                  parsed.args.stakeIndex.toString() === index.toString()) {
                return tx.hash;
              }
            } catch (e) {
              // Not the right event, continue
            }
          }
        }
      }
    }
  } catch (e) {
    console.log(`Error finding transaction for ${eventName} ${user}:${index}:`, e.message);
  }
  
  return null;
}

// Run the recovery
recoverPaymentData().catch(console.error);