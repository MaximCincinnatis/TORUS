#!/usr/bin/env node

/**
 * Trace Specific ETH Discrepancy
 * Deep dive into the missing 0.013022 ETH for Day 19
 */

const { ethers } = require('ethers');
const fs = require('fs');

// Contract addresses
const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
const WETH_CONTRACT = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

// RPC endpoints
const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com'
];

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

// Update script's protocol day calculation (from update-buy-process-data.js)
function getProtocolDayFromScript(timestamp) {
  const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
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

// Script's method for processing burn events by date
function getDateKey(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toISOString().split('T')[0];
}

async function traceSpecificETHDiscrepancy() {
  console.log('🔍 Tracing Specific ETH Discrepancy for Day 19\n');
  
  try {
    const provider = await getProvider();
    
    // Look for transactions around Day 18/19 boundary
    const boundaryStart = new Date('2025-07-28T17:00:00.000Z'); // 1 hour before Day 19
    const boundaryEnd = new Date('2025-07-29T19:00:00.000Z');   // 1 hour after Day 19
    
    console.log(`Boundary search: ${boundaryStart.toISOString()} to ${boundaryEnd.toISOString()}`);
    
    const startTimestamp = Math.floor(boundaryStart.getTime() / 1000);
    const endTimestamp = Math.floor(boundaryEnd.getTime() / 1000);
    
    const currentBlock = await provider.getBlockNumber();
    const currentBlockData = await provider.getBlock(currentBlock);
    const currentTimestamp = currentBlockData.timestamp;
    
    const blocksPerSecond = 1 / 12;
    const startBlock = Math.floor(currentBlock - (currentTimestamp - startTimestamp) * blocksPerSecond);
    const endBlock = Math.floor(currentBlock - (currentTimestamp - endTimestamp) * blocksPerSecond);
    
    console.log(`Block range: ${startBlock} to ${endBlock}\n`);
    
    // Get Buy & Process contract events
    const buyProcessABI = [
      'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)'
    ];
    
    const buyProcessContract = new ethers.Contract(BUY_PROCESS_CONTRACT, buyProcessABI, provider);
    
    console.log('Fetching BuyAndBurn events around Day 18/19 boundary...');
    const burnEvents = await buyProcessContract.queryFilter(
      buyProcessContract.filters.BuyAndBurn(),
      startBlock,
      endBlock
    );
    
    console.log(`Found ${burnEvents.length} BuyAndBurn events\n`);
    
    const ethTransactions = [];
    
    // Analyze each transaction with both date methods
    for (const event of burnEvents) {
      const tx = await provider.getTransaction(event.transactionHash);
      const receipt = await provider.getTransactionReceipt(event.transactionHash);
      const block = await provider.getBlock(event.blockNumber);
      
      const blockTimestamp = block.timestamp;
      const functionSelector = tx.data.slice(0, 10);
      
      // Check if this is an ETH burn transaction
      if (functionSelector === '0x39b6ce64') {
        const depositTopic = ethers.utils.id('Deposit(address,uint256)');
        const wethDeposits = receipt.logs.filter(log => 
          log.address.toLowerCase() === WETH_CONTRACT.toLowerCase() &&
          log.topics[0] === depositTopic
        );
        
        if (wethDeposits.length > 0) {
          const ethAmount = parseFloat(ethers.utils.formatEther(ethers.BigNumber.from(wethDeposits[0].data)));
          
          // Calculate using both methods
          const scriptProtocolDay = getProtocolDayFromScript(blockTimestamp);
          const scriptDateKey = getDateKey(blockTimestamp);
          const blockDate = new Date(blockTimestamp * 1000);
          
          ethTransactions.push({
            txHash: event.transactionHash,
            block: event.blockNumber,
            timestamp: blockTimestamp,
            blockDate: blockDate.toISOString(),
            ethAmount: ethAmount,
            scriptProtocolDay: scriptProtocolDay,
            scriptDateKey: scriptDateKey
          });
        }
      }
    }
    
    // Group by script's date attribution
    const scriptGrouping = {};
    ethTransactions.forEach(tx => {
      if (!scriptGrouping[tx.scriptDateKey]) {
        scriptGrouping[tx.scriptDateKey] = {
          protocolDay: tx.scriptProtocolDay,
          transactions: [],
          totalETH: 0
        };
      }
      scriptGrouping[tx.scriptDateKey].transactions.push(tx);
      scriptGrouping[tx.scriptDateKey].totalETH += tx.ethAmount;
    });
    
    console.log('=== ETH TRANSACTIONS AROUND BOUNDARY ===\n');
    
    for (const [dateKey, data] of Object.entries(scriptGrouping).sort()) {
      console.log(`Date: ${dateKey} (Protocol Day ${data.protocolDay})`);
      console.log(`Total ETH: ${data.totalETH.toFixed(6)} ETH`);
      console.log(`Transactions: ${data.transactions.length}`);
      
      data.transactions.forEach(tx => {
        console.log(`  ${tx.txHash}: ${tx.ethAmount.toFixed(6)} ETH at ${tx.blockDate}`);
      });
      console.log('');
    }
    
    // Now look for the specific missing 0.013022 ETH
    console.log('=== SEARCHING FOR MISSING 0.013022 ETH ===\n');
    
    // Check if there's a transaction with exactly this amount
    const targetAmount = 0.013022;
    const tolerance = 0.000001;
    
    const matchingTx = ethTransactions.find(tx => 
      Math.abs(tx.ethAmount - targetAmount) < tolerance
    );
    
    if (matchingTx) {
      console.log(`Found potential match: ${matchingTx.txHash}`);
      console.log(`Amount: ${matchingTx.ethAmount.toFixed(6)} ETH`);
      console.log(`Block Date: ${matchingTx.blockDate}`);
      console.log(`Script assigns to Protocol Day: ${matchingTx.scriptProtocolDay}`);
      console.log(`Script date key: ${matchingTx.scriptDateKey}`);
    } else {
      console.log('No exact match found for 0.013022 ETH');
    }
    
    // Check for any transactions that might be getting double-counted
    console.log('\n=== CHECKING FOR POTENTIAL DOUBLE-COUNTING ===\n');
    
    // Load the buy-process-data.json to see if we can find the source
    const buyProcessData = JSON.parse(fs.readFileSync('./public/data/buy-process-data.json', 'utf8'));
    
    // Check if there are any duplicate transactions in the data
    console.log('Checking current data structure...');
    console.log(`Total ETH used for burns in cached data: ${buyProcessData.totals.ethUsedForBurns}`);
    
    // Day 19 data
    const day19Data = buyProcessData.dailyData.find(d => d.protocolDay === 19);
    if (day19Data) {
      console.log(`Day 19 cached ETH: ${day19Data.ethUsedForBurns}`);
      console.log(`Day 19 date: ${day19Data.date}`);
      
      // Check if the date-based grouping might be causing issues
      const day19DateData = buyProcessData.dailyData.find(d => d.date === '2025-07-29');
      if (day19DateData && day19DateData !== day19Data) {
        console.log('Found separate date-based entry for 2025-07-29');
        console.log(`Date-based ETH: ${day19DateData.ethUsedForBurns}`);
      }
    }
    
    console.log('\n=== HYPOTHESIS ===');
    console.log('The discrepancy likely comes from:');
    console.log('1. Script using date-based grouping (line 213 in update script)');
    console.log('2. Our audit using protocol day calculation from timestamp');
    console.log('3. Some transactions near day boundary may be attributed differently');
    console.log('4. Historical data merging might have accumulated errors');
    
  } catch (error) {
    console.error('❌ Error during trace:', error);
  }
}

traceSpecificETHDiscrepancy();