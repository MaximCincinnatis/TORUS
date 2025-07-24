#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Contract configuration
const STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
const CONTRACT_ABI = [
  'event Created(address indexed user, uint256 stakeIndex, uint256 torusAmount, uint256 endTime)',
  'function userCreates(address user, uint256 index) view returns (uint256 torusAmount, uint256 duration, uint256 timestamp, uint256 titanAmount, uint256 ethAmount, bool claimed)',
  'function protocolStart() view returns (uint256)',
  'function getCurrentDayIndex() view returns (uint24)'
];

// RPC endpoints
const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function verifyDay15TitanX() {
  console.log('🔍 Verifying Day 15 (July 24, 2025) TitanX Usage\n');
  
  try {
    // Connect to Ethereum
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const contract = new ethers.Contract(STAKE_CONTRACT, CONTRACT_ABI, provider);
    
    // Get protocol start time
    const protocolStart = await contract.protocolStart();
    console.log(`Protocol start: ${new Date(protocolStart.toNumber() * 1000).toISOString()}`);
    
    // Calculate Day 15 timestamp range
    const day15Start = protocolStart.toNumber() + (14 * 86400); // Day 15 is index 14
    const day15End = day15Start + 86400;
    
    console.log(`\nDay 15 (July 24, 2025):`);
    console.log(`Start: ${new Date(day15Start * 1000).toISOString()}`);
    console.log(`End: ${new Date(day15End * 1000).toISOString()}`);
    
    // Estimate block range for Day 15
    // Ethereum averages ~12 seconds per block
    const currentBlock = await provider.getBlockNumber();
    const currentTime = Math.floor(Date.now() / 1000);
    const blocksPerSecond = 1 / 12;
    
    const secondsFromDay15 = currentTime - day15Start;
    const estimatedBlocksFromDay15 = Math.floor(secondsFromDay15 * blocksPerSecond);
    const estimatedDay15StartBlock = currentBlock - estimatedBlocksFromDay15;
    const estimatedDay15EndBlock = estimatedDay15StartBlock + Math.floor(86400 * blocksPerSecond);
    
    console.log(`\nEstimated block range: ${estimatedDay15StartBlock} to ${estimatedDay15EndBlock}`);
    
    // Fetch Created events for Day 15
    console.log('\nFetching Created events...');
    const filter = contract.filters.Created();
    const events = await contract.queryFilter(filter, estimatedDay15StartBlock, estimatedDay15EndBlock);
    
    console.log(`Found ${events.length} Created events in block range`);
    
    // Get block timestamps to filter for Day 15
    const day15Events = [];
    const blockTimestamps = new Map();
    
    for (const event of events) {
      if (!blockTimestamps.has(event.blockNumber)) {
        const block = await provider.getBlock(event.blockNumber);
        blockTimestamps.set(event.blockNumber, block.timestamp);
      }
      
      const timestamp = blockTimestamps.get(event.blockNumber);
      if (timestamp >= day15Start && timestamp < day15End) {
        day15Events.push({ ...event, timestamp });
      }
    }
    
    console.log(`\n📊 Day 15 Creates: ${day15Events.length}`);
    
    // Process each create and get TitanX costs
    const createsWithCosts = [];
    let totalTitanX = ethers.BigNumber.from(0);
    let totalETH = ethers.BigNumber.from(0);
    
    // Specific users to check
    const specificUsers = [
      '0xd0979b1b',
      '0xe649bf6e',
      '0x8599a6ca'
    ];
    
    for (const event of day15Events) {
      const user = event.args.user.toLowerCase();
      const stakeIndex = event.args.stakeIndex.toString();
      const torusAmount = event.args.torusAmount;
      
      try {
        // Get the actual cost data from the contract
        const createData = await contract.userCreates(event.args.user, event.args.stakeIndex);
        
        const titanAmount = createData.titanAmount;
        const ethAmount = createData.ethAmount;
        
        totalTitanX = totalTitanX.add(titanAmount);
        totalETH = totalETH.add(ethAmount);
        
        const createInfo = {
          user,
          stakeIndex,
          torusAmount: ethers.utils.formatEther(torusAmount),
          titanXCost: ethers.utils.formatEther(titanAmount),
          ethCost: ethers.utils.formatEther(ethAmount),
          timestamp: event.timestamp,
          blockNumber: event.blockNumber,
          txHash: event.transactionHash
        };
        
        createsWithCosts.push(createInfo);
        
        // Check if this is one of the specific users
        if (specificUsers.some(u => user.startsWith(u))) {
          console.log(`\n⚠️  Found specific user create:`);
          console.log(`  User: ${user}`);
          console.log(`  TORUS: ${createInfo.torusAmount}`);
          console.log(`  TitanX Cost: ${createInfo.titanXCost}`);
          console.log(`  ETH Cost: ${createInfo.ethCost}`);
          console.log(`  Block: ${event.blockNumber}`);
          console.log(`  Tx: ${event.transactionHash}`);
        }
        
      } catch (error) {
        console.error(`Error fetching create data for ${user} index ${stakeIndex}:`, error.message);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Summary
    console.log('\n=== DAY 15 SUMMARY ===');
    console.log(`Total Creates: ${day15Events.length}`);
    console.log(`Total TitanX Used: ${ethers.utils.formatEther(totalTitanX)} TITANX`);
    console.log(`Total ETH Used: ${ethers.utils.formatEther(totalETH)} ETH`);
    
    // Show all creates with their costs
    console.log('\n=== ALL DAY 15 CREATES ===');
    createsWithCosts.forEach((create, index) => {
      console.log(`\n${index + 1}. ${new Date(create.timestamp * 1000).toISOString()}`);
      console.log(`   User: ${create.user}`);
      console.log(`   TORUS: ${parseFloat(create.torusAmount).toFixed(2)}`);
      console.log(`   TitanX: ${parseFloat(create.titanXCost).toFixed(2)}`);
      console.log(`   ETH: ${parseFloat(create.ethCost).toFixed(6)}`);
      console.log(`   Tx: ${create.txHash}`);
    });
    
    // Load and compare with cached data
    console.log('\n=== COMPARING WITH CACHED DATA ===');
    const dataPath = path.join(__dirname, 'public/data/cached-data.json');
    if (fs.existsSync(dataPath)) {
      const cachedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      
      // Find Day 15 creates in cached data
      const day15CachedCreates = cachedData.stakingData.createEvents.filter(c => {
        const timestamp = parseInt(c.timestamp);
        return timestamp >= day15Start && timestamp < day15End;
      });
      
      console.log(`Cached creates for Day 15: ${day15CachedCreates.length}`);
      
      // Check TitanX amounts in cached data
      let cachedTitanX = ethers.BigNumber.from(0);
      day15CachedCreates.forEach(c => {
        if (c.titanAmount && c.titanAmount !== '0') {
          cachedTitanX = cachedTitanX.add(c.titanAmount);
        } else if (c.titanXAmount && c.titanXAmount !== '0') {
          cachedTitanX = cachedTitanX.add(c.titanXAmount);
        }
      });
      
      console.log(`Cached TitanX total: ${ethers.utils.formatEther(cachedTitanX)}`);
      console.log(`Blockchain TitanX total: ${ethers.utils.formatEther(totalTitanX)}`);
      
      if (cachedTitanX.eq(0) && totalTitanX.gt(0)) {
        console.log('\n❌ ISSUE FOUND: Cached data shows 0 TitanX but blockchain shows actual TitanX usage!');
        console.log('The create events in cached data need their TitanX costs updated.');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
verifyDay15TitanX().catch(console.error);