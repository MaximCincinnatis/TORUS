#!/usr/bin/env node

/**
 * Update burn data to show actual burns (Transfer to 0x0) instead of contract accounting
 */

const fs = require('fs');
const { ethers } = require('ethers');

const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function updateBurnsToActual() {
  console.log('🔍 Updating burn data to show actual burns...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    const TORUS_CONTRACT = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
    
    // Read current data
    const buyProcessData = JSON.parse(fs.readFileSync('public/data/buy-process-data.json', 'utf8'));
    console.log(`Current total TORUS burnt (contract state): ${buyProcessData.totals.torusBurnt}`);
    
    // Get all actual burn transfers
    const torusABI = [
      'event Transfer(address indexed from, address indexed to, uint256 value)'
    ];
    
    const torusContract = new ethers.Contract(TORUS_CONTRACT, torusABI, provider);
    
    const deployBlock = 22890272;
    const currentBlock = await provider.getBlockNumber();
    
    // Collect all burn transfers by date
    const burnsByDate = new Map();
    const chunkSize = 5000;
    
    for (let start = deployBlock; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      
      const filter = torusContract.filters.Transfer(
        BUY_PROCESS_CONTRACT,
        '0x0000000000000000000000000000000000000000'
      );
      
      const burns = await torusContract.queryFilter(filter, start, end);
      
      for (const burn of burns) {
        const block = await provider.getBlock(burn.blockNumber);
        const date = new Date(block.timestamp * 1000).toISOString().split('T')[0];
        
        if (!burnsByDate.has(date)) {
          burnsByDate.set(date, ethers.BigNumber.from(0));
        }
        
        burnsByDate.set(date, burnsByDate.get(date).add(burn.args.value));
      }
    }
    
    // Calculate total actual burns
    let totalActualBurns = ethers.BigNumber.from(0);
    for (const [date, amount] of burnsByDate) {
      totalActualBurns = totalActualBurns.add(amount);
    }
    
    console.log(`Total actual burns (Transfer to 0x0): ${ethers.utils.formatEther(totalActualBurns)}`);
    
    // Calculate ratio
    const contractTotal = ethers.utils.parseEther(buyProcessData.totals.torusBurnt);
    const ratio = parseFloat(ethers.utils.formatEther(totalActualBurns)) / parseFloat(ethers.utils.formatEther(contractTotal));
    console.log(`Ratio (actual/contract): ${ratio.toFixed(6)}`);
    
    // Update daily data with actual burns
    const updatedDailyData = buyProcessData.dailyData.map((day) => {
      const dateKey = day.date;
      const actualBurnAmount = burnsByDate.get(dateKey);
      
      if (actualBurnAmount) {
        const actualBurn = parseFloat(ethers.utils.formatEther(actualBurnAmount));
        console.log(`${dateKey}: Contract=${day.torusBurned.toFixed(6)}, Actual=${actualBurn.toFixed(6)}`);
        
        return {
          ...day,
          torusBurnedContract: day.torusBurned, // Keep original for reference
          torusBurned: actualBurn // Replace with actual burn
        };
      } else {
        // No actual burn on this day
        return {
          ...day,
          torusBurnedContract: day.torusBurned,
          torusBurned: 0
        };
      }
    });
    
    // Update totals
    const updatedData = {
      ...buyProcessData,
      totals: {
        ...buyProcessData.totals,
        torusBurntContract: buyProcessData.totals.torusBurnt, // Keep original
        torusBurnt: ethers.utils.formatEther(totalActualBurns) // Update to actual
      },
      dailyData: updatedDailyData,
      metadata: {
        ...buyProcessData.metadata,
        note: "torusBurned values reflect actual burns (Transfer to 0x0), not contract accounting"
      }
    };
    
    // Write updated data
    fs.writeFileSync(
      'public/data/buy-process-data.json',
      JSON.stringify(updatedData, null, 2)
    );
    
    console.log('\n✅ Data updated successfully!');
    console.log(`Contract accounting showed: ${buyProcessData.totals.torusBurnt} TORUS`);
    console.log(`Actual burns updated to: ${ethers.utils.formatEther(totalActualBurns)} TORUS`);
    console.log(`Difference (pending burns): ${(parseFloat(buyProcessData.totals.torusBurnt) - parseFloat(ethers.utils.formatEther(totalActualBurns))).toFixed(6)} TORUS`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateBurnsToActual().catch(console.error);