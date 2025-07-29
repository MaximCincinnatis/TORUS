#!/usr/bin/env node

/**
 * Verify Day 19 Creates from Blockchain
 * Uses event logs and rotates RPCs as needed
 */

const { ethers } = require('ethers');

// Multiple RPC endpoints for rotation
const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.payload.de',
  'https://eth-mainnet.public.blastapi.io',
  'https://rpc.flashbots.net',
  'https://rpc.ankr.com/eth',
  'https://cloudflare-eth.com',
  'https://eth.meowrpc.com',
  'https://eth.rpc.blxrbdn.com'
];

let currentRpcIndex = 0;

async function getProvider() {
  for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
    const index = (currentRpcIndex + i) % RPC_ENDPOINTS.length;
    try {
      const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[index]);
      await provider.getBlockNumber();
      currentRpcIndex = (index + 1) % RPC_ENDPOINTS.length; // Rotate for next call
      return provider;
    } catch (e) {
      console.log(`❌ RPC ${RPC_ENDPOINTS[index]} failed: ${e.message}`);
    }
  }
  throw new Error('All RPC providers failed');
}

async function verifyDay19Creates() {
  console.log('🔍 Verifying Day 19 Creates from Blockchain\n');
  
  // Contract addresses
  const STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  const TITANX_CONTRACT = '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1';
  
  // Calculate Day 19 time range
  const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
  const day19Start = new Date(CONTRACT_START_DATE.getTime() + (19 - 1) * 24 * 60 * 60 * 1000);
  const day19End = new Date(day19Start.getTime() + 24 * 60 * 60 * 1000 - 1);
  const day19StartTimestamp = Math.floor(day19Start.getTime() / 1000);
  const day19EndTimestamp = Math.floor(day19End.getTime() / 1000);
  
  console.log(`📅 Day 19 Time Range:`);
  console.log(`  Start: ${day19Start.toISOString()} (${day19StartTimestamp})`);
  console.log(`  End: ${day19End.toISOString()} (${day19EndTimestamp})`);
  
  // Get provider
  let provider = await getProvider();
  const currentBlock = await provider.getBlockNumber();
  console.log(`\n📊 Current block: ${currentBlock}`);
  
  // Find approximate blocks for Day 19
  // Ethereum ~12 second block time
  const blocksPerDay = 7200;
  const daysSinceStart = 19;
  const deploymentBlock = 22890272;
  
  // Estimate Day 19 block range
  const estimatedDay19StartBlock = deploymentBlock + (daysSinceStart - 1) * blocksPerDay;
  const estimatedDay19EndBlock = estimatedDay19StartBlock + blocksPerDay;
  
  console.log(`\n📊 Estimated Day 19 blocks: ${estimatedDay19StartBlock} to ${estimatedDay19EndBlock}`);
  
  // Get actual blocks by timestamp
  console.log('\n🔍 Finding exact Day 19 blocks by timestamp...');
  
  // Binary search for start block
  let startBlock = estimatedDay19StartBlock - 1000;
  let endBlock = estimatedDay19StartBlock + 1000;
  let day19ActualStartBlock = 0;
  
  while (startBlock <= endBlock) {
    const midBlock = Math.floor((startBlock + endBlock) / 2);
    try {
      provider = await getProvider(); // Rotate RPC if needed
      const block = await provider.getBlock(midBlock);
      
      if (block.timestamp < day19StartTimestamp) {
        startBlock = midBlock + 1;
      } else {
        day19ActualStartBlock = midBlock;
        endBlock = midBlock - 1;
      }
    } catch (e) {
      console.log(`⚠️ Error getting block ${midBlock}, rotating RPC...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Binary search for end block
  startBlock = estimatedDay19EndBlock - 1000;
  endBlock = estimatedDay19EndBlock + 1000;
  let day19ActualEndBlock = 0;
  
  while (startBlock <= endBlock) {
    const midBlock = Math.floor((startBlock + endBlock) / 2);
    try {
      provider = await getProvider(); // Rotate RPC if needed
      const block = await provider.getBlock(midBlock);
      
      if (block.timestamp <= day19EndTimestamp) {
        day19ActualEndBlock = midBlock;
        startBlock = midBlock + 1;
      } else {
        endBlock = midBlock - 1;
      }
    } catch (e) {
      console.log(`⚠️ Error getting block ${midBlock}, rotating RPC...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`\n✅ Day 19 actual blocks: ${day19ActualStartBlock} to ${day19ActualEndBlock}`);
  
  // Now get all events in Day 19 range
  console.log('\n🔍 Fetching Day 19 events...');
  
  // We need to check for TitanX transfers to the stake contract as proxy for creates
  const titanxABI = ['event Transfer(address indexed from, address indexed to, uint256 value)'];
  const titanxContract = new ethers.Contract(TITANX_CONTRACT, titanxABI, provider);
  
  const allTransfers = [];
  const chunkSize = 1000;
  
  for (let start = day19ActualStartBlock; start <= day19ActualEndBlock; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, day19ActualEndBlock);
    console.log(`  Fetching blocks ${start} to ${end}...`);
    
    let retries = 3;
    while (retries > 0) {
      try {
        provider = await getProvider();
        const transfers = await provider.getLogs({
          address: TITANX_CONTRACT,
          topics: [
            ethers.utils.id('Transfer(address,address,uint256)'),
            null, // from (any)
            ethers.utils.hexZeroPad(STAKE_CONTRACT.toLowerCase(), 32) // to stake contract
          ],
          fromBlock: start,
          toBlock: end
        });
        
        allTransfers.push(...transfers);
        break;
      } catch (e) {
        retries--;
        if (retries === 0) {
          console.log(`  ❌ Failed to fetch blocks ${start}-${end}: ${e.message}`);
        } else {
          console.log(`  ⚠️ Retry ${3 - retries}/3 for blocks ${start}-${end}`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
  }
  
  console.log(`\n📊 Found ${allTransfers.length} TitanX transfers to stake contract on Day 19`);
  
  // Get transaction details to identify creates
  console.log('\n🔍 Analyzing transactions for create operations...');
  
  const creates = [];
  const processedTxs = new Set();
  
  for (const transfer of allTransfers) {
    if (processedTxs.has(transfer.transactionHash)) continue;
    processedTxs.add(transfer.transactionHash);
    
    try {
      provider = await getProvider();
      const tx = await provider.getTransaction(transfer.transactionHash);
      
      // Check if this is a create function call
      // createTorus(uint256,uint24) = 0x5c36b186
      if (tx.data.startsWith('0x5c36b186')) {
        const receipt = await provider.getTransactionReceipt(transfer.transactionHash);
        const block = await provider.getBlock(transfer.blockNumber);
        
        // Decode transfer amount
        const iface = new ethers.utils.Interface(titanxABI);
        const parsed = iface.parseLog(transfer);
        const amount = parsed.args.value;
        
        creates.push({
          txHash: transfer.transactionHash,
          block: transfer.blockNumber,
          from: tx.from,
          titanAmount: ethers.utils.formatEther(amount),
          timestamp: block.timestamp,
          date: new Date(block.timestamp * 1000).toISOString()
        });
        
        console.log(`  ✅ Found create: ${tx.from} - ${(parseFloat(ethers.utils.formatEther(amount)) / 1e9).toFixed(2)}B TitanX`);
      }
    } catch (e) {
      console.log(`  ⚠️ Error processing tx ${transfer.transactionHash}: ${e.message}`);
    }
  }
  
  // Final summary
  console.log('\n📊 DAY 19 CREATES SUMMARY:');
  console.log(`┌─────────────────────────────────────────┐`);
  console.log(`│          BLOCKCHAIN REALITY             │`);
  console.log(`├─────────────────────────────────────────┤`);
  console.log(`│ Total Creates: ${creates.length.toString().padStart(2, ' ')}                       │`);
  console.log(`└─────────────────────────────────────────┘`);
  
  if (creates.length > 0) {
    console.log('\n📝 Create Details:');
    creates.forEach((create, i) => {
      console.log(`\n${i + 1}. User: ${create.from}`);
      console.log(`   Amount: ${(parseFloat(create.titanAmount) / 1e9).toFixed(2)}B TitanX`);
      console.log(`   Time: ${create.date}`);
      console.log(`   Block: ${create.block}`);
      console.log(`   Tx: ${create.txHash}`);
    });
    
    const totalTitanX = creates.reduce((sum, c) => sum + parseFloat(c.titanAmount), 0);
    console.log(`\n📊 Total TitanX Used: ${(totalTitanX / 1e9).toFixed(2)} Billion`);
  }
  
  // Compare with expected JSON data
  const expectedCreates = 5;
  if (creates.length === expectedCreates) {
    console.log(`\n✅ CONFIRMED: Blockchain shows ${creates.length} creates, matching expected ${expectedCreates} creates`);
  } else {
    console.log(`\n⚠️ DISCREPANCY: Blockchain shows ${creates.length} creates, expected ${expectedCreates} creates`);
  }
}

verifyDay19Creates().catch(console.error);