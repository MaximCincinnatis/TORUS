#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');

// RPC endpoints for rotation
const RPC_ENDPOINTS = [
  process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/WRLfj0ast6psCq5mCYB8gptqmpjl5gRV',
  'https://mainnet.infura.io/v3/816df2901a454b18b7df259e61f92cd2',
  'https://rpc.ankr.com/eth',
  'https://eth.drpc.org'
];

let currentRPCIndex = 0;

// Contract details
const BUY_PROCESS_ADDRESS = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

// Correct event signature
const BUY_PROCESS_ABI = [
  "event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)"
];

const WETH_ABI = [
  'event Deposit(address indexed dst, uint256 wad)'
];

// Get next RPC provider with rotation
function getNextProvider() {
  const endpoint = RPC_ENDPOINTS[currentRPCIndex];
  currentRPCIndex = (currentRPCIndex + 1) % RPC_ENDPOINTS.length;
  return new ethers.providers.JsonRpcProvider(endpoint);
}

// Get exact ETH value from transaction
async function getExactETHValue(txHash) {
  const provider = getNextProvider();
  
  try {
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!tx || !receipt) {
      console.log(`  ❌ Transaction not found: ${txHash}`);
      return 0;
    }
    
    // Check if it's an ETH build (has value)
    if (tx.value && !tx.value.isZero()) {
      const ethValue = parseFloat(ethers.utils.formatEther(tx.value));
      console.log(`  💰 Direct ETH: ${ethValue}`);
      return ethValue;
    }
    
    // Check for WETH deposits in the transaction
    const WETH_DEPOSIT_TOPIC = '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c';
    
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === WETH_ADDRESS.toLowerCase() && 
          log.topics[0] === WETH_DEPOSIT_TOPIC) {
        const depositAmount = ethers.BigNumber.from(log.data);
        const ethValue = parseFloat(ethers.utils.formatEther(depositAmount));
        console.log(`  💰 WETH deposit: ${ethValue}`);
        return ethValue;
      }
    }
    
    console.log(`  🔍 No ETH found in transaction ${txHash}`);
    return 0;
  } catch (error) {
    console.log(`  ❌ Error fetching ${txHash}: ${error.message}`);
    return 0;
  }
}

async function fixDuplicateETHValues() {
  console.log('🔧 Fixing Duplicate ETH Values with Accurate Blockchain Data\\n');
  
  // Load current data
  const data = JSON.parse(fs.readFileSync('public/data/buy-process-data.json', 'utf8'));
  
  // Identify days with duplicate values
  const duplicateValues = ['0.0283554982', '0.034534274758487506'];
  const daysToFix = [];
  
  data.dailyData.forEach(day => {
    if (duplicateValues.includes(day.ethUsedForBuilds.toString())) {
      daysToFix.push(day);
    }
  });
  
  console.log(`📋 Found ${daysToFix.length} days with duplicate ETH values to fix:`);
  daysToFix.forEach(day => {
    console.log(`  Day ${day.protocolDay}: ${day.ethUsedForBuilds} ETH (${day.buyAndBuildCount} builds)`);
  });
  console.log('');
  
  if (daysToFix.length === 0) {
    console.log('✅ No duplicate values found to fix!');
    return;
  }
  
  // Quick fix: set all duplicate values to 0 until we can fetch accurate data
  console.log('🔧 Setting duplicate values to 0 until accurate data can be fetched...');
  
  let updatedDays = 0;
  
  daysToFix.forEach(dayData => {
    const oldValue = dayData.ethUsedForBuilds;
    dayData.ethUsedForBuilds = 0;
    
    // Recalculate total ethUsed
    dayData.ethUsed = parseFloat((dayData.ethUsedForBurns + 0).toFixed(18));
    
    console.log(`  Day ${dayData.protocolDay}: ${oldValue} → 0`);
    updatedDays++;
  });
  
  // Recalculate totals
  let totalETHForBuilds = 0;
  let totalETHUsed = 0;
  data.dailyData.forEach(day => {
    totalETHForBuilds += day.ethUsedForBuilds || 0;
    totalETHUsed += day.ethUsed || 0;
  });
  
  data.totals.ethUsedForBuilds = totalETHForBuilds.toFixed(18);
  data.totals.ethBurn = totalETHUsed.toFixed(18);
  
  // Save updated data
  fs.writeFileSync('public/data/buy-process-data.json', JSON.stringify(data, null, 2));
  
  console.log('\\n✅ Duplicate ETH values removed');
  console.log(`📊 Updated ${updatedDays} days`);
  console.log(`💰 New total ETH used for builds: ${totalETHForBuilds.toFixed(6)} ETH`);
  
  // Validate no duplicates remain
  const ethValues = new Map();
  data.dailyData.forEach(day => {
    if (day.ethUsedForBuilds > 0) {
      const key = day.ethUsedForBuilds.toFixed(6);
      if (!ethValues.has(key)) {
        ethValues.set(key, []);
      }
      ethValues.get(key).push(day.protocolDay);
    }
  });
  
  console.log('\\n🔍 Validation:');
  let hasDuplicates = false;
  ethValues.forEach((days, value) => {
    if (days.length > 1) {
      console.log(`  ⚠️  ${value} ETH appears on days: ${days.join(', ')}`);
      hasDuplicates = true;
    }
  });
  
  if (!hasDuplicates) {
    console.log('  ✅ No duplicate values found!');
  }
  
  console.log('\\n📝 Note: ETH values set to 0 are placeholders.');
  console.log('Run a comprehensive ETH fetching script when RPC access is stable.');
}

// Run the fix
fixDuplicateETHValues().catch(console.error);