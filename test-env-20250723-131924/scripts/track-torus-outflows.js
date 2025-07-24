#!/usr/bin/env node

/**
 * Track all TORUS transfers FROM the Buy & Process contract
 */

const { ethers } = require('ethers');

const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function trackTorusOutflows() {
  console.log('🔍 Tracking TORUS transfers FROM Buy & Process contract...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    const TORUS_CONTRACT = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
    
    // TORUS token ABI
    const torusABI = [
      'event Transfer(address indexed from, address indexed to, uint256 value)'
    ];
    
    const torusContract = new ethers.Contract(TORUS_CONTRACT, torusABI, provider);
    
    // Fetch all transfers FROM the Buy & Process contract
    const deployBlock = 22890272;
    const currentBlock = await provider.getBlockNumber();
    
    console.log('Fetching all TORUS transfers from Buy & Process contract...');
    
    const allTransfers = [];
    const chunkSize = 5000;
    
    for (let start = deployBlock; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      console.log(`Scanning blocks ${start}-${end}...`);
      
      try {
        // Get all Transfer events where 'from' is the Buy & Process contract
        const filter = torusContract.filters.Transfer(BUY_PROCESS_CONTRACT, null);
        const events = await torusContract.queryFilter(filter, start, end);
        allTransfers.push(...events);
      } catch (e) {
        console.log(`Error fetching blocks ${start}-${end}, skipping...`);
      }
    }
    
    console.log(`\nFound ${allTransfers.length} TORUS transfers from Buy & Process\n`);
    
    // Analyze transfers by destination
    const transfersByDestination = {};
    let totalTransferred = ethers.BigNumber.from(0);
    
    for (const event of allTransfers) {
      const to = event.args.to;
      const amount = event.args.value;
      
      if (!transfersByDestination[to]) {
        transfersByDestination[to] = {
          count: 0,
          totalAmount: ethers.BigNumber.from(0),
          transfers: []
        };
      }
      
      transfersByDestination[to].count++;
      transfersByDestination[to].totalAmount = transfersByDestination[to].totalAmount.add(amount);
      transfersByDestination[to].transfers.push({
        txHash: event.transactionHash,
        block: event.blockNumber,
        amount: ethers.utils.formatEther(amount)
      });
      
      totalTransferred = totalTransferred.add(amount);
    }
    
    // Display results
    console.log('TORUS Transfers by Destination:');
    console.log('===============================');
    
    Object.entries(transfersByDestination).forEach(([address, data]) => {
      console.log(`\nTo: ${address}`);
      console.log(`  Transfers: ${data.count}`);
      console.log(`  Total: ${ethers.utils.formatEther(data.totalAmount)} TORUS`);
      
      // Show first few transfers
      data.transfers.slice(0, 3).forEach((tx, i) => {
        console.log(`    ${i + 1}. ${tx.amount} TORUS (tx: ${tx.txHash.substring(0, 10)}...)`);
      });
      if (data.transfers.length > 3) {
        console.log(`    ... and ${data.transfers.length - 3} more transfers`);
      }
    });
    
    console.log(`\n\nTotal TORUS transferred from Buy & Process: ${ethers.utils.formatEther(totalTransferred)}`);
    
    // Check for burns (transfers to zero address)
    const burnsToZeroAddress = transfersByDestination['0x0000000000000000000000000000000000000000'];
    if (burnsToZeroAddress) {
      console.log(`\nBurns (transfers to zero address): ${ethers.utils.formatEther(burnsToZeroAddress.totalAmount)} TORUS`);
    }
    
    // Summary
    console.log('\nSummary:');
    console.log('========');
    console.log(`Total received: 21302.82 TORUS`);
    console.log(`Total transferred out: ${ethers.utils.formatEther(totalTransferred)} TORUS`);
    console.log(`Expected remaining: ${ethers.utils.formatEther(ethers.utils.parseEther('21302.818505239552907038').sub(totalTransferred))} TORUS`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

trackTorusOutflows().catch(console.error);