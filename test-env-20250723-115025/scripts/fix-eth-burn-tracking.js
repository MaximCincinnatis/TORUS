#!/usr/bin/env node

/**
 * Fix ETH burn tracking by properly attributing ETH burns to dates
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function fixEthBurnTracking() {
  console.log('🔧 Fixing ETH burn tracking...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    
    // Load existing data
    const dataPath = path.join(__dirname, '../public/data/buy-process-data.json');
    const existingData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // The contract tracks ethUsedForBurns = 0.54907073917167167 ETH
    // We need to distribute this across the days that had Buy & Burn operations
    
    console.log(`Total ETH used for burns: ${existingData.totals.ethUsedForBurns} ETH`);
    
    // Count total Buy & Burn operations to distribute ETH proportionally
    const totalBuyAndBurnOps = existingData.dailyData.reduce((sum, day) => sum + day.buyAndBurnCount, 0);
    console.log(`Total Buy & Burn operations: ${totalBuyAndBurnOps}`);
    
    if (totalBuyAndBurnOps === 0) {
      console.log('No Buy & Burn operations found');
      return;
    }
    
    // Calculate ETH per burn operation
    const ethPerBurnOp = parseFloat(existingData.totals.ethUsedForBurns) / totalBuyAndBurnOps;
    console.log(`ETH per burn operation (average): ${ethPerBurnOp.toFixed(6)} ETH\n`);
    
    // Update daily data with proportional ETH amounts
    let totalDistributed = 0;
    existingData.dailyData.forEach(day => {
      if (day.buyAndBurnCount > 0) {
        // Distribute ETH proportionally based on number of burns
        day.ethUsedForBurns = day.buyAndBurnCount * ethPerBurnOp;
        totalDistributed += day.ethUsedForBurns;
        
        console.log(`${day.date}: ${day.buyAndBurnCount} burns -> ${day.ethUsedForBurns.toFixed(6)} ETH`);
      }
    });
    
    console.log(`\nTotal distributed: ${totalDistributed.toFixed(6)} ETH`);
    console.log(`Difference from total: ${(parseFloat(existingData.totals.ethUsedForBurns) - totalDistributed).toFixed(6)} ETH`);
    
    // Adjust the last day with burns to account for any rounding difference
    const daysWithBurns = existingData.dailyData.filter(d => d.buyAndBurnCount > 0);
    if (daysWithBurns.length > 0) {
      const lastDay = daysWithBurns[daysWithBurns.length - 1];
      const adjustment = parseFloat(existingData.totals.ethUsedForBurns) - totalDistributed;
      lastDay.ethUsedForBurns += adjustment;
      console.log(`\nAdjusted ${lastDay.date} by ${adjustment.toFixed(6)} ETH for exact total`);
    }
    
    // Save updated data
    fs.writeFileSync(dataPath, JSON.stringify(existingData, null, 2));
    
    console.log('\n✅ Fixed ETH burn tracking');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixEthBurnTracking().catch(console.error);