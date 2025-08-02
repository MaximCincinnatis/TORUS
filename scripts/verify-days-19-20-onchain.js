#!/usr/bin/env node

/**
 * Verifies Days 19 & 20 data against blockchain
 * Checks all Buy & Burn and Buy & Build events
 */

const { ethers } = require('ethers');

async function verifyOnchain() {
  console.log('🔍 Verifying Days 19 & 20 against blockchain...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  
  // Contract ABI
  const abi = [
    'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
    'event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)'
  ];
  
  const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, abi, provider);
  
  // Protocol Day 19: July 28, 2025 (starts at 18:00 UTC on July 27)
  // Protocol Day 20: July 29, 2025 (starts at 18:00 UTC on July 28)
  
  const day19Start = Math.floor(new Date('2025-07-27T18:00:00Z').getTime() / 1000);
  const day19End = Math.floor(new Date('2025-07-28T18:00:00Z').getTime() / 1000);
  const day20Start = day19End;
  const day20End = Math.floor(new Date('2025-07-29T18:00:00Z').getTime() / 1000);
  
  console.log('📅 Day 19: July 27 18:00 UTC - July 28 18:00 UTC');
  console.log('📅 Day 20: July 28 18:00 UTC - July 29 18:00 UTC\n');
  
  // Get block numbers for time ranges
  async function getBlockForTimestamp(timestamp) {
    let low = 22890272; // Contract deployment
    let high = await provider.getBlockNumber();
    
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const block = await provider.getBlock(mid);
      
      if (block.timestamp < timestamp) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    
    return low;
  }
  
  console.log('Finding block ranges...');
  const day19StartBlock = await getBlockForTimestamp(day19Start);
  const day19EndBlock = await getBlockForTimestamp(day19End);
  const day20EndBlock = await getBlockForTimestamp(day20End);
  
  console.log(`Day 19 blocks: ${day19StartBlock} - ${day19EndBlock}`);
  console.log(`Day 20 blocks: ${day19EndBlock} - ${day20EndBlock}\n`);
  
  // Fetch events for Day 19
  console.log('📊 Fetching Day 19 events...');
  const [day19Burns, day19Builds] = await Promise.all([
    contract.queryFilter(contract.filters.BuyAndBurn(), day19StartBlock, day19EndBlock),
    contract.queryFilter(contract.filters.BuyAndBuild(), day19StartBlock, day19EndBlock)
  ]);
  
  // Fetch events for Day 20
  console.log('📊 Fetching Day 20 events...\n');
  const [day20Burns, day20Builds] = await Promise.all([
    contract.queryFilter(contract.filters.BuyAndBurn(), day19EndBlock, day20EndBlock),
    contract.queryFilter(contract.filters.BuyAndBuild(), day19EndBlock, day20EndBlock)
  ]);
  
  // Process Day 19
  let day19Stats = {
    burnCount: day19Burns.length,
    buildCount: day19Builds.length,
    torusBurned: 0,
    titanXUsedForBurns: 0,
    titanXUsedForBuilds: 0,
    torusPurchased: 0,
    ethBurns: [],
    ethBuilds: []
  };
  
  // Check each burn for ETH vs TitanX
  for (const burn of day19Burns) {
    day19Stats.torusBurned += parseFloat(ethers.utils.formatEther(burn.args.torusBurnt));
    day19Stats.titanXUsedForBurns += parseFloat(ethers.utils.formatEther(burn.args.titanXAmount));
    
    // Check if this was an ETH burn
    const tx = await provider.getTransaction(burn.transactionHash);
    if (tx.data.startsWith('0x39b6ce64')) { // buyAndBurnWithETH
      day19Stats.ethBurns.push({
        tx: burn.transactionHash,
        value: ethers.utils.formatEther(tx.value)
      });
    }
  }
  
  // Check each build
  for (const build of day19Builds) {
    day19Stats.torusPurchased += parseFloat(ethers.utils.formatEther(build.args.torusPurchased));
    day19Stats.titanXUsedForBuilds += parseFloat(ethers.utils.formatEther(build.args.tokenAllocated));
    
    // Check if this was an ETH build
    const tx = await provider.getTransaction(build.transactionHash);
    if (tx.data.startsWith('0x53ad9b96')) { // buyAndBuildWithETH
      day19Stats.ethBuilds.push({
        tx: build.transactionHash,
        value: ethers.utils.formatEther(tx.value)
      });
    }
  }
  
  // Process Day 20 similarly
  let day20Stats = {
    burnCount: day20Burns.length,
    buildCount: day20Builds.length,
    torusBurned: 0,
    titanXUsedForBurns: 0,
    titanXUsedForBuilds: 0,
    torusPurchased: 0,
    ethBurns: [],
    ethBuilds: []
  };
  
  for (const burn of day20Burns) {
    day20Stats.torusBurned += parseFloat(ethers.utils.formatEther(burn.args.torusBurnt));
    day20Stats.titanXUsedForBurns += parseFloat(ethers.utils.formatEther(burn.args.titanXAmount));
    
    const tx = await provider.getTransaction(burn.transactionHash);
    if (tx.data.startsWith('0x39b6ce64')) {
      day20Stats.ethBurns.push({
        tx: burn.transactionHash,
        value: ethers.utils.formatEther(tx.value)
      });
    }
  }
  
  for (const build of day20Builds) {
    day20Stats.torusPurchased += parseFloat(ethers.utils.formatEther(build.args.torusPurchased));
    day20Stats.titanXUsedForBuilds += parseFloat(ethers.utils.formatEther(build.args.tokenAllocated));
    
    const tx = await provider.getTransaction(build.transactionHash);
    if (tx.data.startsWith('0x53ad9b96')) {
      day20Stats.ethBuilds.push({
        tx: build.transactionHash,
        value: ethers.utils.formatEther(tx.value)
      });
    }
  }
  
  // Display results
  console.log('🔍 DAY 19 BLOCKCHAIN RESULTS:');
  console.log(`Buy & Burns: ${day19Stats.burnCount}`);
  console.log(`Buy & Builds: ${day19Stats.buildCount}`);
  console.log(`TORUS Burned: ${day19Stats.torusBurned.toFixed(2)}`);
  console.log(`TitanX Used for Burns: ${day19Stats.titanXUsedForBurns.toLocaleString()}`);
  console.log(`TitanX Used for Builds: ${day19Stats.titanXUsedForBuilds.toLocaleString()}`);
  console.log(`ETH Burns: ${day19Stats.ethBurns.length} (${day19Stats.ethBurns.reduce((sum, b) => sum + parseFloat(b.value), 0).toFixed(6)} ETH)`);
  console.log(`ETH Builds: ${day19Stats.ethBuilds.length} (${day19Stats.ethBuilds.reduce((sum, b) => sum + parseFloat(b.value), 0).toFixed(6)} ETH)`);
  console.log(`TORUS Purchased: ${day19Stats.torusPurchased.toFixed(2)}`);
  
  console.log('\n🔍 DAY 20 BLOCKCHAIN RESULTS:');
  console.log(`Buy & Burns: ${day20Stats.burnCount}`);
  console.log(`Buy & Builds: ${day20Stats.buildCount}`);
  console.log(`TORUS Burned: ${day20Stats.torusBurned.toFixed(2)}`);
  console.log(`TitanX Used for Burns: ${day20Stats.titanXUsedForBurns.toLocaleString()}`);
  console.log(`TitanX Used for Builds: ${day20Stats.titanXUsedForBuilds.toLocaleString()}`);
  console.log(`ETH Burns: ${day20Stats.ethBurns.length} (${day20Stats.ethBurns.reduce((sum, b) => sum + parseFloat(b.value), 0).toFixed(6)} ETH)`);
  console.log(`ETH Builds: ${day20Stats.ethBuilds.length} (${day20Stats.ethBuilds.reduce((sum, b) => sum + parseFloat(b.value), 0).toFixed(6)} ETH)`);
  console.log(`TORUS Purchased: ${day20Stats.torusPurchased.toFixed(2)}`);
  
  // Compare with JSON data
  const fs = require('fs');
  const jsonData = JSON.parse(fs.readFileSync('./public/data/buy-process-data.json', 'utf8'));
  
  const jsonDay19 = jsonData.dailyData.find(d => d.protocolDay === 19);
  const jsonDay20 = jsonData.dailyData.find(d => d.protocolDay === 20);
  
  console.log('\n📋 COMPARISON WITH JSON DATA:');
  console.log('\nDay 19:');
  console.log(`Burn Count - JSON: ${jsonDay19.buyAndBurnCount}, Blockchain: ${day19Stats.burnCount} ${jsonDay19.buyAndBurnCount === day19Stats.burnCount ? '✅' : '❌'}`);
  console.log(`Build Count - JSON: ${jsonDay19.buyAndBuildCount}, Blockchain: ${day19Stats.buildCount} ${jsonDay19.buyAndBuildCount === day19Stats.buildCount ? '✅' : '❌'}`);
  console.log(`TORUS Burned - JSON: ${jsonDay19.torusBurned}, Blockchain: ${day19Stats.torusBurned.toFixed(2)} ${Math.abs(jsonDay19.torusBurned - day19Stats.torusBurned) < 0.01 ? '✅' : '❌'}`);
  
  console.log('\nDay 20:');
  console.log(`Burn Count - JSON: ${jsonDay20.buyAndBurnCount}, Blockchain: ${day20Stats.burnCount} ${jsonDay20.buyAndBurnCount === day20Stats.burnCount ? '✅' : '❌'}`);
  console.log(`Build Count - JSON: ${jsonDay20.buyAndBuildCount}, Blockchain: ${day20Stats.buildCount} ${jsonDay20.buyAndBuildCount === day20Stats.buildCount ? '✅' : '❌'}`);
  console.log(`TORUS Burned - JSON: ${jsonDay20.torusBurned}, Blockchain: ${day20Stats.torusBurned.toFixed(2)} ${Math.abs(jsonDay20.torusBurned - day20Stats.torusBurned) < 0.01 ? '✅' : '❌'}`);
}

verifyOnchain().catch(console.error);