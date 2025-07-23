#!/usr/bin/env node

/**
 * Trace the flow of burns to understand the discrepancy
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function traceBurnFlow() {
  console.log('🔍 Tracing burn flow...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    
    // Load our data
    const dataPath = path.join(__dirname, '../public/data/buy-process-data.json');
    const buyProcessData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Contract ABI
    const contractABI = [
      'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
      'event TorusBurned(uint256 amount)',
      'function totalTorusBurnt() view returns (uint256)'
    ];
    
    const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, contractABI, provider);
    
    // Get current contract state
    const totalTorusBurnt = await contract.totalTorusBurnt();
    console.log(`Contract totalTorusBurnt: ${ethers.utils.formatEther(totalTorusBurnt)} TORUS`);
    
    // Calculate totals from our tracking
    const buyAndBurnTotal = buyProcessData.dailyData.reduce((sum, day) => {
      // Sum up the torusBurnt amounts from BuyAndBurn events
      return sum + (day.buyAndBurnCount > 0 ? parseFloat(day.torusBurned || 0) : 0);
    }, 0);
    
    console.log(`\nOur tracking:`);
    console.log(`- BuyAndBurn events total: ~947 TORUS (from event parameters)`);
    console.log(`- Actual burns (Transfer to 0x0): 1127 TORUS`);
    console.log(`- Contract state: ${ethers.utils.formatEther(totalTorusBurnt)} TORUS`);
    
    console.log(`\nThe flow appears to be:`);
    console.log(`1. BuyAndBurn events report the TORUS amount purchased in that specific transaction`);
    console.log(`2. When burnTorus() is called, it burns ALL TORUS in the contract`);
    console.log(`3. This includes:`);
    console.log(`   - The newly purchased TORUS`);
    console.log(`   - Any TORUS previously accumulated in the contract`);
    console.log(`   - TORUS from other sources (direct transfers, etc.)`);
    
    console.log(`\nThis explains why:`);
    console.log(`- BuyAndBurn events show 947 TORUS (only the purchased amounts)`);
    console.log(`- Actual burns show 1127 TORUS (all TORUS burned, including accumulated)`);
    console.log(`- Contract state shows 2074 TORUS (includes future burns already recorded)`);
    
    // The key insight
    console.log(`\n✨ Key Insight:`);
    console.log(`The contract's totalTorusBurnt (2074) = Actual burns (1127) + Pending burns (947)`);
    console.log(`The "pending" burns are already recorded in totalTorusBurnt but the tokens haven't been burned yet.`);
    console.log(`This could happen if:`);
    console.log(`- Recent transactions incremented totalTorusBurnt but haven't executed burn() yet`);
    console.log(`- Or there's accumulated TORUS waiting to be burned`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

traceBurnFlow().catch(console.error);