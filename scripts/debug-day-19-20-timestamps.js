#!/usr/bin/env node

/**
 * Debug timestamp issues for Days 19 & 20
 * Protocol days change at 18:00 UTC
 */

const { ethers } = require('ethers');

async function debugTimestamps() {
  console.log('🔍 Debugging Day 19 & 20 timestamp issues...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  
  const abi = [
    'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
    'event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)'
  ];
  
  const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, abi, provider);
  
  // Contract start: July 10, 2025 at 18:00 UTC
  const CONTRACT_START = new Date('2025-07-10T18:00:00Z').getTime() / 1000;
  
  // Get all events from Days 17-20 range
  const startBlock = 23004800; // Approximate Day 17 start
  const endBlock = 23026438;   // Day 20 end
  
  console.log('Fetching all events from Days 17-20...');
  
  // Fetch in chunks to avoid RPC limits
  const burns = [];
  const builds = [];
  const chunkSize = 5000;
  
  for (let start = startBlock; start <= endBlock; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, endBlock);
    console.log(`Fetching blocks ${start}-${end}...`);
    
    const [chunkBurns, chunkBuilds] = await Promise.all([
      contract.queryFilter(contract.filters.BuyAndBurn(), start, end),
      contract.queryFilter(contract.filters.BuyAndBuild(), start, end)
    ]);
    
    burns.push(...chunkBurns);
    builds.push(...chunkBuilds);
  }
  
  console.log(`Found ${burns.length} burns and ${builds.length} builds\n`);
  
  // Group by protocol day
  const dayData = {};
  
  async function processEvent(event, type) {
    const block = await provider.getBlock(event.blockNumber);
    const timestamp = block.timestamp;
    
    // Calculate protocol day
    const secondsSinceStart = timestamp - CONTRACT_START;
    const protocolDay = Math.floor(secondsSinceStart / (24 * 60 * 60)) + 1;
    
    const date = new Date(timestamp * 1000);
    const dateStr = date.toISOString();
    
    if (!dayData[protocolDay]) {
      dayData[protocolDay] = {
        burns: 0,
        builds: 0,
        torusBurned: 0,
        titanXUsed: 0,
        firstEvent: dateStr,
        lastEvent: dateStr,
        events: []
      };
    }
    
    dayData[protocolDay][type === 'burn' ? 'burns' : 'builds']++;
    dayData[protocolDay].lastEvent = dateStr;
    
    if (type === 'burn') {
      dayData[protocolDay].torusBurned += parseFloat(ethers.utils.formatEther(event.args.torusBurnt));
      dayData[protocolDay].titanXUsed += parseFloat(ethers.utils.formatEther(event.args.titanXAmount));
    } else {
      dayData[protocolDay].titanXUsed += parseFloat(ethers.utils.formatEther(event.args.tokenAllocated));
    }
    
    dayData[protocolDay].events.push({
      type,
      tx: event.transactionHash,
      time: dateStr,
      block: event.blockNumber
    });
  }
  
  // Process all events
  console.log('Processing events...');
  for (const burn of burns) {
    await processEvent(burn, 'burn');
  }
  for (const build of builds) {
    await processEvent(build, 'build');
  }
  
  // Display results
  console.log('\n📊 PROTOCOL DAY BREAKDOWN:');
  for (let day = 17; day <= 20; day++) {
    if (dayData[day]) {
      const data = dayData[day];
      console.log(`\nDay ${day}:`);
      console.log(`  Burns: ${data.burns}, Builds: ${data.builds}`);
      console.log(`  TORUS Burned: ${data.torusBurned.toFixed(2)}`);
      console.log(`  TitanX Used: ${data.titanXUsed.toLocaleString()}`);
      console.log(`  First Event: ${data.firstEvent}`);
      console.log(`  Last Event: ${data.lastEvent}`);
      
      // Show first few events
      console.log(`  Sample events:`);
      data.events.slice(0, 3).forEach(e => {
        console.log(`    - ${e.type} at ${e.time} (block ${e.block})`);
      });
    }
  }
  
  // Compare with JSON
  const fs = require('fs');
  const jsonData = JSON.parse(fs.readFileSync('./public/data/buy-process-data.json', 'utf8'));
  
  console.log('\n📋 JSON vs BLOCKCHAIN COMPARISON:');
  for (let day = 17; day <= 20; day++) {
    const jsonDay = jsonData.dailyData.find(d => d.protocolDay === day);
    const blockchainDay = dayData[day] || { burns: 0, builds: 0, torusBurned: 0 };
    
    console.log(`\nDay ${day}:`);
    console.log(`  JSON: ${jsonDay.buyAndBurnCount} burns, ${jsonDay.buyAndBuildCount} builds, ${jsonDay.torusBurned} TORUS`);
    console.log(`  Blockchain: ${blockchainDay.burns} burns, ${blockchainDay.builds} builds, ${blockchainDay.torusBurned.toFixed(2)} TORUS`);
    
    if (jsonDay.buyAndBurnCount !== blockchainDay.burns || 
        jsonDay.buyAndBuildCount !== blockchainDay.builds ||
        Math.abs(jsonDay.torusBurned - blockchainDay.torusBurned) > 0.01) {
      console.log(`  ❌ MISMATCH!`);
    } else {
      console.log(`  ✅ Match`);
    }
  }
}

debugTimestamps().catch(console.error);