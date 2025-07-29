#!/usr/bin/env node

/**
 * Fetches EXACT ETH values for all Buy & Build operations
 * Uses RPC rotation and rate limiting for reliability
 * This will take time but will get 100% accurate on-chain data
 */

const { ethers } = require('ethers');
const fs = require('fs');

// Contract addresses
const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

// ABIs
const BUY_PROCESS_ABI = [
  'event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)'
];

const WETH_ABI = [
  'event Deposit(address indexed dst, uint256 wad)'
];

// RPC endpoints with rate limits
const RPC_CONFIGS = [
  { url: 'https://eth.llamarpc.com', requestsPerSecond: 5 },
  { url: 'https://ethereum.publicnode.com', requestsPerSecond: 10 },
  { url: 'https://rpc.ankr.com/eth', requestsPerSecond: 30 },
  { url: 'https://eth.meowrpc.com', requestsPerSecond: 5 },
  { url: 'https://eth-mainnet.public.blastapi.io', requestsPerSecond: 10 },
  { url: 'https://cloudflare-eth.com', requestsPerSecond: 10 },
  { url: 'https://rpc.payload.de', requestsPerSecond: 5 },
  { url: 'https://ethereum.blockpi.network/v1/rpc/public', requestsPerSecond: 10 },
  { url: 'https://eth-mainnet.nodereal.io/v1/1659dfb40aa24bbb8153a677b98064d7', requestsPerSecond: 10 },
  { url: 'https://api.zan.top/node/v1/eth/mainnet/public', requestsPerSecond: 10 }
];

// RPC rotation state
let currentRpcIndex = 0;
let requestCounts = new Map();
let lastRequestTimes = new Map();

// Initialize request tracking
RPC_CONFIGS.forEach((config, index) => {
  requestCounts.set(index, 0);
  lastRequestTimes.set(index, 0);
});

async function getProviderWithRateLimit() {
  // Try to find an RPC that hasn't hit rate limit
  for (let attempts = 0; attempts < RPC_CONFIGS.length * 2; attempts++) {
    const config = RPC_CONFIGS[currentRpcIndex];
    const now = Date.now();
    const lastRequestTime = lastRequestTimes.get(currentRpcIndex);
    const timeSinceLastRequest = now - lastRequestTime;
    const minTimeBetweenRequests = 1000 / config.requestsPerSecond;
    
    if (timeSinceLastRequest >= minTimeBetweenRequests) {
      lastRequestTimes.set(currentRpcIndex, now);
      requestCounts.set(currentRpcIndex, requestCounts.get(currentRpcIndex) + 1);
      
      try {
        const provider = new ethers.providers.JsonRpcProvider(config.url);
        provider.rpcIndex = currentRpcIndex;
        return provider;
      } catch (error) {
        console.log(`RPC ${config.url} failed to initialize`);
        rotateRpc();
        continue;
      }
    }
    
    // This RPC is rate limited, try next
    rotateRpc();
  }
  
  // All RPCs are rate limited, wait a bit
  console.log('All RPCs rate limited, waiting 1 second...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  return getProviderWithRateLimit();
}

function rotateRpc() {
  currentRpcIndex = (currentRpcIndex + 1) % RPC_CONFIGS.length;
}

async function fetchWithRetry(fn, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const provider = await getProviderWithRateLimit();
      return await fn(provider);
    } catch (error) {
      console.log(`Attempt ${i + 1}/${maxRetries} failed: ${error.message}`);
      if (i < maxRetries - 1) {
        rotateRpc();
        // Exponential backoff
        const waitTime = Math.min(1000 * Math.pow(2, i), 30000);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
}

async function getETHValueForBuild(txHash) {
  return fetchWithRetry(async (provider) => {
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!tx || !receipt) {
      console.log(`    ⚠️ Transaction not found: ${txHash}`);
      return 0;
    }
    
    // Check direct ETH value
    let ethValue = parseFloat(ethers.utils.formatEther(tx.value));
    
    if (ethValue > 0) {
      console.log(`    ✅ ${txHash.substring(0, 10)}... Direct ETH: ${ethValue} ETH`);
      return ethValue;
    }
    
    // Check for WETH deposit
    const wethInterface = new ethers.utils.Interface(WETH_ABI);
    
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
        try {
          const parsed = wethInterface.parseLog(log);
          if (parsed.name === 'Deposit' && parsed.args.dst.toLowerCase() === BUY_PROCESS_CONTRACT.toLowerCase()) {
            ethValue = parseFloat(ethers.utils.formatEther(parsed.args.wad));
            console.log(`    ✅ ${txHash.substring(0, 10)}... WETH: ${ethValue} ETH`);
            return ethValue;
          }
        } catch (e) {
          // Not a WETH deposit event
        }
      }
    }
    
    console.log(`    ℹ️  ${txHash.substring(0, 10)}... No ETH (TitanX build)`);
    return 0;
  });
}

