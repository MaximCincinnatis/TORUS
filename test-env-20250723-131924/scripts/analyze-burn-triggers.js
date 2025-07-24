#!/usr/bin/env node

/**
 * Analyze what triggers pending TORUS burns
 */

const { ethers } = require('ethers');

const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function analyzeBurnTriggers() {
  console.log('🔍 Analyzing burn triggers...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    
    // Contract ABI with all relevant functions
    const contractABI = [
      'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
      'event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)',
      'event TorusBurned(uint256 amount)',
      'function burnTorus() public',
      'function swapTitanXForTorusAndBurn(uint256 titanXAmount) public',
      'function swapETHForTorusAndBurn() public payable',
      'function swapTitanXForTorusAndBuild(uint256 titanXAmount) public',
      'function swapETHForTorusAndBuild() public payable'
    ];
    
    const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, contractABI, provider);
    
    // Get the function selectors
    const iface = new ethers.utils.Interface(contractABI);
    const burnTorusSelector = iface.getSighash('burnTorus');
    const swapTitanXBurnSelector = iface.getSighash('swapTitanXForTorusAndBurn');
    const swapETHBurnSelector = iface.getSighash('swapETHForTorusAndBurn');
    const swapTitanXBuildSelector = iface.getSighash('swapTitanXForTorusAndBuild');
    const swapETHBuildSelector = iface.getSighash('swapETHForTorusAndBuild');
    
    console.log('Function selectors:');
    console.log(`- burnTorus(): ${burnTorusSelector}`);
    console.log(`- swapTitanXForTorusAndBurn(): ${swapTitanXBurnSelector}`);
    console.log(`- swapETHForTorusAndBurn(): ${swapETHBurnSelector}`);
    console.log(`- swapTitanXForTorusAndBuild(): ${swapTitanXBuildSelector}`);
    console.log(`- swapETHForTorusAndBuild(): ${swapETHBuildSelector}\n`);
    
    // Fetch TorusBurned events to see when burns actually happen
    const deployBlock = 22890272;
    const currentBlock = await provider.getBlockNumber();
    
    console.log('Fetching TorusBurned events...');
    
    const burnEvents = [];
    const chunkSize = 5000;
    
    for (let start = deployBlock; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      
      try {
        const events = await contract.queryFilter(contract.filters.TorusBurned(), start, end);
        burnEvents.push(...events);
      } catch (e) {
        // Event might not exist
      }
    }
    
    console.log(`Found ${burnEvents.length} TorusBurned events\n`);
    
    if (burnEvents.length === 0) {
      console.log('No TorusBurned events found. Checking transactions that call burnTorus()...\n');
      
      // Look for transactions that call burnTorus
      console.log('Fetching recent transactions to the contract...');
      
      // Sample a few recent blocks
      const recentBlocks = [];
      for (let i = 0; i < 100; i += 10) {
        const blockNum = currentBlock - i;
        try {
          const block = await provider.getBlockWithTransactions(blockNum);
          recentBlocks.push(block);
        } catch (e) {
          // Skip
        }
      }
      
      console.log(`Checking ${recentBlocks.length} recent blocks for burnTorus calls...`);
      
      const burnCalls = [];
      for (const block of recentBlocks) {
        for (const tx of block.transactions) {
          if (tx.to && tx.to.toLowerCase() === BUY_PROCESS_CONTRACT.toLowerCase()) {
            if (tx.data.startsWith(burnTorusSelector)) {
              burnCalls.push({
                hash: tx.hash,
                from: tx.from,
                block: block.number,
                timestamp: new Date(block.timestamp * 1000).toISOString()
              });
            }
          }
        }
      }
      
      console.log(`Found ${burnCalls.length} direct burnTorus() calls in recent blocks`);
      
      if (burnCalls.length > 0) {
        console.log('\nRecent burnTorus() calls:');
        burnCalls.forEach(call => {
          console.log(`- ${call.timestamp}: from ${call.from} (tx: ${call.hash})`);
        });
      }
    }
    
    console.log('\n\nAnalysis of burn mechanism:');
    console.log('================================');
    console.log('Based on the contract code, burnTorus() is called:');
    console.log('1. At the end of swapTitanXForTorusAndBurn()');
    console.log('2. At the end of swapETHForTorusAndBurn()');
    console.log('3. At the end of swapTitanXForTorusAndBuild()');
    console.log('4. At the end of swapETHForTorusAndBuild()');
    console.log('5. Can be called directly by anyone (it\'s a public function)');
    console.log('\nThe "pending" burns occur when:');
    console.log('- totalTorusBurnt is incremented but the burn() call fails');
    console.log('- Or there\'s a timing delay between incrementing and burning');
    console.log('\nTo trigger pending burns:');
    console.log('- Anyone can call burnTorus() directly to burn accumulated TORUS');
    console.log('- The next Buy & Burn or Buy & Build operation will also trigger it');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

analyzeBurnTriggers().catch(console.error);