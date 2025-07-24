#!/usr/bin/env node

/**
 * Enhanced Buy & Process update that accurately tracks ETH
 * This replaces the simple tx.value check with proper ETH tracking
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function updateBuyProcessWithAccurateETH() {
  console.log('💰 Updating Buy & Process data with accurate ETH tracking...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    
    // Contract ABI
    const contractABI = [
      'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
      'event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)',
      'function ethUsedForBurns() view returns (uint256)',
      'function ethUsedForBuilds() view returns (uint256)',
      'function titanXUsedForBurns() view returns (uint256)',
      'function titanXUsedForBuilds() view returns (uint256)'
    ];
    
    const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, contractABI, provider);
    
    // Load existing data
    const dataPath = path.join(__dirname, '../public/data/buy-process-data.json');
    let existingData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Get last processed state
    const lastETHForBurns = parseFloat(existingData.totals.ethUsedForBurns || 0);
    const lastETHForBuilds = parseFloat(existingData.totals.ethUsedForBuilds || 0);
    
    // Get current contract state
    const [currentETHForBurns, currentETHForBuilds] = await Promise.all([
      contract.ethUsedForBurns(),
      contract.ethUsedForBuilds()
    ]);
    
    const currentETHBurns = parseFloat(ethers.utils.formatEther(currentETHForBurns));
    const currentETHBuilds = parseFloat(ethers.utils.formatEther(currentETHForBuilds));
    
    console.log('ETH State Changes:');
    console.log(`  Burns: ${lastETHForBurns.toFixed(6)} → ${currentETHBurns.toFixed(6)} ETH`);
    console.log(`  Builds: ${lastETHForBuilds.toFixed(6)} → ${currentETHBuilds.toFixed(6)} ETH`);
    
    const ethBurnsDiff = currentETHBurns - lastETHForBurns;
    const ethBuildsDiff = currentETHBuilds - lastETHForBuilds;
    
    if (ethBurnsDiff > 0 || ethBuildsDiff > 0) {
      console.log(`\n✅ New ETH usage detected!`);
      console.log(`  Burns: +${ethBurnsDiff.toFixed(6)} ETH`);
      console.log(`  Builds: +${ethBuildsDiff.toFixed(6)} ETH`);
      
      // Now we need to distribute this new ETH to the appropriate days
      // Get recent burn/build events to allocate the ETH
      
      const currentBlock = await provider.getBlockNumber();
      const lastBlock = existingData.metadata?.lastBlock || currentBlock - 7200; // ~1 day
      
      console.log(`\nFetching events from block ${lastBlock} to ${currentBlock}...`);
      
      // Get new events
      const [burnEvents, buildEvents] = await Promise.all([
        contract.queryFilter(contract.filters.BuyAndBurn(), lastBlock, currentBlock),
        contract.queryFilter(contract.filters.BuyAndBuild(), lastBlock, currentBlock)
      ]);
      
      console.log(`Found ${burnEvents.length} new burns, ${buildEvents.length} new builds`);
      
      // Process burns with proportional ETH allocation
      if (ethBurnsDiff > 0 && burnEvents.length > 0) {
        // Calculate total TORUS from new burns
        let totalNewTorusBurned = ethers.BigNumber.from(0);
        for (const event of burnEvents) {
          totalNewTorusBurned = totalNewTorusBurned.add(event.args.torusBurnt);
        }
        
        const totalTorusFloat = parseFloat(ethers.utils.formatEther(totalNewTorusBurned));
        
        // Allocate ETH proportionally to each burn
        for (const event of burnEvents) {
          const block = await provider.getBlock(event.blockNumber);
          const date = new Date(block.timestamp * 1000).toISOString().split('T')[0];
          
          const torusBurned = parseFloat(ethers.utils.formatEther(event.args.torusBurnt));
          const ethShare = (torusBurned / totalTorusFloat) * ethBurnsDiff;
          
          // Find or create daily data
          let dayData = existingData.dailyData.find(d => d.date === date);
          if (!dayData) {
            dayData = {
              date: date,
              buyAndBurnCount: 0,
              buyAndBuildCount: 0,
              fractalCount: 0,
              torusBurned: 0,
              titanXUsed: 0,
              ethUsed: 0,
              titanXUsedForBurns: 0,
              ethUsedForBurns: 0,
              titanXUsedForBuilds: 0,
              ethUsedForBuilds: 0,
              torusPurchased: 0,
              fractalTitanX: 0,
              fractalETH: 0
            };
            existingData.dailyData.push(dayData);
          }
          
          // Update with accurate ETH
          dayData.ethUsedForBurns = (parseFloat(dayData.ethUsedForBurns || 0) + ethShare);
          dayData.ethUsed = (parseFloat(dayData.ethUsed || 0) + ethShare);
          
          console.log(`  Allocated ${ethShare.toFixed(6)} ETH to ${date}`);
        }
      }
      
      // Process builds (these have tokenAllocated that tells us ETH amount)
      for (const event of buildEvents) {
        const tx = await provider.getTransaction(event.transactionHash);
        const functionSelector = tx.data.slice(0, 10);
        
        // Check if it's ETH build
        if (functionSelector === '0x53ad9b96') { // swapETHForTorusAndBuild
          const block = await provider.getBlock(event.blockNumber);
          const date = new Date(block.timestamp * 1000).toISOString().split('T')[0];
          const ethAmount = parseFloat(ethers.utils.formatEther(event.args.tokenAllocated));
          
          let dayData = existingData.dailyData.find(d => d.date === date);
          if (!dayData) {
            dayData = {
              date: date,
              buyAndBurnCount: 0,
              buyAndBuildCount: 0,
              fractalCount: 0,
              torusBurned: 0,
              titanXUsed: 0,
              ethUsed: 0,
              titanXUsedForBurns: 0,
              ethUsedForBurns: 0,
              titanXUsedForBuilds: 0,
              ethUsedForBuilds: 0,
              torusPurchased: 0,
              fractalTitanX: 0,
              fractalETH: 0
            };
            existingData.dailyData.push(dayData);
          }
          
          dayData.ethUsedForBuilds = (parseFloat(dayData.ethUsedForBuilds || 0) + ethAmount);
          dayData.ethUsed = (parseFloat(dayData.ethUsed || 0) + ethAmount);
        }
      }
      
      // Update totals with exact contract values
      existingData.totals.ethUsedForBurns = currentETHBurns.toString();
      existingData.totals.ethUsedForBuilds = currentETHBuilds.toString();
      
      // Update metadata
      existingData.metadata = existingData.metadata || {};
      existingData.metadata.lastBlock = currentBlock;
      existingData.metadata.lastETHUpdate = new Date().toISOString();
      
      // Save updated data
      fs.writeFileSync(dataPath, JSON.stringify(existingData, null, 2));
      console.log('\n✅ Data updated with accurate ETH tracking!');
      
    } else {
      console.log('\nNo new ETH usage detected.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Export for use in other scripts
module.exports = { updateBuyProcessWithAccurateETH };

// Run if called directly
if (require.main === module) {
  updateBuyProcessWithAccurateETH().catch(console.error);
}