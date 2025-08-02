#!/usr/bin/env node

/**
 * Query distributeETHForBuilding transactions during protocol days 19-21
 * This will help identify if we're missing ETH build data
 */

const { ethers } = require('ethers');

async function queryDistributeETHForBuilding() {
  console.log('🔍 Querying distributeETHForBuilding transactions for protocol days 19-21...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  // Contract start: July 10, 2025 at 18:00 UTC
  const CONTRACT_START = Math.floor(new Date('2025-07-10T18:00:00Z').getTime() / 1000);
  
  // Calculate day boundaries
  const day19Start = CONTRACT_START + (18 * 24 * 60 * 60); // July 28 6PM UTC
  const day19End = CONTRACT_START + (19 * 24 * 60 * 60);   // July 29 6PM UTC
  const day20Start = day19End;                              // July 29 6PM UTC
  const day20End = CONTRACT_START + (20 * 24 * 60 * 60);   // July 30 6PM UTC
  const day21Start = day20End;                              // July 30 6PM UTC
  const day21End = CONTRACT_START + (21 * 24 * 60 * 60);   // July 31 6PM UTC
  
  console.log('Protocol Day Boundaries:');
  console.log(`Day 19: ${new Date(day19Start * 1000).toISOString()} - ${new Date(day19End * 1000).toISOString()}`);
  console.log(`Day 20: ${new Date(day20Start * 1000).toISOString()} - ${new Date(day20End * 1000).toISOString()}`);
  console.log(`Day 21: ${new Date(day21Start * 1000).toISOString()} - ${new Date(day21End * 1000).toISOString()}\n`);
  
  // Get block numbers for the time range
  async function getBlockForTimestamp(timestamp) {
    let low = 22890272; // Contract deployment block
    let high = await provider.getBlockNumber();
    
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const block = await provider.getBlock(mid);
      
      if (block.timestamp < timestamp) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  }
  
  const startBlock = await getBlockForTimestamp(day19Start);
  const endBlock = await getBlockForTimestamp(day21End);
  
  console.log(`Searching blocks ${startBlock} to ${endBlock}...\n`);
  
  // Function selector for distributeETHForBuilding()
  const DISTRIBUTE_ETH_SELECTOR = '0xc381da4f';
  
  // Track results by day
  const dayResults = {
    19: { transactions: [], totalETH: ethers.BigNumber.from(0) },
    20: { transactions: [], totalETH: ethers.BigNumber.from(0) },
    21: { transactions: [], totalETH: ethers.BigNumber.from(0) }
  };
  
  // Search for transactions in chunks
  const chunkSize = 2000;
  let totalTransactions = 0;
  
  for (let currentBlock = startBlock; currentBlock <= endBlock; currentBlock += chunkSize) {
    const toBlock = Math.min(currentBlock + chunkSize - 1, endBlock);
    process.stdout.write(`\rSearching blocks ${currentBlock} to ${toBlock}...`);
    
    try {
      // Get all transactions to the Buy & Process contract
      const filter = {
        address: BUY_PROCESS_CONTRACT,
        fromBlock: currentBlock,
        toBlock: toBlock
      };
      
      const logs = await provider.getLogs(filter);
      
      // Check each log's transaction
      for (const log of logs) {
        const tx = await provider.getTransaction(log.transactionHash);
        
        // Check if this is a distributeETHForBuilding call
        if (tx.data && tx.data.startsWith(DISTRIBUTE_ETH_SELECTOR)) {
          totalTransactions++;
          const receipt = await provider.getTransactionReceipt(tx.hash);
          const block = await provider.getBlock(tx.blockNumber);
          
          // Determine which protocol day this belongs to
          let protocolDay;
          if (block.timestamp >= day19Start && block.timestamp < day19End) {
            protocolDay = 19;
          } else if (block.timestamp >= day20Start && block.timestamp < day20End) {
            protocolDay = 20;
          } else if (block.timestamp >= day21Start && block.timestamp < day21End) {
            protocolDay = 21;
          } else {
            continue; // Skip if outside our target days
          }
          
          // Get the ETH value transferred
          let ethTransferred = ethers.BigNumber.from(0);
          
          // Check internal transactions (ETH transfers)
          // Note: This requires trace data which standard RPC might not provide
          // We'll check for ETH value in the transaction itself
          if (tx.value && tx.value.gt(0)) {
            ethTransferred = tx.value;
          }
          
          // Also check logs for any ETH transfer events
          const ethTransferTopic = ethers.utils.id('Transfer(address,address,uint256)');
          const ethTransfers = receipt.logs.filter(log => 
            log.address.toLowerCase() === BUY_PROCESS_CONTRACT.toLowerCase() &&
            log.topics[0] === ethTransferTopic
          );
          
          const txInfo = {
            hash: tx.hash,
            from: tx.from,
            blockNumber: tx.blockNumber,
            timestamp: block.timestamp,
            date: new Date(block.timestamp * 1000).toISOString(),
            ethValue: ethers.utils.formatEther(ethTransferred),
            gasUsed: receipt.gasUsed.toString(),
            status: receipt.status
          };
          
          dayResults[protocolDay].transactions.push(txInfo);
          dayResults[protocolDay].totalETH = dayResults[protocolDay].totalETH.add(ethTransferred);
        }
      }
    } catch (error) {
      console.error(`\nError processing blocks ${currentBlock}-${toBlock}:`, error.message);
    }
  }
  
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 RESULTS: distributeETHForBuilding Transactions');
  console.log('='.repeat(80));
  
  // Display results for each day
  for (const day of [19, 20, 21]) {
    const results = dayResults[day];
    console.log(`\n📅 Protocol Day ${day}:`);
    console.log(`Total transactions: ${results.transactions.length}`);
    console.log(`Total ETH distributed: ${ethers.utils.formatEther(results.totalETH)} ETH`);
    
    if (results.transactions.length > 0) {
      console.log('\nTransaction Details:');
      results.transactions.forEach((tx, index) => {
        console.log(`\n  ${index + 1}. Transaction: ${tx.hash}`);
        console.log(`     From: ${tx.from}`);
        console.log(`     Block: ${tx.blockNumber}`);
        console.log(`     Time: ${tx.date}`);
        console.log(`     ETH Value: ${tx.ethValue} ETH`);
        console.log(`     Status: ${tx.status ? 'Success' : 'Failed'}`);
      });
    }
  }
  
  // Summary
  const totalETH = dayResults[19].totalETH
    .add(dayResults[20].totalETH)
    .add(dayResults[21].totalETH);
  
  console.log('\n' + '='.repeat(80));
  console.log('📈 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total distributeETHForBuilding transactions: ${totalTransactions}`);
  console.log(`Total ETH distributed: ${ethers.utils.formatEther(totalETH)} ETH`);
  console.log('\nBreakdown by day:');
  console.log(`  Day 19: ${dayResults[19].transactions.length} txs, ${ethers.utils.formatEther(dayResults[19].totalETH)} ETH`);
  console.log(`  Day 20: ${dayResults[20].transactions.length} txs, ${ethers.utils.formatEther(dayResults[20].totalETH)} ETH`);
  console.log(`  Day 21: ${dayResults[21].transactions.length} txs, ${ethers.utils.formatEther(dayResults[21].totalETH)} ETH`);
  
  // Additional analysis: Check if these transactions happened before BuyAndBuild events
  console.log('\n' + '='.repeat(80));
  console.log('💡 ANALYSIS NOTES');
  console.log('='.repeat(80));
  console.log('\n1. The distributeETHForBuilding function is called on the Buy & Process contract');
  console.log('2. This function likely receives ETH from the Create & Stake contract');
  console.log('3. The ETH is then available for BuyAndBuild operations');
  console.log('4. If we found transactions here, it confirms ETH was distributed for building');
  console.log('5. We should cross-reference these with BuyAndBuild events to ensure proper tracking');
}

queryDistributeETHForBuilding().catch(console.error);