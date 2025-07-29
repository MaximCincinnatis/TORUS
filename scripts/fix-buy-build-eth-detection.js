#!/usr/bin/env node

/**
 * Fixes Buy & Build ETH detection by fetching exact values from blockchain
 * This script properly detects both direct ETH and WETH deposits
 */

const { ethers } = require('ethers');
const fs = require('fs');

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
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        throw error;
      }
    }
  }
}

async function getETHValueForBuild(txHash, provider) {
  console.log(`  Checking ${txHash.substring(0, 10)}...`);
  
  try {
    const tx = await fetchWithRetry(() => provider.getTransaction(txHash));
    const receipt = await fetchWithRetry(() => provider.getTransactionReceipt(txHash));
    
    if (!tx || !receipt) {
      console.log(`    ⚠️ Transaction not found`);
      return 0;
    }
    
    // First check direct ETH value
    let ethValue = parseFloat(ethers.utils.formatEther(tx.value));
    
    if (ethValue > 0) {
      console.log(`    ✅ Direct ETH: ${ethValue} ETH`);
      return ethValue;
    }
    
    // If no direct ETH, check for WETH deposit in the same transaction
    console.log(`    Checking for WETH deposits...`);
    const wethInterface = new ethers.utils.Interface(WETH_ABI);
    
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
        try {
          const parsed = wethInterface.parseLog(log);
          if (parsed.name === 'Deposit' && parsed.args.dst.toLowerCase() === BUY_PROCESS_CONTRACT.toLowerCase()) {
            ethValue = parseFloat(ethers.utils.formatEther(parsed.args.wad));
            console.log(`    ✅ WETH deposit: ${ethValue} ETH`);
            return ethValue;
          }
        } catch (e) {
          // Not a WETH deposit event
        }
      }
    }
    
    console.log(`    ⚠️ No ETH or WETH found - likely TitanX build`);
    return 0;
    
  } catch (error) {
    console.log(`    ❌ Error: ${error.message}`);
    return 0;
  }
}

async function main() {
  console.log('🔧 Fixing Buy & Build ETH Detection\n');
  
  const provider = getProvider();
  const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, BUY_PROCESS_ABI, provider);
  
  // Load existing data
  const buyProcessData = JSON.parse(fs.readFileSync('public/data/buy-process-data.json', 'utf8'));
  
  console.log('📥 Fetching all BuyAndBuild events...\n');
  
  // Process in chunks to avoid RPC limits
  const currentBlock = await fetchWithRetry(() => provider.getBlockNumber());
  const startBlock = 20085459; // Contract deployment
  const chunkSize = 1000;
  
  let allEvents = [];
  let totalETH = 0;
  const dayETHMap = new Map();
  
  for (let fromBlock = startBlock; fromBlock <= currentBlock; fromBlock += chunkSize) {
    const toBlock = Math.min(fromBlock + chunkSize - 1, currentBlock);
    
    try {
      console.log(`Fetching events from blocks ${fromBlock} to ${toBlock}...`);
      const filter = contract.filters.BuyAndBuild();
      const events = await fetchWithRetry(() => contract.queryFilter(filter, fromBlock, toBlock));
      
      if (events.length > 0) {
        console.log(`Found ${events.length} BuyAndBuild events`);
        
        for (const event of events) {
          const day = Number(event.args.day);
          const ethValue = await getETHValueForBuild(event.transactionHash, provider);
          
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
              eth: ethValue
            });
            
            totalETH += ethValue;
          }
        }
      }
    } catch (error) {
      console.log(`Error fetching events: ${error.message}`);
    }
  }
  
  console.log('\n📊 ETH Build Summary by Day:');
  console.log('============================');
  
  // Update the JSON with exact values
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
      
      // Show individual transactions
      data.transactions.forEach(tx => {
        console.log(`  - ${tx.hash.substring(0, 10)}... : ${tx.eth} ETH`);
      });
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
  
  console.log('\n📊 Final Totals:');
  console.log('================');
  console.log(`Total ETH used for builds: ${totalETH.toFixed(18)} ETH`);
  console.log(`Total ETH burn: ${totalETHBurn.toFixed(18)} ETH`);
  
  // Save updated data
  fs.writeFileSync('public/data/buy-process-data.json', JSON.stringify(buyProcessData, null, 2));
  
  console.log('\n✅ buy-process-data.json updated with exact ETH values!');
  
  // Run validation
  console.log('\n🔍 Running validation...\n');
  require('child_process').execSync('node scripts/validate-no-duplicates.js', { stdio: 'inherit' });
}

main().catch(console.error);