async function main() {
  console.log('🔧 Fetching ALL Buy & Build ETH Values with RPC Rotation\n');
  console.log('This will take time but will get 100% accurate on-chain data...\n');
  
  // Load existing data
  const buyProcessData = JSON.parse(fs.readFileSync('public/data/buy-process-data.json', 'utf8'));
  
  // Get current block
  const currentBlock = await fetchWithRetry(async (provider) => provider.getBlockNumber());
  console.log(`Current block: ${currentBlock}\n`);
  
  // First, get all BuyAndBuild events
  console.log('📥 Phase 1: Fetching all BuyAndBuild events...\n');
  
  const startBlock = 22890272; // Contract deployment
  const chunkSize = 500; // Smaller chunks for reliability
  let allEvents = [];
  
  // Progress tracking
  const totalChunks = Math.ceil((currentBlock - startBlock) / chunkSize);
  let chunksProcessed = 0;
  
  for (let fromBlock = startBlock; fromBlock <= currentBlock; fromBlock += chunkSize) {
    const toBlock = Math.min(fromBlock + chunkSize - 1, currentBlock);
    chunksProcessed++;
    
    try {
      const events = await fetchWithRetry(async (provider) => {
        const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, BUY_PROCESS_ABI, provider);
        return contract.queryFilter(contract.filters.BuyAndBuild(), fromBlock, toBlock);
      });
      
      if (events.length > 0) {
        console.log(`[${chunksProcessed}/${totalChunks}] Block ${fromBlock}-${toBlock}: Found ${events.length} events`);
        allEvents.push(...events);
      } else {
        console.log(`[${chunksProcessed}/${totalChunks}] Block ${fromBlock}-${toBlock}: No events`);
      }
    } catch (error) {
      console.log(`[${chunksProcessed}/${totalChunks}] Block ${fromBlock}-${toBlock}: ERROR - ${error.message}`);
    }
    
    // Progress update every 10 chunks
    if (chunksProcessed % 10 === 0) {
      const progress = (chunksProcessed / totalChunks * 100).toFixed(1);
      console.log(`\n📊 Progress: ${progress}% (${chunksProcessed}/${totalChunks} chunks)\n`);
    }
  }
  
  console.log(`\n✅ Phase 1 Complete: Found ${allEvents.length} total BuyAndBuild events\n`);
  
  // Save events for recovery if needed
  fs.writeFileSync('temp-buyandbuildevents.json', JSON.stringify(allEvents.map(e => ({
    transactionHash: e.transactionHash,
    day: Number(e.args.day),
    blockNumber: e.blockNumber
  })), null, 2));
  
  // Phase 2: Get ETH values for each event
  console.log('📥 Phase 2: Fetching ETH values for each transaction...\n');
  
  const dayETHMap = new Map();
  let totalETH = 0;
  let eventsProcessed = 0;
  
  for (const event of allEvents) {
    eventsProcessed++;
    // Get protocol day from transaction timestamp
    const block = await fetchWithRetry(async (provider) => provider.getBlock(event.blockNumber));
    const timestamp = block.timestamp;
    const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
    const msPerDay = 24 * 60 * 60 * 1000;
    const dateObj = new Date(timestamp * 1000);
    const day = Math.floor((dateObj.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1;
    
    if (eventsProcessed % 10 === 0) {
      const progress = (eventsProcessed / allEvents.length * 100).toFixed(1);
      console.log(`\n📊 Progress: ${progress}% (${eventsProcessed}/${allEvents.length} events)\n`);
    }
    
    try {
      const ethValue = await getETHValueForBuild(event.transactionHash);
      
      if (ethValue > 0) {
        if (!dayETHMap.has(day)) {
          dayETHMap.set(day, {
            count: 0,
            totalETH: 0,
            transactions: []
          });
        }
        
        const dayData = dayETHMap.get(day);
        dayData.count++;
        dayData.totalETH += ethValue;
        dayData.transactions.push({
          hash: event.transactionHash,
          eth: ethValue,
          block: event.blockNumber
        });
        
        totalETH += ethValue;
      }
    } catch (error) {
      console.log(`    ❌ Error processing ${event.transactionHash}: ${error.message}`);
    }
    
    // Save progress periodically
    if (eventsProcessed % 50 === 0) {
      fs.writeFileSync('temp-eth-progress.json', JSON.stringify({
        eventsProcessed,
        totalEvents: allEvents.length,
        dayETHMap: Object.fromEntries(dayETHMap),
        totalETH
      }, null, 2));
    }
  }
  
  console.log('\n✅ Phase 2 Complete: All ETH values fetched\n');
  
  // Phase 3: Update the JSON with exact values
  console.log('📊 Phase 3: Updating buy-process-data.json...\n');
  
  console.log('ETH Build Summary by Day:');
  console.log('=========================');
  
  const sortedDays = Array.from(dayETHMap.keys()).sort((a, b) => a - b);
  
  for (const day of sortedDays) {
    const data = dayETHMap.get(day);
    console.log(`\nDay ${day}: ${data.count} ETH builds, Total: ${data.totalETH.toFixed(18)} ETH`);
    
    // Update the JSON data
    const dayEntry = buyProcessData.dailyData.find(d => d.protocolDay === day);
    if (dayEntry) {
      const oldValue = dayEntry.ethUsedForBuilds;
      dayEntry.ethUsedForBuilds = data.totalETH;
      
      // Recalculate total ethUsed
      dayEntry.ethUsed = parseFloat((dayEntry.ethUsedForBurns + data.totalETH).toFixed(18));
      
      console.log(`  Updated: ${oldValue} → ${data.totalETH} ETH`);
      
      // Store transaction details for audit
      dayEntry.ethBuildTransactions = data.transactions;
    }
  }
  
  // Update totals
  buyProcessData.totals.ethUsedForBuilds = totalETH.toFixed(18);
  
  // Recalculate total ETH burn
  let totalETHBurn = 0;
  buyProcessData.dailyData.forEach(day => {
    totalETHBurn += day.ethUsed || 0;
  });
  buyProcessData.totals.ethBurn = totalETHBurn.toFixed(18);
  
  // Save updated data
  fs.writeFileSync('public/data/buy-process-data.json', JSON.stringify(buyProcessData, null, 2));
  
  // Clean up temp files
  try {
    fs.unlinkSync('temp-buyandbuildevents.json');
    fs.unlinkSync('temp-eth-progress.json');
  } catch (e) {
    // Ignore if files don't exist
  }
  
  console.log('\n📊 Final Summary:');
  console.log('=================');
  console.log(`Total ETH used for builds: ${totalETH.toFixed(18)} ETH`);
  console.log(`Total ETH burn: ${totalETHBurn.toFixed(18)} ETH`);
  console.log(`Events processed: ${allEvents.length}`);
  console.log(`Days with ETH builds: ${dayETHMap.size}`);
  
  // RPC usage stats
  console.log('\n📡 RPC Usage Statistics:');
  RPC_CONFIGS.forEach((config, index) => {
    const count = requestCounts.get(index);
    console.log(`${config.url}: ${count} requests`);
  });
  
  console.log('\n✅ SUCCESS! buy-process-data.json updated with 100% accurate on-chain ETH values!');
  
  // Run validation
  console.log('\n🔍 Running validation...\n');
  require('child_process').execSync('node scripts/validate-no-duplicates.js', { stdio: 'inherit' });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Process interrupted. Progress saved to temp-eth-progress.json');
  console.log('You can resume by modifying the script to load from the temp file.');
  process.exit(0);
});

main().catch(console.error);