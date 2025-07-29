#!/usr/bin/env node

/**
 * Verify Day 19 Creates by Block Range
 * Uses the block numbers from our JSON data
 */

const { ethers } = require('ethers');

// Day 19 blocks from JSON (approximated)
const DAY19_BLOCKS = {
  start: 23019300,  // Slightly before first known create
  end: 23020200     // Slightly after last known create
};

async function getProvider() {
  const rpcs = [
    'https://eth.drpc.org',
    'https://ethereum.publicnode.com',
    'https://eth.llamarpc.com'
  ];
  
  for (const rpc of rpcs) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpc);
      await provider.getBlockNumber();
      console.log(`✅ Using ${rpc}`);
      return provider;
    } catch (e) {
      continue;
    }
  }
  throw new Error('No working RPC');
}

async function verifyDay19() {
  console.log('🔍 Verifying Day 19 Creates by Block Range\n');
  
  const provider = await getProvider();
  const TITANX = '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1';
  const STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  console.log(`📊 Searching blocks ${DAY19_BLOCKS.start} to ${DAY19_BLOCKS.end}`);
  
  // Get TitanX transfers to stake contract
  const filter = {
    address: TITANX,
    topics: [
      ethers.utils.id('Transfer(address,address,uint256)'),
      null,
      ethers.utils.hexZeroPad(STAKE_CONTRACT.toLowerCase(), 32)
    ],
    fromBlock: DAY19_BLOCKS.start,
    toBlock: DAY19_BLOCKS.end
  };
  
  console.log('\n🔍 Fetching TitanX transfers to stake contract...');
  
  try {
    const logs = await provider.getLogs(filter);
    console.log(`📊 Found ${logs.length} transfers\n`);
    
    // Day 19 timestamps
    const day19Start = 1753725600;
    const day19End = 1753811999;
    
    const day19Creates = [];
    
    // Check each transfer
    for (const log of logs) {
      try {
        const block = await provider.getBlock(log.blockNumber);
        
        if (block.timestamp >= day19Start && block.timestamp <= day19End) {
          // Decode the transfer
          const iface = new ethers.utils.Interface(['event Transfer(address indexed from, address indexed to, uint256 value)']);
          const decoded = iface.parseLog(log);
          
          const tx = await provider.getTransaction(log.transactionHash);
          
          // Check if it's a create function (0x5c36b186)
          if (tx.data.startsWith('0x5c36b186')) {
            day19Creates.push({
              from: decoded.args.from,
              amount: ethers.utils.formatEther(decoded.args.value),
              timestamp: block.timestamp,
              date: new Date(block.timestamp * 1000).toISOString(),
              block: log.blockNumber,
              txHash: log.transactionHash
            });
          }
        }
      } catch (e) {
        console.log(`⚠️ Error processing log: ${e.message}`);
      }
    }
    
    console.log(`\n📊 DAY 19 CREATES FOUND: ${day19Creates.length}\n`);
    
    if (day19Creates.length > 0) {
      day19Creates.forEach((create, i) => {
        console.log(`${i + 1}. User: ${create.from}`);
        console.log(`   Amount: ${(parseFloat(create.amount) / 1e9).toFixed(2)}B TitanX`);
        console.log(`   Time: ${create.date}`);
        console.log(`   Block: ${create.block}`);
        console.log(`   Tx: ${create.txHash}\n`);
      });
      
      const total = day19Creates.reduce((sum, c) => sum + parseFloat(c.amount), 0);
      console.log(`Total TitanX: ${(total / 1e9).toFixed(2)} Billion`);
    }
    
    // Verification
    if (day19Creates.length === 5) {
      console.log(`\n✅ CONFIRMED: Found ${day19Creates.length} creates on Day 19`);
    } else {
      console.log(`\n⚠️ Found ${day19Creates.length} creates, expected 5`);
    }
    
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
  }
}

verifyDay19().catch(console.error);