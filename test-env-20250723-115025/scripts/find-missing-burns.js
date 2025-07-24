#!/usr/bin/env node

/**
 * Find the source of missing TORUS burns
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function findMissingBurns() {
  console.log('🔍 Finding missing TORUS burns...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    
    // Buy & Process contract ABI with all events
    const contractABI = [
      'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
      'event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)',
      'event FractalFundsReleased(uint256 releasedTitanX, uint256 releasedETH)',
      'function totalTorusBurnt() view returns (uint256)',
      'function burnTorus() public'
    ];
    
    const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, contractABI, provider);
    
    // Get total burnt from contract
    const totalBurnt = await contract.totalTorusBurnt();
    console.log(`Total TORUS burnt (from contract): ${ethers.utils.formatEther(totalBurnt)}\n`);
    
    // Check if there were any direct burnTorus() calls
    console.log('Checking for direct burnTorus() calls...');
    
    // Get the function selector for burnTorus()
    const iface = new ethers.utils.Interface(contractABI);
    const burnTorusSelector = iface.getSighash('burnTorus');
    console.log(`burnTorus() selector: ${burnTorusSelector}`);
    
    // Also check the contract deployment transaction
    const deployBlock = 22890272;
    const deployTx = await provider.getTransactionReceipt('0x7c87e2c12bce0b4c67fafca9f96e0ca6df0c087bccbc4eb9fae2bb3f8a9b5a7f'); // You'll need the actual deploy tx hash
    
    // Load our tracking data
    const dataPath = path.join(__dirname, '../public/data/buy-process-data.json');
    const buyProcessData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Calculate what we're tracking
    const trackedFromBuyAndBurn = buyProcessData.dailyData.reduce((sum, d) => sum + d.torusBurned, 0);
    console.log(`\nTracked from BuyAndBurn events: ${trackedFromBuyAndBurn.toFixed(6)} TORUS`);
    
    // The missing amount
    const missing = parseFloat(ethers.utils.formatEther(totalBurnt)) - trackedFromBuyAndBurn;
    console.log(`Missing: ${missing.toFixed(6)} TORUS`);
    
    // Theory: Check if the contract had an initial TORUS balance that was burned
    console.log('\nTheory 1: Initial TORUS balance burned at deployment or setup');
    console.log('Theory 2: Buy & Build operations burn more than just torusPurchased');
    console.log('Theory 3: There are other mechanisms triggering burnTorus()');
    
    // Let's check the BuyAndBuild events more carefully
    console.log('\nAnalyzing BuyAndBuild events...');
    
    const currentBlock = await provider.getBlockNumber();
    const buildEvents = [];
    const chunkSize = 5000;
    
    for (let start = deployBlock; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      try {
        const events = await contract.queryFilter(contract.filters.BuyAndBuild(), start, end);
        buildEvents.push(...events);
      } catch (e) {
        console.log(`Error fetching blocks ${start}-${end}, skipping...`);
      }
    }
    
    console.log(`Found ${buildEvents.length} BuyAndBuild events`);
    
    // The key insight: When BuyAndBuild is called, it:
    // 1. Purchases TORUS (amount tracked in torusPurchased)
    // 2. Adds liquidity
    // 3. Burns ALL remaining TORUS in the contract
    
    // This means if the contract accumulates TORUS from other sources,
    // BuyAndBuild will burn it all
    
    console.log('\nPossible sources of additional TORUS in the contract:');
    console.log('1. TORUS sent directly to the contract address');
    console.log('2. TORUS from liquidity operations');
    console.log('3. Initial funding');
    console.log('4. Fractal funds that include TORUS');
    
    // Check if we need to track the actual burn amounts per operation
    console.log('\nRecommendation:');
    console.log('To get accurate data, we need to:');
    console.log('1. Track the actual torusBurnt amount from each transaction');
    console.log('2. Check transaction logs for the burn amounts');
    console.log('3. Or track TORUS transfers TO the Buy & Process contract');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findMissingBurns().catch(console.error);