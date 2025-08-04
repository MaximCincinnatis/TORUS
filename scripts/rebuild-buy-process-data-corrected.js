#!/usr/bin/env node

/**
 * Rebuilds Buy & Process data from scratch with CORRECTED protocol day assignment
 * 
 * Key fixes:
 * - Groups burns by protocol day (6PM UTC boundaries) instead of calendar date
 * - Tracks actual TORUS burns from Transfer events to 0x0
 * - Includes RPC rotation and resumability
 * - Full rebuild from contract deployment
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// RPC endpoints with rotation
const RPC_ENDPOINTS = [
  process.env.ETHEREUM_RPC_URL || 'https://eth.drpc.org',
  'https://ethereum.publicnode.com', 
  'https://eth.llamarpc.com',
  'https://rpc.payload.de',
  'https://eth-mainnet.public.blastapi.io'
];

let currentRPCIndex = 0;

// Get provider with rotation
async function getProvider() {
  for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
    const index = (currentRPCIndex + i) % RPC_ENDPOINTS.length;
    try {
      const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[index]);
      await provider.getBlockNumber();
      currentRPCIndex = index;
      console.log(`Using RPC: ${RPC_ENDPOINTS[index]}`);
      return provider;
    } catch (e) {
      console.log(`RPC ${RPC_ENDPOINTS[index]} failed, trying next...`);
    }
  }
  throw new Error('All RPC endpoints failed');
}

// Rotate to next RPC
function rotateRPC() {
  currentRPCIndex = (currentRPCIndex + 1) % RPC_ENDPOINTS.length;
  console.log(`Rotating to RPC: ${RPC_ENDPOINTS[currentRPCIndex]}`);
}

// Contract start date for protocol day calculation
const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');

// Helper function to calculate protocol day from timestamp
function getProtocolDay(timestamp) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const timeSinceStart = (timestamp * 1000) - CONTRACT_START_DATE.getTime();
  return Math.floor(timeSinceStart / msPerDay) + 1;
}

// Helper function to get date string for a protocol day
function getDateForProtocolDay(protocolDay) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const dayStart = new Date(CONTRACT_START_DATE.getTime() + ((protocolDay - 1) * msPerDay));
  return dayStart.toISOString().split('T')[0];
}

// State file for resumability
const STATE_FILE = path.join(__dirname, '.rebuild-state-corrected.json');

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  }
  return null;
}

function clearState() {
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
  }
}

async function rebuildBuyProcessData() {
  console.log('🔨 Rebuilding Buy & Process data with CORRECTED protocol day assignment...\n');
  
  let provider = await getProvider();
  
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  const TORUS_CONTRACT = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
  const DEPLOYMENT_BLOCK = 22890272;
  
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
  
  const torusABI = [
    'event Transfer(address indexed from, address indexed to, uint256 value)'
  ];
  
  const buyProcessContract = new ethers.Contract(BUY_PROCESS_CONTRACT, buyProcessABI, provider);
  const torusContract = new ethers.Contract(TORUS_CONTRACT, torusABI, provider);
  
  // Load or initialize state
  let state = loadState() || {
    lastProcessedBlock: DEPLOYMENT_BLOCK - 1,
    buyAndBurnEvents: [],
    buyAndBuildEvents: [],
    fractalEvents: [],
    burnTransfers: [],
    blockTimestamps: {}
  };
  
  console.log(`Resuming from block ${state.lastProcessedBlock + 1}`);
  
  try {
    // Get current block with retry
    let currentBlock;
    for (let retry = 0; retry < 3; retry++) {
      try {
        currentBlock = await provider.getBlockNumber();
        break;
      } catch (e) {
        console.log(`Failed to get current block, retry ${retry + 1}/3`);
        provider = await getProvider();
      }
    }
    
    if (!currentBlock) throw new Error('Failed to get current block');
    
    console.log(`Current block: ${currentBlock}`);
    console.log(`Blocks to process: ${currentBlock - state.lastProcessedBlock}`);
    
    // Process in chunks
    const chunkSize = 2000; // Smaller chunks for stability
    
    for (let start = state.lastProcessedBlock + 1; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      console.log(`\nProcessing blocks ${start}-${end}...`);
      
      let retries = 0;
      while (retries < 3) {
        try {
          // Fetch all events for this chunk
          const [burnEvents, buildEvents, fractals, transfers] = await Promise.all([
            buyProcessContract.queryFilter(buyProcessContract.filters.BuyAndBurn(), start, end),
            buyProcessContract.queryFilter(buyProcessContract.filters.BuyAndBuild(), start, end),
            buyProcessContract.queryFilter(buyProcessContract.filters.FractalFundsReleased(), start, end),
            torusContract.queryFilter(
              torusContract.filters.Transfer(BUY_PROCESS_CONTRACT, '0x0000000000000000000000000000000000000000'),
              start,
              end
            )
          ]);
          
          // Collect unique blocks for timestamp fetching
          const blockNumbers = new Set();
          [...burnEvents, ...buildEvents, ...fractals, ...transfers].forEach(e => {
            blockNumbers.add(e.blockNumber);
          });
          
          // Fetch timestamps for new blocks
          console.log(`Fetching timestamps for ${blockNumbers.size} blocks...`);
          for (const blockNumber of blockNumbers) {
            if (!state.blockTimestamps[blockNumber]) {
              const block = await provider.getBlock(blockNumber);
              state.blockTimestamps[blockNumber] = block.timestamp;
            }
          }
          
          // Add events to state
          state.buyAndBurnEvents.push(...burnEvents);
          state.buyAndBuildEvents.push(...buildEvents);
          state.fractalEvents.push(...fractals);
          state.burnTransfers.push(...transfers);
          
          // Update last processed block
          state.lastProcessedBlock = end;
          saveState(state);
          
          console.log(`Found ${burnEvents.length} burns, ${buildEvents.length} builds, ${transfers.length} transfers`);
          break;
          
        } catch (e) {
          retries++;
          console.log(`Error processing chunk, retry ${retries}/3: ${e.message}`);
          if (retries >= 3) {
            console.log('Max retries reached, saving progress and exiting');
            throw e;
          }
          rotateRPC();
          provider = await getProvider();
        }
      }
    }
    
    console.log('\n✅ All events fetched successfully!');
    console.log(`Total Buy & Burn events: ${state.buyAndBurnEvents.length}`);
    console.log(`Total Buy & Build events: ${state.buyAndBuildEvents.length}`);
    console.log(`Total Fractal events: ${state.fractalEvents.length}`);
    console.log(`Total burn transfers: ${state.burnTransfers.length}`);
    
    // Process events into daily data grouped by PROTOCOL DAY
    console.log('\nProcessing events by protocol day...');
    
    const dailyData = {};
    
    // First, process TORUS burn transfers to get accurate burn amounts by protocol day
    const burnsByDay = {};
    
    for (const transfer of state.burnTransfers) {
      const timestamp = state.blockTimestamps[transfer.blockNumber];
      const protocolDay = getProtocolDay(timestamp);
      
      if (!burnsByDay[protocolDay]) {
        burnsByDay[protocolDay] = ethers.BigNumber.from(0);
      }
      
      burnsByDay[protocolDay] = burnsByDay[protocolDay].add(transfer.args.value);
    }
    
    // Process Buy & Burn events
    for (const event of state.buyAndBurnEvents) {
      const timestamp = state.blockTimestamps[event.blockNumber];
      const protocolDay = getProtocolDay(timestamp);
      const dateKey = getDateForProtocolDay(protocolDay);
      
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {
          date: dateKey,
          protocolDay: protocolDay,
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
      
      dailyData[dateKey].buyAndBurnCount++;
      const titanXAmount = parseFloat(ethers.utils.formatEther(event.args.titanXAmount));
      dailyData[dateKey].titanXUsed += titanXAmount;
      dailyData[dateKey].titanXUsedForBurns += titanXAmount;
    }
    
    // Process Buy & Build events
    for (const event of state.buyAndBuildEvents) {
      const timestamp = state.blockTimestamps[event.blockNumber];
      const protocolDay = getProtocolDay(timestamp);
      const dateKey = getDateForProtocolDay(protocolDay);
      
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {
          date: dateKey,
          protocolDay: protocolDay,
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
      
      dailyData[dateKey].buyAndBuildCount++;
      dailyData[dateKey].torusPurchased += parseFloat(ethers.utils.formatEther(event.args.torusPurchased));
      
      // Note: ETH vs TitanX detection would need transaction analysis
      // For now, defaulting to TitanX
      const amount = parseFloat(ethers.utils.formatEther(event.args.tokenAllocated));
      dailyData[dateKey].titanXUsed += amount;
      dailyData[dateKey].titanXUsedForBuilds += amount;
    }
    
    // Process Fractal events
    for (const event of state.fractalEvents) {
      const timestamp = state.blockTimestamps[event.blockNumber];
      const protocolDay = getProtocolDay(timestamp);
      const dateKey = getDateForProtocolDay(protocolDay);
      
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {
          date: dateKey,
          protocolDay: protocolDay,
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
      
      dailyData[dateKey].fractalCount++;
      dailyData[dateKey].fractalTitanX += parseFloat(ethers.utils.formatEther(event.args.releasedTitanX));
      dailyData[dateKey].fractalETH += parseFloat(ethers.utils.formatEther(event.args.releasedETH));
    }
    
    // Set actual TORUS burned amounts from Transfer events
    for (const [protocolDay, burnAmount] of Object.entries(burnsByDay)) {
      const dateKey = getDateForProtocolDay(protocolDay);
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {
          date: dateKey,
          protocolDay: parseInt(protocolDay),
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
      dailyData[dateKey].torusBurned = parseFloat(ethers.utils.formatEther(burnAmount));
    }
    
    // Convert to array and sort
    const dailyDataArray = Object.values(dailyData).sort((a, b) => a.protocolDay - b.protocolDay);
    
    // Calculate totals from actual Transfer events
    let totalTorusBurnt = ethers.BigNumber.from(0);
    for (const transfer of state.burnTransfers) {
      totalTorusBurnt = totalTorusBurnt.add(transfer.args.value);
    }
    
    // Get contract totals for other metrics
    const [totalTitanXBurnt, totalETHBurn, titanXUsedForBurns, ethUsedForBurns] = await Promise.all([
      buyProcessContract.totalTitanXBurnt(),
      buyProcessContract.totalETHBurn(),
      buyProcessContract.titanXUsedForBurns(),
      buyProcessContract.ethUsedForBurns()
    ]);
    
    // Calculate current protocol day
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const currentProtocolDay = getProtocolDay(currentTimestamp);
    
    // Build final data structure
    const outputData = {
      lastUpdated: new Date().toISOString(),
      currentDay: currentProtocolDay,
      totals: {
        torusBurnt: ethers.utils.formatEther(totalTorusBurnt),
        titanXBurnt: ethers.utils.formatEther(totalTitanXBurnt),
        ethBurn: ethers.utils.formatEther(totalETHBurn),
        titanXUsedForBurns: ethers.utils.formatEther(titanXUsedForBurns),
        ethUsedForBurns: ethers.utils.formatEther(ethUsedForBurns),
        ethUsedForBuilds: dailyDataArray.reduce((sum, day) => sum + day.ethUsedForBuilds, 0).toString()
      },
      dailyData: dailyDataArray,
      eventCounts: {
        buyAndBurn: state.buyAndBurnEvents.length,
        buyAndBuild: state.buyAndBuildEvents.length,
        fractal: state.fractalEvents.length
      },
      metadata: {
        lastBlock: currentBlock,
        rebuiltWithCorrectProtocolDays: true
      }
    };
    
    // Save the corrected data
    const outputPath = path.join(__dirname, '../public/data/buy-process-data-corrected.json');
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    
    console.log('\n✅ Buy & Process data rebuilt successfully with CORRECT protocol day assignment!');
    console.log(`Output saved to: ${outputPath}`);
    console.log(`Total TORUS burned: ${ethers.utils.formatEther(totalTorusBurnt)} TORUS`);
    console.log(`Total events: ${state.buyAndBurnEvents.length + state.buyAndBuildEvents.length + state.fractalEvents.length}`);
    
    // Clear state file after successful completion
    clearState();
    
  } catch (error) {
    console.error('❌ Error during rebuild:', error.message);
    console.log('State saved. You can re-run this script to resume from where it left off.');
    process.exit(1);
  }
}

// Run the rebuild
rebuildBuyProcessData().catch(console.error);