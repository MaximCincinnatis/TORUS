#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');

// RPC endpoints
const RPC_ENDPOINTS = [
  'https://eth-mainnet.g.alchemy.com/v2/WRLfj0ast6psCq5mCYB8gptqmpjl5gRV',
  'https://mainnet.infura.io/v3/816df2901a454b18b7df259e61f92cd2',
  'https://rpc.ankr.com/eth',
  'https://eth.drpc.org'
];

const BUY_PROCESS_ADDRESS = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

// Correct BuyAndBuild event signature
const BUY_PROCESS_ABI = [
  "event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)"
];

async function verifyDay17() {
  console.log('🔍 Verifying Day 17 ETH Value (0.6906854951 ETH)\n');
  
  const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
  const contract = new ethers.Contract(BUY_PROCESS_ADDRESS, BUY_PROCESS_ABI, provider);
  
  // Day 17 is July 27, 2025
  // Protocol days start at 18:00 UTC
  const day17Start = new Date('2025-07-27T18:00:00Z').getTime() / 1000;
  const day17End = new Date('2025-07-28T18:00:00Z').getTime() / 1000;
  
  console.log(`Day 17 Time Range: ${new Date(day17Start * 1000).toISOString()} to ${new Date(day17End * 1000).toISOString()}`);
  console.log('\nFetching BuyAndBuild events...');
  
  // Estimate block range
  const START_BLOCK = 22890000;
  const BLOCKS_PER_DAY = 7200;
  const fromBlock = START_BLOCK + (16 * BLOCKS_PER_DAY);
  const toBlock = START_BLOCK + (17 * BLOCKS_PER_DAY);
  
  try {
    const events = await contract.queryFilter(contract.filters.BuyAndBuild(), fromBlock, toBlock);
    console.log(`Found ${events.length} BuyAndBuild events in block range\n`);
    
    // Filter events for Day 17
    let day17Events = [];
    let totalETH = 0;
    let ethBuilds = 0;
    
    for (const event of events) {
      const block = await provider.getBlock(event.blockNumber);
      if (block.timestamp >= day17Start && block.timestamp < day17End) {
        day17Events.push(event);
        
        // Check if this is an ETH build
        const tx = await provider.getTransaction(event.transactionHash);
        const functionSelector = tx.data.slice(0, 10);
        
        if (functionSelector === '0x53ad9b96') { // buyAndBuildWithETH
          ethBuilds++;
          
          // Check transaction value
          if (tx.value && !tx.value.isZero()) {
            const ethAmount = parseFloat(ethers.utils.formatEther(tx.value));
            totalETH += ethAmount;
            console.log(`ETH Build ${ethBuilds}: ${event.transactionHash}`);
            console.log(`  Direct ETH: ${ethAmount} ETH`);
          } else {
            // Check for WETH deposits
            const receipt = await provider.getTransactionReceipt(event.transactionHash);
            const WETH_DEPOSIT_TOPIC = '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c';
            
            let wethAmount = 0;
            for (const log of receipt.logs) {
              if (log.address.toLowerCase() === WETH_ADDRESS.toLowerCase() && 
                  log.topics[0] === WETH_DEPOSIT_TOPIC) {
                const depositAmount = ethers.BigNumber.from(log.data);
                wethAmount = parseFloat(ethers.utils.formatEther(depositAmount));
                break;
              }
            }
            
            if (wethAmount > 0) {
              totalETH += wethAmount;
              console.log(`ETH Build ${ethBuilds}: ${event.transactionHash}`);
              console.log(`  WETH deposit: ${wethAmount} ETH`);
            }
          }
        }
      }
    }
    
    console.log(`\n📊 Day 17 Summary:`);
    console.log(`Total BuyAndBuild events on Day 17: ${day17Events.length}`);
    console.log(`ETH builds: ${ethBuilds}`);
    console.log(`Total ETH used: ${totalETH.toFixed(10)} ETH`);
    console.log(`\nCurrent JSON value: 0.6906854951 ETH`);
    console.log(`Verification: ${Math.abs(totalETH - 0.6906854951) < 0.0000001 ? '✅ MATCHES' : '❌ MISMATCH'}`);
    
    // If close to 0.034534... check if it's being multiplied
    const singleBuildAmount = 0.034534274758487506;
    const possibleMultiple = totalETH / singleBuildAmount;
    console.log(`\nIf this is ${singleBuildAmount} ETH × builds: ${possibleMultiple.toFixed(2)} builds`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run verification
verifyDay17().catch(console.error);