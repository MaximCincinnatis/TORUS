#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');

// Contract addresses
const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

// ABIs
const BUY_PROCESS_ABI = [
  'event BuyAndBuild(address indexed user, uint256 indexed day, uint256 titanXAmount, uint256 torusAmount)',
  'function totalEthUsedForBuilds() view returns (uint256)'
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
      } else {
        throw error;
      }
    }
  }
}

async function getExactETHValue(txHash, provider) {
  console.log(`  Fetching transaction ${txHash}...`);
  
  const tx = await fetchWithRetry(() => provider.getTransaction(txHash));
  const receipt = await fetchWithRetry(() => provider.getTransactionReceipt(txHash));
  
  if (!tx || !receipt) {
    throw new Error(`Transaction not found: ${txHash}`);
  }
  
  // First check direct ETH value
  let ethValue = ethers.utils.formatEther(tx.value);
  console.log(`    Direct ETH: ${ethValue} ETH`);
  
  // If no direct ETH, check for WETH deposit
  if (parseFloat(ethValue) === 0) {
    console.log(`    Checking for WETH deposits...`);
    
    const wethInterface = new ethers.utils.Interface(WETH_ABI);
    
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
        try {
          const parsed = wethInterface.parseLog(log);
          if (parsed.name === 'Deposit' && parsed.args.dst.toLowerCase() === BUY_PROCESS_CONTRACT.toLowerCase()) {
            const wethAmount = ethers.utils.formatEther(parsed.args.wad);
            console.log(`    Found WETH deposit: ${wethAmount} ETH`);
            ethValue = wethAmount;
            break;
          }
        } catch (e) {
          // Not a WETH deposit event
        }
      }
    }
  }
  
  return {
    txHash,
    ethValue: parseFloat(ethValue),
    blockNumber: receipt.blockNumber
  };
}

async function main() {
  console.log('🔍 Fetching EXACT ETH values from blockchain for all Buy & Build operations\n');
  
  const provider = getProvider();
  const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, BUY_PROCESS_ABI, provider);
  
  // Contract doesn't have totalEthUsedForBuilds function, we'll calculate from events
  console.log(`📊 Fetching all Buy & Build transaction data...\n`);
  
  // Get all BuyAndBuild events
  console.log('📥 Fetching all BuyAndBuild events...');
  
  // Get current block
  const currentBlock = await fetchWithRetry(() => provider.getBlockNumber());
  console.log(`Current block: ${currentBlock}`);
  
  const filter = contract.filters.BuyAndBuild();
  const events = await fetchWithRetry(() => contract.queryFilter(filter, 20085459, currentBlock));
  
  console.log(`Found ${events.length} BuyAndBuild events\n`);
  
  // Group events by day and get transaction details
  const dayData = {};
  let totalETH = 0;
  
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const day = Number(event.args.day);
    
    console.log(`\n📅 Processing event ${i + 1}/${events.length} - Day ${day}`);
    
    try {
      const txData = await getExactETHValue(event.transactionHash, provider);
      
      if (!dayData[day]) {
        dayData[day] = {
          transactions: [],
          totalETH: 0,
          count: 0
        };
      }
      
      dayData[day].transactions.push(txData);
      dayData[day].totalETH += txData.ethValue;
      dayData[day].count++;
      totalETH += txData.ethValue;
      
      console.log(`    ✅ Day ${day} - ETH: ${txData.ethValue}`);
    } catch (error) {
      console.error(`    ❌ Error processing event: ${error.message}`);
    }
  }
  
  // Summary
  console.log('\n📊 Summary by Day:');
  console.log('===================');
  
  const sortedDays = Object.keys(dayData).sort((a, b) => Number(a) - Number(b));
  
  for (const day of sortedDays) {
    const data = dayData[day];
    console.log(`Day ${day}: ${data.count} builds, ${data.totalETH.toFixed(18)} ETH`);
    
    // Show individual transactions
    data.transactions.forEach(tx => {
      console.log(`  - ${tx.txHash.substring(0, 10)}... : ${tx.ethValue} ETH`);
    });
  }
  
  console.log('\n📊 Totals:');
  console.log('===========');
  console.log(`Total ETH from events: ${totalETH.toFixed(18)} ETH`);
  
  // Save detailed results
  const results = {
    calculatedTotal: totalETH,
    dayData: dayData,
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync('exact-eth-values.json', JSON.stringify(results, null, 2));
  console.log('\n✅ Detailed results saved to exact-eth-values.json');
  
  // Now update the buy-process-data.json with exact values
  console.log('\n📝 Updating buy-process-data.json with exact values...');
  
  const buyProcessData = JSON.parse(fs.readFileSync('public/data/buy-process-data.json', 'utf8'));
  
  // Update each day with exact values
  for (const day of sortedDays) {
    const dayNum = parseInt(day);
    const exactData = dayData[day];
    const dayEntry = buyProcessData.dailyData.find(d => d.protocolDay === dayNum);
    
    if (dayEntry && dayEntry.buyAndBuildCount > 0) {
      const oldValue = dayEntry.ethUsedForBuilds;
      dayEntry.ethUsedForBuilds = exactData.totalETH;
      
      // Recalculate total ethUsed for the day
      dayEntry.ethUsed = parseFloat((dayEntry.ethUsedForBurns + exactData.totalETH).toFixed(18));
      
      console.log(`Day ${dayNum}: ${oldValue} → ${exactData.totalETH} ETH`);
    }
  }
  
  // Update total
  buyProcessData.totals.ethUsedForBuilds = totalETH.toFixed(18);
  
  // Recalculate total ETH
  let totalETHBurn = 0;
  buyProcessData.dailyData.forEach(day => {
    totalETHBurn += day.ethUsed || 0;
  });
  buyProcessData.totals.ethBurn = totalETHBurn.toFixed(18);
  
  // Save updated data
  fs.writeFileSync('public/data/buy-process-data.json', JSON.stringify(buyProcessData, null, 2));
  
  console.log('\n✅ buy-process-data.json updated with exact on-chain values!');
}

main().catch(console.error);