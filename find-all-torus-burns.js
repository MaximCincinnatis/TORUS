const { ethers } = require('ethers');
require('dotenv').config();

async function findAllTorusBurns() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL || 'https://eth.drpc.org');
  
  const TORUS_TOKEN = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  
  console.log('=== FINDING ALL TORUS BURNS (FROM ANY SOURCE) ===\n');
  
  // Load our data
  const buyProcessData = require('./public/data/buy-process-data.json');
  console.log(`Our data shows total burned: ${buyProcessData.totals.torusBurnt} TORUS\n`);
  
  const transferEventSig = ethers.utils.id('Transfer(address,address,uint256)');
  
  // Get ALL burns to 0x0 from contract deployment
  const deployBlock = 22890000; // Around contract deployment
  const currentBlock = await provider.getBlockNumber();
  const chunkSize = 5000;
  
  console.log('Fetching ALL TORUS burns to 0x0 from any address...\n');
  
  let totalBurnedFromAll = ethers.BigNumber.from(0);
  let totalBurnedFromBuyProcess = ethers.BigNumber.from(0);
  let totalBurnedFromOthers = ethers.BigNumber.from(0);
  
  const burnsBySource = {};
  
  for (let from = deployBlock; from <= currentBlock; from += chunkSize) {
    const to = Math.min(from + chunkSize - 1, currentBlock);
    
    // Get ALL transfers to 0x0
    const filter = {
      address: TORUS_TOKEN,
      topics: [
        transferEventSig,
        null, // from ANY address
        ethers.utils.hexZeroPad(ZERO_ADDRESS, 32) // to 0x0
      ],
      fromBlock: from,
      toBlock: to
    };
    
    try {
      const logs = await provider.getLogs(filter);
      
      for (const log of logs) {
        const fromAddress = ethers.utils.getAddress('0x' + log.topics[1].slice(26));
        const amount = ethers.BigNumber.from(log.data);
        
        totalBurnedFromAll = totalBurnedFromAll.add(amount);
        
        if (!burnsBySource[fromAddress]) {
          burnsBySource[fromAddress] = {
            amount: ethers.BigNumber.from(0),
            count: 0,
            txs: []
          };
        }
        
        burnsBySource[fromAddress].amount = burnsBySource[fromAddress].amount.add(amount);
        burnsBySource[fromAddress].count++;
        
        // Keep first few tx hashes for reference
        if (burnsBySource[fromAddress].txs.length < 3) {
          burnsBySource[fromAddress].txs.push(log.transactionHash);
        }
        
        if (fromAddress.toLowerCase() === BUY_PROCESS_CONTRACT.toLowerCase()) {
          totalBurnedFromBuyProcess = totalBurnedFromBuyProcess.add(amount);
        } else {
          totalBurnedFromOthers = totalBurnedFromOthers.add(amount);
        }
      }
      
      if (logs.length > 0) {
        console.log(`Blocks ${from}-${to}: Found ${logs.length} burns`);
      }
    } catch (e) {
      console.log(`Error fetching blocks ${from}-${to}, skipping...`);
    }
  }
  
  console.log('\n=== BURN SOURCES ===');
  
  // Sort by amount burned
  const sortedSources = Object.entries(burnsBySource)
    .sort((a, b) => b[1].amount.sub(a[1].amount).isNegative() ? -1 : 1);
  
  for (const [address, data] of sortedSources) {
    const amount = parseFloat(ethers.utils.formatEther(data.amount));
    if (amount > 0.01) { // Only show significant burns
      console.log(`\n${address}:`);
      console.log(`  Amount: ${amount.toFixed(6)} TORUS`);
      console.log(`  Burns: ${data.count}`);
      console.log(`  Sample txs: ${data.txs.slice(0, 2).join(', ')}`);
      
      if (address.toLowerCase() === BUY_PROCESS_CONTRACT.toLowerCase()) {
        console.log(`  ✅ This is the Buy & Process contract (tracked)`);
      } else {
        console.log(`  ❌ This is NOT tracked in our data!`);
      }
    }
  }
  
  console.log('\n=== TOTALS ===');
  console.log(`Total TORUS burned (all sources): ${ethers.utils.formatEther(totalBurnedFromAll)} TORUS`);
  console.log(`From Buy & Process contract: ${ethers.utils.formatEther(totalBurnedFromBuyProcess)} TORUS`);
  console.log(`From other sources: ${ethers.utils.formatEther(totalBurnedFromOthers)} TORUS`);
  console.log(`\nOur data shows: ${buyProcessData.totals.torusBurnt} TORUS`);
  
  const ourTotal = parseFloat(buyProcessData.totals.torusBurnt);
  const actualBuyProcessTotal = parseFloat(ethers.utils.formatEther(totalBurnedFromBuyProcess));
  const actualAllSourcesTotal = parseFloat(ethers.utils.formatEther(totalBurnedFromAll));
  
  console.log('\n=== ANALYSIS ===');
  console.log(`Buy & Process burns match: ${Math.abs(ourTotal - actualBuyProcessTotal) < 0.01 ? '✅ YES' : '❌ NO'}`);
  console.log(`Missing from other sources: ${ethers.utils.formatEther(totalBurnedFromOthers)} TORUS`);
  console.log(`Total missing: ${(actualAllSourcesTotal - ourTotal).toFixed(6)} TORUS`);
  
  // Check if there are any direct burns (users sending to 0x0)
  const directBurns = sortedSources.filter(([addr, _]) => 
    addr.toLowerCase() !== BUY_PROCESS_CONTRACT.toLowerCase()
  );
  
  if (directBurns.length > 0) {
    console.log('\n⚠️  IMPORTANT: There are burns from sources other than Buy & Process!');
    console.log('These are NOT tracked in our dashboard data.');
    console.log('They could be:');
    console.log('- Manual burns by users sending TORUS to 0x0');
    console.log('- Burns from other contracts');
    console.log('- Team/protocol burns');
  }
}

findAllTorusBurns().catch(console.error);