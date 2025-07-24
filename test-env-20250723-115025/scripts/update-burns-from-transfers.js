#!/usr/bin/env node

/**
 * Update burn tracking to use actual Transfer events to zero address
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function updateBurnsFromTransfers() {
  console.log('🔧 Updating burn tracking from Transfer events...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    const TORUS_CONTRACT = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
    
    // Load existing data
    const dataPath = path.join(__dirname, '../public/data/buy-process-data.json');
    const existingData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // TORUS token ABI
    const torusABI = [
      'event Transfer(address indexed from, address indexed to, uint256 value)'
    ];
    
    const torusContract = new ethers.Contract(TORUS_CONTRACT, torusABI, provider);
    
    // Fetch all burn transfers (to zero address) from Buy & Process
    const deployBlock = 22890272;
    const currentBlock = await provider.getBlockNumber();
    
    console.log('Fetching all TORUS burn transfers from Buy & Process...');
    
    const burnTransfers = [];
    const chunkSize = 5000;
    
    for (let start = deployBlock; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      console.log(`Scanning blocks ${start}-${end}...`);
      
      try {
        // Get all Transfer events from Buy & Process to zero address
        const filter = torusContract.filters.Transfer(
          BUY_PROCESS_CONTRACT, 
          '0x0000000000000000000000000000000000000000'
        );
        const events = await torusContract.queryFilter(filter, start, end);
        burnTransfers.push(...events);
      } catch (e) {
        console.log(`Error fetching blocks ${start}-${end}, skipping...`);
      }
    }
    
    console.log(`\nFound ${burnTransfers.length} burn transfers\n`);
    
    // Get timestamps for all burn events
    const blockTimestamps = new Map();
    const uniqueBlocks = [...new Set(burnTransfers.map(e => e.blockNumber))];
    
    for (let i = 0; i < uniqueBlocks.length; i += 10) {
      const batch = uniqueBlocks.slice(i, i + 10);
      const promises = batch.map(async (blockNumber) => {
        const block = await provider.getBlock(blockNumber);
        return { blockNumber, timestamp: block.timestamp };
      });
      
      const results = await Promise.all(promises);
      results.forEach(({ blockNumber, timestamp }) => {
        blockTimestamps.set(blockNumber, timestamp);
      });
    }
    
    // Process burns by date
    const actualBurnsByDate = {};
    let totalBurned = ethers.BigNumber.from(0);
    
    burnTransfers.forEach(event => {
      const timestamp = blockTimestamps.get(event.blockNumber);
      const date = new Date(timestamp * 1000).toISOString().split('T')[0];
      const amount = parseFloat(ethers.utils.formatEther(event.args.value));
      
      if (!actualBurnsByDate[date]) {
        actualBurnsByDate[date] = 0;
      }
      
      actualBurnsByDate[date] += amount;
      totalBurned = totalBurned.add(event.args.value);
    });
    
    console.log('Actual burns by date:');
    Object.entries(actualBurnsByDate).sort().forEach(([date, amount]) => {
      console.log(`${date}: ${amount.toFixed(6)} TORUS`);
    });
    
    console.log(`\nTotal burned: ${ethers.utils.formatEther(totalBurned)} TORUS`);
    
    // Update the daily data with actual burn amounts
    existingData.dailyData.forEach(day => {
      const actualBurn = actualBurnsByDate[day.date] || 0;
      if (actualBurn > 0) {
        console.log(`Updating ${day.date}: ${day.torusBurned} -> ${actualBurn}`);
        day.torusBurned = actualBurn;
      }
    });
    
    // Update the total
    existingData.totals.torusBurnt = ethers.utils.formatEther(totalBurned);
    
    // Save updated data
    fs.writeFileSync(dataPath, JSON.stringify(existingData, null, 2));
    
    console.log('\n✅ Updated burn tracking with actual Transfer events');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateBurnsFromTransfers().catch(console.error);