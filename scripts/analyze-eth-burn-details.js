#!/usr/bin/env node

/**
 * Analyze ETH burn transaction details to find the actual ETH amounts
 */

const { ethers } = require('ethers');

async function analyzeETHBurnDetails() {
  console.log('🔍 Analyzing ETH Burn Transaction Details\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  
  // Let's check specific ETH burn transactions
  const ethBurnTxs = [
    '0xc815687fc85889609ac96881fc69984d1d9fd70857868c5eb55d8ba65ea0a2fb',
    '0x290b350b46cd49a1a84c9915001578954518ec7f1f13750922f3791d88430692',
    '0x82e8a4ab8cce5a7fcbd9ddd22a88e8b08e1e49716d898215376c16aa024bf7f8',
    '0x402b237566468282c96db204415952e4d1117035fcb62752b0ee8c5dfa00d720'
  ];
  
  console.log('Analyzing known ETH burn transactions...\n');
  
  for (const txHash of ethBurnTxs) {
    try {
      console.log(`\n=== Transaction ${txHash} ===`);
      
      const tx = await provider.getTransaction(txHash);
      const receipt = await provider.getTransactionReceipt(txHash);
      const block = await provider.getBlock(tx.blockNumber);
      
      console.log(`From: ${tx.from}`);
      console.log(`To: ${tx.to}`);
      console.log(`Function: ${tx.data.slice(0, 10)}`);
      console.log(`Value: ${ethers.utils.formatEther(tx.value)} ETH`);
      console.log(`Date: ${new Date(block.timestamp * 1000).toISOString()}`);
      
      // Parse the transaction input data
      // swapETHForTorusAndBurn(uint32 _deadline)
      const iface = new ethers.utils.Interface([
        'function swapETHForTorusAndBurn(uint32 _deadline)'
      ]);
      
      try {
        const decoded = iface.parseTransaction({ data: tx.data });
        console.log(`Deadline: ${decoded.args._deadline}`);
      } catch (e) {
        console.log('Could not decode function data');
      }
      
      // Look for WETH deposit events in the transaction logs
      console.log('\nLooking for WETH events...');
      
      const wethDepositTopic = ethers.utils.id('Deposit(address,uint256)');
      const wethTransferTopic = ethers.utils.id('Transfer(address,address,uint256)');
      
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
          if (log.topics[0] === wethDepositTopic) {
            // WETH Deposit event
            const amount = ethers.BigNumber.from(log.data);
            console.log(`WETH Deposit: ${ethers.utils.formatEther(amount)} WETH`);
            console.log(`  Depositor: ${ethers.utils.defaultAbiCoder.decode(['address'], log.topics[1])[0]}`);
          } else if (log.topics[0] === wethTransferTopic) {
            // WETH Transfer event
            const from = ethers.utils.defaultAbiCoder.decode(['address'], log.topics[1])[0];
            const to = ethers.utils.defaultAbiCoder.decode(['address'], log.topics[2])[0];
            const amount = ethers.BigNumber.from(log.data);
            console.log(`WETH Transfer: ${ethers.utils.formatEther(amount)} WETH`);
            console.log(`  From: ${from}`);
            console.log(`  To: ${to}`);
          }
        }
      }
      
      // Check if there are any ETH transfers in internal transactions
      console.log('\nChecking for internal ETH transfers...');
      
      // Get trace to see internal transactions
      const trace = await provider.send('debug_traceTransaction', [txHash, { tracer: 'callTracer' }]);
      
      if (trace && trace.calls) {
        const findETHTransfers = (calls, depth = 0) => {
          for (const call of calls || []) {
            if (call.value && call.value !== '0x0') {
              const ethValue = ethers.utils.formatEther('0x' + call.value.slice(2));
              console.log(`${'  '.repeat(depth)}ETH Transfer: ${ethValue} ETH`);
              console.log(`${'  '.repeat(depth)}  From: ${call.from}`);
              console.log(`${'  '.repeat(depth)}  To: ${call.to}`);
              console.log(`${'  '.repeat(depth)}  Type: ${call.type}`);
            }
            if (call.calls) {
              findETHTransfers(call.calls, depth + 1);
            }
          }
        };
        
        if (trace.value && trace.value !== '0x0') {
          const ethValue = ethers.utils.formatEther('0x' + trace.value.slice(2));
          console.log(`Main call ETH: ${ethValue} ETH`);
        }
        
        findETHTransfers(trace.calls);
      }
      
    } catch (error) {
      console.error(`Error analyzing ${txHash}:`, error.message);
      
      // Try alternative method - check transaction trace
      try {
        console.log('\nTrying eth_getTransactionReceipt for value...');
        const receipt = await provider.getTransactionReceipt(txHash);
        
        // Check if effectiveGasPrice * gasUsed might give us a clue
        if (receipt.effectiveGasPrice && receipt.gasUsed) {
          const gasCost = receipt.effectiveGasPrice.mul(receipt.gasUsed);
          console.log(`Gas cost: ${ethers.utils.formatEther(gasCost)} ETH`);
        }
      } catch (e) {
        console.log('Could not get additional details');
      }
    }
  }
}

analyzeETHBurnDetails().catch(console.error);