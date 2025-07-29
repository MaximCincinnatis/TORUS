#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');

// Contract addresses
const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

// ABIs
const BUY_PROCESS_ABI = [
  'event BuyAndBuild(address indexed user, uint256 indexed day, uint256 titanXAmount, uint256 torusAmount)'
];

const WETH_ABI = [
  'event Deposit(address indexed dst, uint256 wad)'
];

// RPC endpoints
const RPC_ENDPOINTS = [
  'https://eth.llamarpc.com',
  'https://ethereum.publicnode.com',
  'https://rpc.ankr.com/eth',
  'https://eth.meowrpc.com',
  'https://eth-mainnet.public.blastapi.io'
];

let currentRpcIndex = 0;

function getProvider() {
  return new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[currentRpcIndex]);
}

function rotateRpc() {
  currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
  console.log(`Rotating to RPC: ${RPC_ENDPOINTS[currentRpcIndex]}`);
}

async function fetchWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      console.log(`Attempt ${i + 1} failed: ${error.message}`);
      if (i < maxRetries - 1) {
        rotateRpc();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between retries
      } else {
        throw error;
      }
    }
  }
}

async function getETHFromTransaction(txHash, provider) {
  try {
    const tx = await fetchWithRetry(() => provider.getTransaction(txHash));
    const receipt = await fetchWithRetry(() => provider.getTransactionReceipt(txHash));
    
    if (!tx || !receipt) {
      console.log(`  ⚠️ Transaction not found: ${txHash}`);
      return 0;
    }
    
    // First check direct ETH value
    let ethValue = parseFloat(ethers.utils.formatEther(tx.value));
    
    // If no direct ETH, check for WETH deposit
    if (ethValue === 0) {
      const wethInterface = new ethers.utils.Interface(WETH_ABI);
      
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
          try {
            const parsed = wethInterface.parseLog(log);
            if (parsed.name === 'Deposit' && parsed.args.dst.toLowerCase() === BUY_PROCESS_CONTRACT.toLowerCase()) {
              ethValue = parseFloat(ethers.utils.formatEther(parsed.args.wad));
              break;
            }
          } catch (e) {
            // Not a WETH deposit event
          }
        }
      }
    }
    
    return ethValue;
  } catch (error) {
    console.log(`  ❌ Error fetching tx ${txHash}: ${error.message}`);
    return 0;
  }
}

async function main() {
  console.log('🔍 Fetching EXACT ETH values for all Buy & Build operations\n');
  
  const provider = getProvider();
  const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, BUY_PROCESS_ABI, provider);
  
  // Get current block
  const currentBlock = await fetchWithRetry(() => provider.getBlockNumber());
  console.log(`Current block: ${currentBlock}\n`);
  
  // Load existing data
  const buyProcessData = JSON.parse(fs.readFileSync('public/data/buy-process-data.json', 'utf8'));
  
  // Process each day that has builds
  let totalETH = 0;
  let daysProcessed = 0;
  let buildsProcessed = 0;
  
  for (const dayData of buyProcessData.dailyData) {
    if (dayData.buyAndBuildCount > 0) {
      console.log(`\n📅 Processing Day ${dayData.protocolDay} (${dayData.buyAndBuildCount} builds)`);
      daysProcessed++;
      
      // Fetch events for this specific day
      const filter = contract.filters.BuyAndBuild(null, dayData.protocolDay);
      
      try {
        // We need to fetch in chunks - find approximate block range for this day
        const dayStartBlock = 20085459 + (dayData.protocolDay - 1) * 7200; // ~7200 blocks per day
        const dayEndBlock = Math.min(dayStartBlock + 14400, currentBlock); // Search 2 days worth
        
        console.log(`  Searching blocks ${dayStartBlock} to ${dayEndBlock}`);
        
        const events = await fetchWithRetry(() => contract.queryFilter(filter, dayStartBlock, dayEndBlock));
        console.log(`  Found ${events.length} BuyAndBuild events`);
        
        let dayETHTotal = 0;
        const transactions = [];
        
        for (const event of events) {
          const ethValue = await getETHFromTransaction(event.transactionHash, provider);
          dayETHTotal += ethValue;
          buildsProcessed++;
          
          transactions.push({
            hash: event.transactionHash,
            eth: ethValue
          });
          
          console.log(`    ${event.transactionHash.substring(0, 10)}... : ${ethValue} ETH`);
        }
        
        // Update the day's data
        const oldValue = dayData.ethUsedForBuilds;
        dayData.ethUsedForBuilds = dayETHTotal;
        dayData.ethUsed = parseFloat((dayData.ethUsedForBurns + dayETHTotal).toFixed(18));
        
        totalETH += dayETHTotal;
        
        console.log(`  Day ${dayData.protocolDay} total: ${oldValue} → ${dayETHTotal} ETH`);
        
        // Save transaction details
        if (!dayData.buildTransactions) {
          dayData.buildTransactions = [];
        }
        dayData.buildTransactions = transactions;
        
      } catch (error) {
        console.error(`  ❌ Error processing day ${dayData.protocolDay}: ${error.message}`);
      }
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
  
  console.log('\n📊 Summary:');
  console.log('===========');
  console.log(`Days processed: ${daysProcessed}`);
  console.log(`Builds processed: ${buildsProcessed}`);
  console.log(`Total ETH from builds: ${totalETH.toFixed(18)} ETH`);
  
  console.log('\n✅ buy-process-data.json updated with exact on-chain values!');
  
  // Run validation
  console.log('\n🔍 Running validation...\n');
  execSync('node scripts/validate-no-duplicates.js', { stdio: 'inherit' });
}

main().catch(console.error);