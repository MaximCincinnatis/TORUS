const { ethers } = require('ethers');

async function decodeBuyProcessEvents() {
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  const TORUS_TOKEN = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
  
  console.log('🔍 Decoding Buy & Process Contract Events\n');
  
  // Event signatures we found
  const eventSignatures = [
    '0x89af60e661efa3da35b4ce1b5165e52acf2e747e41905d84e9ec3230e7b006b2',
    '0x1b3ed074dce570943c9d4e66776a060e8ac73af4f6b002482b09e561d90f038c',
    '0x302485b9d53be977b4eb410b57770a1772f7ac7e5a137ec6ac179e403f69b541'
  ];
  
  // Common event signatures for reference
  const knownEventSigs = {
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef': 'Transfer(address,address,uint256)',
    '0xcc16f5dbb4873280815c1ee09dbd06736cffcc184412cf7a71a0fdb75d397ca5': 'Burn(address,uint256)',
    '0x696de425f79f4a40bc6d2122ca50507f0efbeabbff86a84871b7023ab5ca0720': 'Burn(address,address,uint256)',
    '0xdccd412f0b1252819cb1fd330b93224ca42612892bb3f4f789976e6d81936496': 'Burn(address,uint256,uint256)',
    '0x5d624aa9c148153ab3446c1b154f660ee7701e549fe9b62dab7171b1c80e6fa2': 'BurnAndBuild(address,uint256,uint256)',
    '0x42e160154868087d6bfdc0ca23d96a1c1cfa32f1b72ba9ba27b69b98a0d819dc': 'TorusBurned(uint256)'
  };
  
  console.log('Analyzing event signatures found in Buy & Process contract:\n');
  
  for (const sig of eventSignatures) {
    console.log(`Event signature: ${sig}`);
    
    if (knownEventSigs[sig]) {
      console.log(`  ✅ Known event: ${knownEventSigs[sig]}`);
    } else {
      console.log(`  ❓ Unknown event signature`);
    }
    console.log('');
  }
  
  // Get recent events and decode them
  console.log('Fetching recent events to analyze patterns...\n');
  
  const currentBlock = await provider.getBlockNumber();
  const filter = {
    address: BUY_PROCESS_CONTRACT,
    fromBlock: currentBlock - 10000,
    toBlock: currentBlock
  };
  
  const logs = await provider.getLogs(filter);
  console.log(`Found ${logs.length} events in last 10,000 blocks\n`);
  
  // Group events by signature
  const eventGroups = {};
  for (const log of logs) {
    const sig = log.topics[0];
    if (!eventGroups[sig]) {
      eventGroups[sig] = [];
    }
    eventGroups[sig].push(log);
  }
  
  // Analyze each event type
  for (const [sig, events] of Object.entries(eventGroups)) {
    console.log(`\nEvent ${sig}:`);
    console.log(`  Count: ${events.length}`);
    
    // Sample the most recent event
    const sampleEvent = events[events.length - 1];
    console.log(`  Sample (Block ${sampleEvent.blockNumber}):`);
    console.log(`    Topics: ${sampleEvent.topics.length}`);
    console.log(`    Data length: ${sampleEvent.data.length} bytes`);
    
    // Try to decode data
    if (sampleEvent.data.length > 2) {
      try {
        // Try decoding as different types
        const dataHex = sampleEvent.data;
        
        // Try as single uint256
        if (dataHex.length === 66) {
          const value = ethers.BigNumber.from(dataHex);
          console.log(`    Decoded as uint256: ${ethers.utils.formatEther(value)}`);
        }
        
        // Try as two uint256s
        if (dataHex.length === 130) {
          const value1 = ethers.BigNumber.from('0x' + dataHex.slice(2, 66));
          const value2 = ethers.BigNumber.from('0x' + dataHex.slice(66, 130));
          console.log(`    Decoded as two uint256s:`);
          console.log(`      Value 1: ${ethers.utils.formatEther(value1)}`);
          console.log(`      Value 2: ${ethers.utils.formatEther(value2)}`);
        }
      } catch (e) {
        console.log(`    Could not decode data`);
      }
    }
    
    // Get transaction details for the most recent event
    const tx = await provider.getTransaction(sampleEvent.transactionHash);
    console.log(`    From: ${tx.from}`);
    console.log(`    Value: ${ethers.utils.formatEther(tx.value)} ETH`);
    console.log(`    Tx: ${tx.hash}`);
  }
  
  // Look for TORUS burn events
  console.log('\n\nChecking for TORUS token burn events...\n');
  
  const TORUS_ABI = [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Burn(address indexed burner, uint256 value)'
  ];
  
  const torusContract = new ethers.Contract(TORUS_TOKEN, TORUS_ABI, provider);
  
  // Check for transfers to 0x0 (burns) from Buy & Process
  const burnAddress = '0x0000000000000000000000000000000000000000';
  const transferFilter = torusContract.filters.Transfer(BUY_PROCESS_CONTRACT, burnAddress);
  
  const burnTransfers = await torusContract.queryFilter(transferFilter, currentBlock - 10000, currentBlock);
  console.log(`Found ${burnTransfers.length} TORUS burns from Buy & Process contract`);
  
  if (burnTransfers.length > 0) {
    console.log('\nRecent TORUS burns:');
    let totalBurned = ethers.BigNumber.from(0);
    
    for (const burn of burnTransfers.slice(-5)) {
      const block = await provider.getBlock(burn.blockNumber);
      const date = new Date(block.timestamp * 1000);
      
      console.log(`\n${date.toISOString()}:`);
      console.log(`  Amount: ${ethers.utils.formatEther(burn.args.value)} TORUS`);
      console.log(`  Block: ${burn.blockNumber}`);
      console.log(`  Tx: ${burn.transactionHash}`);
      
      totalBurned = totalBurned.add(burn.args.value);
    }
    
    console.log(`\nTotal burned in sample: ${ethers.utils.formatEther(totalBurned)} TORUS`);
  }
  
  // Check if burns correlate with fee collections
  console.log('\n\nChecking correlation between fee collections and burns...');
  
  // Get the two fee collection transactions we found earlier
  const feeCollectionTxs = [
    '0x65f4d4d6450701c3c9c44e4913c7434ad423587366c323654782580e53514669',
    '0x7e22b18f2d79f88f20ec6fbd380b65a69167e3d1e4dbb54350a74ce8be39ca03'
  ];
  
  for (const txHash of feeCollectionTxs) {
    console.log(`\nAnalyzing fee collection tx: ${txHash}`);
    
    const receipt = await provider.getTransactionReceipt(txHash);
    console.log(`  Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`  Events in transaction: ${receipt.logs.length}`);
    
    // Look for TORUS transfers/burns in the same transaction
    const torusBurns = receipt.logs.filter(log => 
      log.address.toLowerCase() === TORUS_TOKEN.toLowerCase() &&
      log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' && // Transfer event
      log.topics[2] === '0x0000000000000000000000000000000000000000000000000000000000000000' // to address 0
    );
    
    if (torusBurns.length > 0) {
      console.log(`  ✅ Found ${torusBurns.length} TORUS burn(s) in same transaction!`);
      for (const burnLog of torusBurns) {
        const amount = ethers.BigNumber.from(burnLog.data);
        console.log(`    Burned: ${ethers.utils.formatEther(amount)} TORUS`);
      }
    } else {
      console.log(`  ❌ No TORUS burns found in this fee collection transaction`);
    }
  }
}

decodeBuyProcessEvents().catch(console.error);