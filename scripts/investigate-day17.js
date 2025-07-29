#!/usr/bin/env node

/**
 * Investigates missing Day 17 data
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// RPC endpoints
const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function investigateDay17() {
  console.log('🔍 Investigating Day 17 (2025-07-27)...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    
    // Contract ABI
    const contractABI = [
      'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
      'event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)',
      'function currentProtocolDay() view returns (uint256)'
    ];
    
    const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, contractABI, provider);
    
    // Calculate block range for Day 17
    // Day 17 starts at 2025-07-27 18:00:00 UTC
    const day17Start = new Date('2025-07-27T18:00:00.000Z');
    const day18Start = new Date('2025-07-28T18:00:00.000Z');
    
    console.log(`Day 17 period: ${day17Start.toISOString()} to ${day18Start.toISOString()}`);
    
    // Estimate blocks (roughly 12 seconds per block)
    const currentBlock = await provider.getBlockNumber();
    const currentTime = Date.now();
    const blocksPerSecond = 1 / 12;
    
    const secondsSinceDay17Start = (currentTime - day17Start.getTime()) / 1000;
    const secondsSinceDay18Start = (currentTime - day18Start.getTime()) / 1000;
    
    const day17StartBlock = Math.floor(currentBlock - (secondsSinceDay17Start * blocksPerSecond));
    const day18StartBlock = Math.floor(currentBlock - (secondsSinceDay18Start * blocksPerSecond));
    
    console.log(`Estimated block range: ${day17StartBlock} to ${day18StartBlock}`);
    console.log(`Fetching events in this range...\n`);
    
    // Fetch events for Day 17
    const buyAndBurnFilter = contract.filters.BuyAndBurn();
    const buyAndBuildFilter = contract.filters.BuyAndBuild();
    
    const [buyAndBurnEvents, buyAndBuildEvents] = await Promise.all([
      contract.queryFilter(buyAndBurnFilter, day17StartBlock, day18StartBlock),
      contract.queryFilter(buyAndBuildFilter, day17StartBlock, day18StartBlock)
    ]);
    
    console.log(`Found ${buyAndBurnEvents.length} BuyAndBurn events`);
    console.log(`Found ${buyAndBuildEvents.length} BuyAndBuild events`);
    
    // Process events
    let totalTorusBurned = ethers.BigNumber.from(0);
    let totalTitanXUsed = ethers.BigNumber.from(0);
    
    for (const event of buyAndBurnEvents) {
      const block = await event.getBlock();
      const timestamp = new Date(block.timestamp * 1000);
      console.log(`  BuyAndBurn at ${timestamp.toISOString()}: ${ethers.utils.formatEther(event.args.torusBurnt)} TORUS`);
      totalTorusBurned = totalTorusBurned.add(event.args.torusBurnt);
      totalTitanXUsed = totalTitanXUsed.add(event.args.titanXAmount);
    }
    
    for (const event of buyAndBuildEvents) {
      const block = await event.getBlock();
      const timestamp = new Date(block.timestamp * 1000);
      console.log(`  BuyAndBuild at ${timestamp.toISOString()}: ${ethers.utils.formatEther(event.args.torusPurchased)} TORUS purchased`);
    }
    
    console.log(`\nDay 17 Summary:`);
    console.log(`  Total TORUS burned: ${ethers.utils.formatEther(totalTorusBurned)}`);
    console.log(`  Total TitanX used: ${ethers.utils.formatUnits(totalTitanXUsed, 9)} (billions)`);
    console.log(`  Total operations: ${buyAndBurnEvents.length + buyAndBuildEvents.length}`);
    
    // Check current data file
    const dataPath = path.join(__dirname, '../public/data/buy-process-data.json');
    const currentData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    console.log(`\nCurrent data file status:`);
    const day17InFile = currentData.dailyData.find(d => d.protocolDay === 17);
    const day18InFile = currentData.dailyData.find(d => d.protocolDay === 18);
    
    if (day17InFile) {
      console.log(`  Day 17 exists with ${day17InFile.buyAndBurnCount} burns, ${day17InFile.buyAndBuildCount} builds`);
    } else {
      console.log(`  Day 17 is MISSING from the data file`);
    }
    
    if (day18InFile) {
      console.log(`  Day 18 shows: ${day18InFile.buyAndBurnCount} burns, ${day18InFile.buyAndBuildCount} builds`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

investigateDay17();