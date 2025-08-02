#!/usr/bin/env node

/**
 * Updates Buy & Process data incrementally
 * FIXED VERSION: Tracks actual TORUS burns from Transfer events to 0x0
 * This avoids the double-counting issue in the contract's totalTorusBurnt
 * 
 * ENHANCED: Added data validation, alerts, and recovery mechanisms
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Import validation and recovery utilities
const { DataValidator, AlertSystem, DataRecovery } = require('./data-validator');

// RPC endpoints with fallbacks
const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.payload.de'
];

// Get working provider with fallback
async function getProvider() {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(endpoint);
      await provider.getBlockNumber();
      return provider;
    } catch (e) {
      continue;
    }
  }
  throw new Error('No working RPC providers available');
}

// Retry wrapper for RPC calls
async function retryRPC(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries - 1) throw e;
      AlertSystem.logAlert(`RPC call failed, retry ${i + 1}/${retries}: ${e.message}`, 'WARNING');
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function updateBuyProcessData() {
  console.log('💰 Updating Buy & Process data (with accurate burn tracking)...\n');
  
  try {
    const provider = await getProvider();
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    const TORUS_CONTRACT = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
    
    // Contract start date (6 PM UTC - actual protocol start time)
    
// Validation function to prevent overwriting non-zero data with zeros
function validateDataUpdate(oldData, newData) {
  if (!oldData || !newData) return true;
  
  // If old data has activity and new data is all zeros, reject the update
  if ((oldData.buyAndBurnCount > 0 || oldData.buyAndBuildCount > 0) &&
      newData.buyAndBurnCount === 0 && newData.buyAndBuildCount === 0) {
    console.log(`⚠️  WARNING: Attempting to overwrite Day ${oldData.protocolDay} data with zeros. Preserving existing data.`);
    return false;
  }
  
  return true;
}

const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
    
    // Helper function to calculate protocol day from timestamp
    function getProtocolDay(timestamp) {
      const msPerDay = 24 * 60 * 60 * 1000;
      let dateObj;
      
      if (typeof timestamp === 'number') {
        // Unix timestamp in seconds
        dateObj = new Date(timestamp * 1000);
      } else if (typeof timestamp === 'string') {
        // Date string - but this should be avoided for protocol day calculation
        // Only use this as fallback for historical data
        dateObj = new Date(timestamp + 'T12:00:00.000Z');
      } else {
        dateObj = timestamp;
      }
      
      const daysDiff = Math.floor((dateObj.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1;
      return Math.max(1, daysDiff);
    }
    
    // Contract ABIs
    const buyProcessABI = [
      'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
      'event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)',
      'event FractalFundsReleased(uint256 releasedTitanX, uint256 releasedETH)',
      'function totalTitanXBurnt() view returns (uint256)',
      'function totalETHBurn() view returns (uint256)',
      'function titanXUsedForBurns() view returns (uint256)',
      'function ethUsedForBurns() view returns (uint256)'
    ];
    
    const stakeContractABI = [
      'function getCurrentDayIndex() view returns (uint24)'
    ];
    
    const torusABI = [
      'event Transfer(address indexed from, address indexed to, uint256 value)'
    ];
    
    const buyProcessContract = new ethers.Contract(BUY_PROCESS_CONTRACT, buyProcessABI, provider);
    const torusContract = new ethers.Contract(TORUS_CONTRACT, torusABI, provider);
    const STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
    const stakeContract = new ethers.Contract(STAKE_CONTRACT, stakeContractABI, provider);
    
    // Load existing data
    const dataPath = path.join(__dirname, '../public/data/buy-process-data.json');
    let existingData = null;
    let lastProcessedBlock = 22890272; // Contract deployment
    
    if (fs.existsSync(dataPath)) {
      existingData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      if (existingData.metadata?.lastBlock) {
        lastProcessedBlock = existingData.metadata.lastBlock;
      }
      
      // Validate existing data
      const validator = new DataValidator();
      validator.validateData(existingData);
      const validationReport = validator.getReport();
      
      if (!validationReport.valid) {
        AlertSystem.logAlert('Existing data validation failed, attempting recovery', 'WARNING');
        await DataRecovery.attemptRecovery(existingData);
      }
    }
    
    // Get current block with retry
    const currentBlock = await retryRPC(() => provider.getBlockNumber());
    console.log(`Updating from block ${lastProcessedBlock + 1} to ${currentBlock}`);
    
    if (currentBlock <= lastProcessedBlock) {
      console.log('No new blocks to process');
      return;
    }
    
    // Fetch new events
    const newBuyAndBurnEvents = [];
    const newBuyAndBuildEvents = [];
    const newFractalEvents = [];
    const newBurnTransfers = []; // Track actual TORUS burns to 0x0
    
    const chunkSize = 2000; // Reduced to avoid RPC limits
    for (let start = lastProcessedBlock + 1; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      
      try {
        const [burnEvents, buildEvents, fractals, torusBurns] = await retryRPC(() => Promise.all([
          buyProcessContract.queryFilter(buyProcessContract.filters.BuyAndBurn(), start, end),
          buyProcessContract.queryFilter(buyProcessContract.filters.BuyAndBuild(), start, end),
          buyProcessContract.queryFilter(buyProcessContract.filters.FractalFundsReleased(), start, end),
          // Get actual TORUS burns (transfers from Buy & Process to 0x0)
          torusContract.queryFilter(
            torusContract.filters.Transfer(
              BUY_PROCESS_CONTRACT,
              '0x0000000000000000000000000000000000000000'
            ),
            start,
            end
          )
        ]));
        
        newBuyAndBurnEvents.push(...burnEvents);
        newBuyAndBuildEvents.push(...buildEvents);
        newFractalEvents.push(...fractals);
        newBurnTransfers.push(...torusBurns);
      } catch (e) {
        AlertSystem.logAlert(`Error fetching blocks ${start}-${end}: ${e.message}`, 'ERROR');
        console.log(`Error fetching blocks ${start}-${end}, skipping...`);
      }
    }
    
    console.log(`Found ${newBuyAndBurnEvents.length} new Buy & Burn events`);
    console.log(`Found ${newBuyAndBuildEvents.length} new Buy & Build events`);
    console.log(`Found ${newFractalEvents.length} new Fractal events`);
    console.log(`Found ${newBurnTransfers.length} new TORUS burn transfers to 0x0`);
    
    // Get block timestamps for new events
    const allBlocks = new Set([
      ...newBuyAndBurnEvents.map(e => e.blockNumber),
      ...newBuyAndBuildEvents.map(e => e.blockNumber),
      ...newFractalEvents.map(e => e.blockNumber),
      ...newBurnTransfers.map(e => e.blockNumber)
    ]);
    
    const blockTimestamps = new Map();
    const blockArray = Array.from(allBlocks);
    
    for (let i = 0; i < blockArray.length; i += 10) {
      const batch = blockArray.slice(i, i + 10);
      const promises = batch.map(async (blockNumber) => {
        const block = await provider.getBlock(blockNumber);
        return { blockNumber, timestamp: block.timestamp };
      });
      
      const results = await Promise.all(promises);
      results.forEach(({ blockNumber, timestamp }) => {
        blockTimestamps.set(blockNumber, timestamp);
      });
    }
    
    // Process new events into daily data
    const newDailyData = {};
    
    // First, process TORUS burn transfers to get accurate burn amounts by date
    const burnsByDate = {};
    
    for (const transfer of newBurnTransfers) {
      const timestamp = blockTimestamps.get(transfer.blockNumber);
      const date = new Date(timestamp * 1000);
      const dateKey = date.toISOString().split('T')[0];
      
      if (!burnsByDate[dateKey]) {
        burnsByDate[dateKey] = ethers.BigNumber.from(0);
      }
      
      burnsByDate[dateKey] = burnsByDate[dateKey].add(transfer.args.value);
    }
    
    // Process Buy & Burn events (for counts and TitanX amounts)
    for (const event of newBuyAndBurnEvents) {
      const timestamp = blockTimestamps.get(event.blockNumber);
      const date = new Date(timestamp * 1000);
      const dateKey = date.toISOString().split('T')[0];
      
      if (!newDailyData[dateKey]) {
        newDailyData[dateKey] = {
          date: dateKey,
          protocolDay: getProtocolDay(timestamp),
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
      }
      
      newDailyData[dateKey].buyAndBurnCount++;
      const titanXAmount = parseFloat(ethers.utils.formatEther(event.args.titanXAmount));
      newDailyData[dateKey].titanXUsed += titanXAmount;
      newDailyData[dateKey].titanXUsedForBurns += titanXAmount;
      
      // Check if this is an ETH burn and get actual ETH amount with retry
      try {
        const tx = await retryRPC(() => provider.getTransaction(event.transactionHash));
        const functionSelector = tx.data.slice(0, 10);
        
        if (functionSelector === '0x39b6ce64') {
          // ETH burn - get WETH deposit amount
          const receipt = await retryRPC(() => provider.getTransactionReceipt(event.transactionHash));
          const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
          const depositTopic = ethers.utils.id('Deposit(address,uint256)');
          
          const wethDeposits = receipt.logs.filter(log => 
            log.address.toLowerCase() === WETH.toLowerCase() &&
            log.topics[0] === depositTopic
          );
          
          if (wethDeposits.length > 0) {
            const ethAmount = parseFloat(ethers.utils.formatEther(ethers.BigNumber.from(wethDeposits[0].data)));
            newDailyData[dateKey].ethUsed += ethAmount;
            newDailyData[dateKey].ethUsedForBurns += ethAmount;
          } else {
            AlertSystem.logAlert(`No WETH deposit found for ETH burn tx ${event.transactionHash}`, 'WARNING');
          }
        }
      } catch (e) {
        AlertSystem.logAlert(`Failed to detect ETH for burn tx ${event.transactionHash}: ${e.message}`, 'WARNING');
      }
    }
    
    // Set actual TORUS burned amounts from Transfer events
    for (const [dateKey, burnAmount] of Object.entries(burnsByDate)) {
      if (!newDailyData[dateKey]) {
        // Parse date to get timestamp for protocol day calculation
        const dateTimestamp = Math.floor(new Date(dateKey + 'T00:00:00Z').getTime() / 1000);
        newDailyData[dateKey] = {
          date: dateKey,
          protocolDay: getProtocolDay(dateTimestamp),
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
      }
      
      // Use actual burn amount from Transfer events
      newDailyData[dateKey].torusBurned = parseFloat(ethers.utils.formatEther(burnAmount));
    }
    
    // Process Buy & Build events
    for (const event of newBuyAndBuildEvents) {
      const timestamp = blockTimestamps.get(event.blockNumber);
      const date = new Date(timestamp * 1000);
      const dateKey = date.toISOString().split('T')[0];
      
      if (!newDailyData[dateKey]) {
        newDailyData[dateKey] = {
          date: dateKey,
          protocolDay: getProtocolDay(timestamp),
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
      }
      
      newDailyData[dateKey].buyAndBuildCount++;
      const torusPurchased = parseFloat(ethers.utils.formatEther(event.args.torusPurchased));
      newDailyData[dateKey].torusPurchased += torusPurchased;
      
      // Check transaction type for builds with retry
      try {
        const tx = await retryRPC(() => provider.getTransaction(event.transactionHash));
        const functionSelector = tx.data.slice(0, 10);
        
        if (functionSelector === '0x53ad9b96') {
          // ETH build - check transaction value first
          if (tx.value && !tx.value.isZero()) {
            const ethAmount = parseFloat(ethers.utils.formatEther(tx.value));
            newDailyData[dateKey].ethUsed += ethAmount;
            newDailyData[dateKey].ethUsedForBuilds += ethAmount;
          } else {
            // Check for WETH deposits in transaction logs
            try {
              const receipt = await retryRPC(() => provider.getTransactionReceipt(event.transactionHash));
              const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
              const WETH_DEPOSIT_TOPIC = '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c'; // Deposit(address,uint256)
              
              let ethAmount = 0;
              for (const log of receipt.logs) {
                if (log.address.toLowerCase() === WETH_ADDRESS.toLowerCase() && 
                    log.topics[0] === WETH_DEPOSIT_TOPIC) {
                  const depositAmount = ethers.BigNumber.from(log.data);
                  ethAmount = parseFloat(ethers.utils.formatEther(depositAmount));
                  break;
                }
              }
              
              if (ethAmount > 0) {
                newDailyData[dateKey].ethUsed += ethAmount;
                newDailyData[dateKey].ethUsedForBuilds += ethAmount;
              } else {
                AlertSystem.logAlert(`ETH build tx ${event.transactionHash} has no ETH value or WETH deposit`, 'WARNING');
              }
            } catch (e) {
              AlertSystem.logAlert(`Failed to check WETH for tx ${event.transactionHash}: ${e.message}`, 'WARNING');
            }
          }
        } else {
          // TitanX build
          const titanXAmount = parseFloat(ethers.utils.formatEther(event.args.tokenAllocated));
          newDailyData[dateKey].titanXUsed += titanXAmount;
          newDailyData[dateKey].titanXUsedForBuilds += titanXAmount;
        }
      } catch (e) {
        AlertSystem.logAlert(`Failed to detect payment type for build tx ${event.transactionHash}: ${e.message}`, 'WARNING');
        // Default to TitanX if detection fails
        const titanXAmount = parseFloat(ethers.utils.formatEther(event.args.tokenAllocated));
        newDailyData[dateKey].titanXUsed += titanXAmount;
        newDailyData[dateKey].titanXUsedForBuilds += titanXAmount;
      }
    }
    
    // Process Fractal events
    for (const event of newFractalEvents) {
      const timestamp = blockTimestamps.get(event.blockNumber);
      const date = new Date(timestamp * 1000);
      const dateKey = date.toISOString().split('T')[0];
      
      if (!newDailyData[dateKey]) {
        newDailyData[dateKey] = {
          date: dateKey,
          protocolDay: getProtocolDay(timestamp),
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
      }
      
      newDailyData[dateKey].fractalCount++;
      newDailyData[dateKey].fractalTitanX += parseFloat(ethers.utils.formatEther(event.args.releasedTitanX));
      newDailyData[dateKey].fractalETH += parseFloat(ethers.utils.formatEther(event.args.releasedETH));
    }
    
    // Merge with existing data
    let mergedDailyData = existingData?.dailyData || [];
    const dailyDataMap = new Map();
    
    // Add existing data to map
    mergedDailyData.forEach(day => {
      dailyDataMap.set(day.date, day);
    });
    
    // Merge new data
    Object.entries(newDailyData).forEach(([date, data]) => {
      if (dailyDataMap.has(date)) {
        const existing = dailyDataMap.get(date);
        dailyDataMap.set(date, {
          ...existing,
          protocolDay: existing.protocolDay || data.protocolDay, // Preserve existing or use new
          buyAndBurnCount: existing.buyAndBurnCount + data.buyAndBurnCount,
          buyAndBuildCount: existing.buyAndBuildCount + data.buyAndBuildCount,
          fractalCount: existing.fractalCount + data.fractalCount,
          torusBurned: existing.torusBurned + data.torusBurned,
          titanXUsed: existing.titanXUsed + data.titanXUsed,
          ethUsed: existing.ethUsed + data.ethUsed,
          titanXUsedForBurns: (existing.titanXUsedForBurns || 0) + (data.titanXUsedForBurns || 0),
          ethUsedForBurns: (existing.ethUsedForBurns || 0) + (data.ethUsedForBurns || 0),
          titanXUsedForBuilds: (existing.titanXUsedForBuilds || 0) + (data.titanXUsedForBuilds || 0),
          ethUsedForBuilds: (existing.ethUsedForBuilds || 0) + (data.ethUsedForBuilds || 0),
          torusPurchased: existing.torusPurchased + data.torusPurchased,
          fractalTitanX: existing.fractalTitanX + data.fractalTitanX,
          fractalETH: existing.fractalETH + data.fractalETH
        });
      } else {
        dailyDataMap.set(date, data);
      }
    });
    
    // Convert back to array and sort
    mergedDailyData = Array.from(dailyDataMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    
    // For existing data without timestamps, we need to determine protocol day based on date
    // This is a best effort - assumes activity happened after 6 PM UTC on that date
    mergedDailyData.forEach(day => {
      if (!day.protocolDay || day.protocolDay === 0) {
        // For historical data, assume events happened after protocol day start
        const dateAtProtocolStart = new Date(day.date + 'T18:00:00.000Z');
        day.protocolDay = getProtocolDay(dateAtProtocolStart.getTime() / 1000);
      }
    });
    
    // Calculate actual totals from Transfer events
    // Need to fetch in chunks to avoid RPC limits
    const allBurnTransfers = [];
    for (let start = 22890272; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      try {
        const transfers = await torusContract.queryFilter(
          torusContract.filters.Transfer(
            BUY_PROCESS_CONTRACT,
            '0x0000000000000000000000000000000000000000'
          ),
          start,
          end
        );
        allBurnTransfers.push(...transfers);
      } catch (e) {
        console.log(`Error fetching total burns for blocks ${start}-${end}, skipping...`);
      }
    }
    
    let totalTorusBurnt = ethers.BigNumber.from(0);
    for (const transfer of allBurnTransfers) {
      totalTorusBurnt = totalTorusBurnt.add(transfer.args.value);
    }
    
    // Get other totals from contract
    const [
      totalTitanXBurnt,
      totalETHBurn,
      titanXUsedForBurns,
      ethUsedForBurns
    ] = await Promise.all([
      buyProcessContract.totalTitanXBurnt(),
      buyProcessContract.totalETHBurn(),
      buyProcessContract.titanXUsedForBurns(),
      buyProcessContract.ethUsedForBurns()
    ]);
    
    // Get current protocol day from contract with retry
    const currentProtocolDay = await retryRPC(() => stakeContract.getCurrentDayIndex());
    const currentDayNumber = Number(currentProtocolDay);
    console.log(`\n📅 Current protocol day from contract: ${currentDayNumber}`);
    
    // Fill in missing days up to current protocol day
    const lastDataDay = mergedDailyData.length > 0 
      ? Math.max(...mergedDailyData.map(d => d.protocolDay))
      : 0;
    
    if (lastDataDay < currentDayNumber) {
      console.log(`📊 Filling in missing days ${lastDataDay + 1} to ${currentDayNumber}`);
      
      for (let day = lastDataDay + 1; day <= currentDayNumber; day++) {
        // Calculate date for this protocol day
        // Day N starts at CONTRACT_START_DATE + (N-1) * 24 hours
        const dayStartTime = new Date(CONTRACT_START_DATE.getTime() + (day - 1) * 24 * 60 * 60 * 1000);
        const dateKey = dayStartTime.toISOString().split('T')[0];
        
        // Only add if we don't already have data for this protocolDay
        const existingDayData = mergedDailyData.find(d => d.protocolDay === day);
        if (!existingDayData) {
          // Check if we have data for this date (might have wrong protocolDay)
          const existingDateData = mergedDailyData.find(d => d.date === dateKey);
          
          if (existingDateData && existingDateData.buyAndBurnCount > 0) {
            // We have existing data for this date with activity - just fix the protocol day
            console.log(`📊 Preserving existing data for Day ${day} (${dateKey})`);
            existingDateData.protocolDay = day;
          } else {
            // No existing data - add empty day
            mergedDailyData.push({
              date: dateKey,
              protocolDay: day,
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
            });
          }
        }
      }
      
      // Re-sort after adding missing days
      mergedDailyData.sort((a, b) => a.protocolDay - b.protocolDay);
    }
    
    // Update event counts
    const eventCounts = existingData?.eventCounts || { buyAndBurn: 0, buyAndBuild: 0, fractal: 0 };
    eventCounts.buyAndBurn += newBuyAndBurnEvents.length;
    eventCounts.buyAndBuild += newBuyAndBuildEvents.length;
    eventCounts.fractal += newFractalEvents.length;
    
    // Save updated data
    const outputData = {
      lastUpdated: new Date().toISOString(),
      currentDay: currentDayNumber,
      totals: {
        torusBurnt: ethers.utils.formatEther(totalTorusBurnt), // Use actual burn amount
        titanXBurnt: ethers.utils.formatEther(totalTitanXBurnt),
        ethBurn: ethers.utils.formatEther(totalETHBurn),
        titanXUsedForBurns: ethers.utils.formatEther(titanXUsedForBurns),
        ethUsedForBurns: ethers.utils.formatEther(ethUsedForBurns),
        ethUsedForBuilds: mergedDailyData.reduce((sum, day) => sum + (day.ethUsedForBuilds || 0), 0).toFixed(18)
      },
      dailyData: mergedDailyData,
      eventCounts: eventCounts,
      metadata: {
        lastBlock: currentBlock
      }
    };
    
    // Validate output data before saving
    const validator = new DataValidator();
    validator.validateData(outputData);
    const report = validator.getReport();
    
    if (!report.valid) {
      AlertSystem.sendAlert(report);
      AlertSystem.logAlert('Output data validation failed, attempting recovery', 'WARNING');
      const recovered = await DataRecovery.attemptRecovery(outputData);
      
      if (recovered) {
        // Re-validate after recovery
        validator.validateData(outputData);
        const newReport = validator.getReport();
        if (!newReport.valid) {
          AlertSystem.logAlert('Data recovery failed, saving anyway with warnings', 'ERROR');
        }
      }
    }
    
    fs.writeFileSync(dataPath, JSON.stringify(outputData, null, 2));
    
    console.log(`\n✅ Buy & Process data updated successfully`);
    console.log(`📊 Total days with data: ${mergedDailyData.length}`);
    console.log(`🔥 Total TORUS burned (actual): ${ethers.utils.formatEther(totalTorusBurnt)} TORUS`);
    
    if (report.warnings.length > 0) {
      console.log(`\n⚠️  ${report.warnings.length} warnings found (check logs/data-alerts.log)`);
    }
    
  } catch (error) {
    AlertSystem.logAlert(`Critical error in update-buy-process-data: ${error.message}`, 'ERROR');
    console.error('❌ Error updating Buy & Process data:', error);
    process.exit(1);
  }
}

// Run the update
updateBuyProcessData();