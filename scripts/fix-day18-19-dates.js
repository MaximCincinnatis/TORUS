#!/usr/bin/env node

/**
 * Fixes Day 18 and 19 dates and investigates missing data
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

async function fixDay18and19() {
  console.log('🔧 Fixing Day 18 and 19 dates and data...\n');
  
  const dataPath = path.join(__dirname, '../public/data/buy-process-data.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  
  // Protocol day calculation
  const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
  
  // Find Day 18 and 19
  const day18Index = data.dailyData.findIndex(d => d.protocolDay === 18);
  const day19Index = data.dailyData.findIndex(d => d.protocolDay === 19);
  
  if (day18Index !== -1) {
    // Day 18 is actually 2025-07-28 (today)
    data.dailyData[day18Index].date = "2025-07-28";
    
    // Check if we need to fetch today's data
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    
    // Contract ABI
    const contractABI = [
      'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
      'event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)'
    ];
    
    const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, contractABI, provider);
    
    // Calculate block range for Day 18 (today until 6 PM UTC)
    const day18Start = new Date('2025-07-28T18:00:00.000Z');
    const now = new Date();
    
    console.log(`Checking for Day 18 events (${day18Start.toISOString()} to now)...`);
    
    // Estimate blocks
    const currentBlock = await provider.getBlockNumber();
    const currentTime = Date.now();
    const blocksPerSecond = 1 / 12;
    
    const secondsSinceDay18Start = (currentTime - day18Start.getTime()) / 1000;
    const day18StartBlock = Math.floor(currentBlock - (secondsSinceDay18Start * blocksPerSecond));
    
    // Fetch events for Day 18
    const [buyAndBurnEvents, buyAndBuildEvents] = await Promise.all([
      contract.queryFilter(contract.filters.BuyAndBurn(), day18StartBlock, currentBlock),
      contract.queryFilter(contract.filters.BuyAndBuild(), day18StartBlock, currentBlock)
    ]);
    
    console.log(`Found ${buyAndBurnEvents.length} BuyAndBurn events for Day 18`);
    console.log(`Found ${buyAndBuildEvents.length} BuyAndBuild events for Day 18`);
    
    if (buyAndBurnEvents.length > 0 || buyAndBuildEvents.length > 0) {
      // Calculate totals
      let totalTorusBurned = ethers.BigNumber.from(0);
      let totalTitanXUsed = ethers.BigNumber.from(0);
      let totalTorusPurchased = ethers.BigNumber.from(0);
      
      for (const event of buyAndBurnEvents) {
        totalTorusBurned = totalTorusBurned.add(event.args.torusBurnt);
        totalTitanXUsed = totalTitanXUsed.add(event.args.titanXAmount);
      }
      
      for (const event of buyAndBuildEvents) {
        totalTorusPurchased = totalTorusPurchased.add(event.args.torusPurchased);
        // Assuming TitanX is used for builds too
        totalTitanXUsed = totalTitanXUsed.add(event.args.tokenAllocated);
      }
      
      // Update Day 18 data
      data.dailyData[day18Index].buyAndBurnCount = buyAndBurnEvents.length;
      data.dailyData[day18Index].buyAndBuildCount = buyAndBuildEvents.length;
      data.dailyData[day18Index].torusBurned = parseFloat(ethers.utils.formatEther(totalTorusBurned));
      data.dailyData[day18Index].titanXUsed = parseFloat(ethers.utils.formatUnits(totalTitanXUsed, 9));
      data.dailyData[day18Index].titanXUsedForBurns = parseFloat(ethers.utils.formatUnits(totalTitanXUsed, 9));
      data.dailyData[day18Index].torusPurchased = parseFloat(ethers.utils.formatEther(totalTorusPurchased));
      
      console.log(`✅ Updated Day 18 with actual data`);
    }
  }
  
  if (day19Index !== -1) {
    // Remove Day 19 as it hasn't happened yet
    data.dailyData.splice(day19Index, 1);
    console.log('✅ Removed Day 19 (hasn\'t occurred yet)');
    
    // Update current day
    data.currentDay = 18;
  }
  
  // Update timestamp
  data.lastUpdated = new Date().toISOString();
  
  // Save the fixed data
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  
  console.log('\n✅ Day 18 and 19 fixed successfully');
  
  // Show summary
  console.log('\nProtocol days 15-18:');
  data.dailyData.filter(d => d.protocolDay >= 15 && d.protocolDay <= 18).forEach(d => {
    console.log(`  Day ${d.protocolDay} (${d.date}): ${d.torusBurned.toFixed(2)} TORUS burned (${d.buyAndBurnCount} burns, ${d.buyAndBuildCount} builds)`);
  });
}

// Run the fix
fixDay18and19().catch(console.error);