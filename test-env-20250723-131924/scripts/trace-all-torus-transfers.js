#!/usr/bin/env node

/**
 * Trace all TORUS transfers in and out of Buy & Process contract
 */

const { ethers } = require('ethers');

const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function traceAllTorusTransfers() {
  console.log('🔍 Tracing all TORUS transfers for Buy & Process contract...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    const TORUS_CONTRACT = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
    
    const torusABI = [
      'event Transfer(address indexed from, address indexed to, uint256 value)'
    ];
    
    const torusContract = new ethers.Contract(TORUS_CONTRACT, torusABI, provider);
    
    const deployBlock = 22890272;
    const currentBlock = await provider.getBlockNumber();
    
    console.log('Getting all TORUS transfers involving Buy & Process contract...\n');
    
    const allTransfers = [];
    const chunkSize = 5000;
    
    // Get transfers TO the contract
    for (let start = deployBlock; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      
      const filterIn = torusContract.filters.Transfer(
        null,
        BUY_PROCESS_CONTRACT
      );
      
      const transfersIn = await torusContract.queryFilter(filterIn, start, end);
      allTransfers.push(...transfersIn.map(t => ({...t, direction: 'IN'})));
    }
    
    // Get transfers FROM the contract
    for (let start = deployBlock; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      
      const filterOut = torusContract.filters.Transfer(
        BUY_PROCESS_CONTRACT,
        null
      );
      
      const transfersOut = await torusContract.queryFilter(filterOut, start, end);
      allTransfers.push(...transfersOut.map(t => ({...t, direction: 'OUT'})));
    }
    
    // Sort by block number
    allTransfers.sort((a, b) => a.blockNumber - b.blockNumber);
    
    console.log(`Found ${allTransfers.length} total transfers\n`);
    
    // Calculate running balance
    let balance = ethers.BigNumber.from(0);
    let totalIn = ethers.BigNumber.from(0);
    let totalOut = ethers.BigNumber.from(0);
    let totalBurned = ethers.BigNumber.from(0);
    let totalSentElsewhere = ethers.BigNumber.from(0);
    
    console.log('Transfer history:');
    console.log('================\n');
    
    for (let i = 0; i < allTransfers.length; i++) {
      const transfer = allTransfers[i];
      const amount = transfer.args.value;
      const formattedAmount = ethers.utils.formatEther(amount);
      
      if (transfer.direction === 'IN') {
        balance = balance.add(amount);
        totalIn = totalIn.add(amount);
        
        const from = transfer.args.from;
        const fromLabel = from === '0x0000000000000000000000000000000000000000' ? 'MINT' : 
                         from === '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F' ? 'Uniswap V3 Pool' : 
                         from;
        
        console.log(`#${i + 1} Block ${transfer.blockNumber}: IN  ${formattedAmount} TORUS from ${fromLabel}`);
      } else {
        balance = balance.sub(amount);
        totalOut = totalOut.add(amount);
        
        const to = transfer.args.to;
        if (to === '0x0000000000000000000000000000000000000000') {
          totalBurned = totalBurned.add(amount);
          console.log(`#${i + 1} Block ${transfer.blockNumber}: OUT ${formattedAmount} TORUS to BURN (0x0)`);
        } else {
          totalSentElsewhere = totalSentElsewhere.add(amount);
          console.log(`#${i + 1} Block ${transfer.blockNumber}: OUT ${formattedAmount} TORUS to ${to}`);
        }
      }
      
      console.log(`   Balance after: ${ethers.utils.formatEther(balance)} TORUS`);
      console.log(`   Tx: ${transfer.transactionHash}`);
      console.log('');
      
      // Show first 20 transfers only for readability
      if (i === 19 && allTransfers.length > 20) {
        console.log(`... ${allTransfers.length - 20} more transfers ...\n`);
        break;
      }
    }
    
    console.log('\nSummary:');
    console.log('========');
    console.log(`Total TORUS received: ${ethers.utils.formatEther(totalIn)}`);
    console.log(`Total TORUS sent out: ${ethers.utils.formatEther(totalOut)}`);
    console.log(`  - Burned (to 0x0): ${ethers.utils.formatEther(totalBurned)}`);
    console.log(`  - Sent elsewhere: ${ethers.utils.formatEther(totalSentElsewhere)}`);
    console.log(`Current balance: ${ethers.utils.formatEther(balance)}`);
    
    // Find where the non-burn transfers went
    if (totalSentElsewhere.gt(0)) {
      console.log('\nNon-burn transfers breakdown:');
      const destinations = {};
      
      for (const transfer of allTransfers) {
        if (transfer.direction === 'OUT' && transfer.args.to !== '0x0000000000000000000000000000000000000000') {
          const to = transfer.args.to;
          if (!destinations[to]) {
            destinations[to] = ethers.BigNumber.from(0);
          }
          destinations[to] = destinations[to].add(transfer.args.value);
        }
      }
      
      for (const [address, amount] of Object.entries(destinations)) {
        console.log(`  ${address}: ${ethers.utils.formatEther(amount)} TORUS`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

traceAllTorusTransfers().catch(console.error);