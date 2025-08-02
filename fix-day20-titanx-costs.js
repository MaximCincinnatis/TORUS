#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');

const RPC_URL = 'https://eth.drpc.org';
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

// Contract addresses
const STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';

// Transaction decoder interface
const INTERFACE = new ethers.utils.Interface([
  'function createWithTitanX(uint256 torusAmount, uint256 titanAmount, uint256 duration)',
  'function createWithETH(uint256 torusAmount, uint256 duration) payable'
]);

async function fetchTitanXCosts() {
  console.log('=== FIXING DAY 20 TITANX COSTS ===\n');
  
  // Load cached data
  const data = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
  
  // Get all Day 20 creates with 0 TitanX cost
  const day20Creates = data.stakingData.createEvents.filter(c => c.protocolDay === 20);
  const needsFix = day20Creates.filter(c => c.costTitanX === '0' || c.costTitanX === '0.0');
  
  console.log(`Found ${day20Creates.length} Day 20 creates`);
  console.log(`${needsFix.length} need TitanX cost data\n`);
  
  let fixed = 0;
  let totalTitanX = 0;
  let totalETH = 0;
  
  for (const create of needsFix) {
    try {
      console.log(`Fetching Create ${create.id} (${create.transactionHash})...`);
      
      const tx = await provider.getTransaction(create.transactionHash);
      const receipt = await provider.getTransactionReceipt(create.transactionHash);
      
      if (tx && receipt && receipt.status === 1) {
        // Decode the transaction
        let titanXAmount = '0';
        let ethAmount = '0';
        
        try {
          const decoded = INTERFACE.parseTransaction({ data: tx.data });
          
          if (decoded.name === 'createWithTitanX') {
            titanXAmount = decoded.args.titanAmount.toString();
            console.log(`  ✓ TitanX: ${ethers.utils.formatEther(titanXAmount)} (${(parseFloat(ethers.utils.formatEther(titanXAmount)) / 1e9).toFixed(3)}B)`);
          } else if (decoded.name === 'createWithETH') {
            ethAmount = tx.value.toString();
            console.log(`  ✓ ETH: ${ethers.utils.formatEther(ethAmount)}`);
          }
        } catch (e) {
          console.log(`  ! Could not decode transaction`);
        }
        
        // Update the create data
        if (titanXAmount !== '0') {
          create.costTitanX = (parseFloat(titanXAmount) / 1e18).toString();
          create.rawCostTitanX = titanXAmount;
          create.titanAmount = titanXAmount;
          create.titanXAmount = titanXAmount;
          totalTitanX += parseFloat(ethers.utils.formatEther(titanXAmount));
          fixed++;
        } else if (ethAmount !== '0') {
          create.costETH = ethers.utils.formatEther(ethAmount);
          create.rawCostETH = ethAmount;
          totalETH += parseFloat(ethers.utils.formatEther(ethAmount));
          fixed++;
        }
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
    }
  }
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`Fixed: ${fixed}/${needsFix.length} creates`);
  console.log(`Total TitanX found: ${totalTitanX.toFixed(2)} (${(totalTitanX / 1e9).toFixed(3)}B)`);
  console.log(`Total ETH found: ${totalETH.toFixed(6)}`);
  
  if (fixed > 0) {
    // Update lastUpdated
    data.lastUpdated = new Date().toISOString();
    
    // Save the fixed data
    const backupFile = `./public/data/cached-data-backup-${Date.now()}.json`;
    fs.writeFileSync(backupFile, JSON.stringify(JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8')), null, 2));
    console.log(`\nBackup saved to: ${backupFile}`);
    
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(data, null, 2));
    console.log(`✅ Updated cached-data.json with ${fixed} fixes`);
  }
}

fetchTitanXCosts().catch(console.error);