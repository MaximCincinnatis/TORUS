#!/usr/bin/env node

/**
 * Verify we're tracking from the actual contract deployment
 */

const { ethers } = require('ethers');

const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function verifyTrackingStart() {
  console.log('🔍 Verifying tracking start block...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    const TORUS_CONTRACT = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
    
    // We've been using block 22890272 as deployment block
    console.log(`We've been tracking from block: 22890272`);
    
    // Let's find the actual deployment block by checking when the contract first had code
    console.log(`\nSearching for actual deployment block...`);
    
    // Binary search for deployment block
    let low = 22880000;  // Start searching from before our assumed block
    let high = 22890272;
    let deploymentBlock = high;
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      
      try {
        const code = await provider.getCode(BUY_PROCESS_CONTRACT, mid);
        
        if (code !== '0x') {
          // Contract exists at this block
          deploymentBlock = mid;
          high = mid - 1;
        } else {
          // Contract doesn't exist yet
          low = mid + 1;
        }
      } catch (error) {
        // Block might not exist
        low = mid + 1;
      }
    }
    
    console.log(`\nActual deployment block: ${deploymentBlock}`);
    
    if (deploymentBlock < 22890272) {
      console.log(`\n⚠️  We've been missing blocks ${deploymentBlock} to 22890271!`);
      console.log(`This could explain the missing burns.`);
      
      // Check for early burns
      console.log(`\nChecking for burns in missed blocks...`);
      
      const torusABI = [
        'event Transfer(address indexed from, address indexed to, uint256 value)'
      ];
      
      const torusContract = new ethers.Contract(TORUS_CONTRACT, torusABI, provider);
      
      // Get burn transfers in the missed range
      const missedBurns = [];
      const chunkSize = 1000;
      
      for (let start = deploymentBlock; start < 22890272; start += chunkSize) {
        const end = Math.min(start + chunkSize - 1, 22890271);
        console.log(`Checking blocks ${start}-${end}...`);
        
        try {
          const filter = torusContract.filters.Transfer(
            BUY_PROCESS_CONTRACT,
            '0x0000000000000000000000000000000000000000'
          );
          const events = await torusContract.queryFilter(filter, start, end);
          missedBurns.push(...events);
        } catch (e) {
          console.log(`Error checking blocks ${start}-${end}`);
        }
      }
      
      console.log(`\nFound ${missedBurns.length} burns in missed blocks`);
      
      if (missedBurns.length > 0) {
        let totalMissed = ethers.BigNumber.from(0);
        for (const event of missedBurns) {
          totalMissed = totalMissed.add(event.args.value);
        }
        console.log(`Total TORUS burned in missed blocks: ${ethers.utils.formatEther(totalMissed)}`);
        
        // This should explain our 947 TORUS discrepancy!
        console.log(`\n✨ This could explain the ${ethers.utils.formatEther(totalMissed)} TORUS discrepancy!`);
      }
      
    } else if (deploymentBlock > 22890272) {
      console.log(`\n✅ We've been tracking from before deployment (block ${deploymentBlock})`);
    } else {
      console.log(`\n✅ We've been tracking from the correct deployment block`);
    }
    
    // Also check the transaction count to see first activity
    console.log(`\nChecking first transaction...`);
    const txCount = await provider.getTransactionCount(BUY_PROCESS_CONTRACT);
    console.log(`Contract has made ${txCount} transactions`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyTrackingStart().catch(console.error);