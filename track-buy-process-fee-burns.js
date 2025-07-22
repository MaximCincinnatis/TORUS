const { ethers } = require('ethers');
const fs = require('fs').promises;

async function trackBuyProcessFeeBurns() {
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  
  const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  const NFT_POSITION_MANAGER = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
  const TORUS_TOKEN = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
  const TORUS_TITANX_POOL = '0x7ff1f30f6e7eec2ff3f0d1b60739115bdf88190f'; // Uniswap V3 TORUS-TITANX pool
  const NFT_TOKEN_ID = 1029195;
  
  console.log('🔥 Tracking Buy & Process Fee-Driven Burns\n');
  
  const COLLECT_TOPIC = '0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0';
  
  const TORUS_ABI = [
    'event Transfer(address indexed from, address indexed to, uint256 value)'
  ];
  
  const torusContract = new ethers.Contract(TORUS_TOKEN, TORUS_ABI, provider);
  
  try {
    const currentBlock = await provider.getBlockNumber();
    const deploymentBlock = 22700000; // Pool creation was around this block
    
    console.log(`Searching from block ${deploymentBlock} to ${currentBlock}...\n`);
    
    // Find all fee collections using getLogs
    const allCollects = [];
    
    // Search in chunks
    const chunkSize = 10000; // Smaller chunks to avoid timeouts
    for (let fromBlock = deploymentBlock; fromBlock < currentBlock; fromBlock += chunkSize) {
      const toBlock = Math.min(fromBlock + chunkSize - 1, currentBlock);
      
      try {
        const logs = await provider.getLogs({
          address: TORUS_TITANX_POOL,
          topics: [COLLECT_TOPIC],
          fromBlock: fromBlock,
          toBlock: toBlock
        });
        
        // Filter for collections where recipient is Buy & Process contract
        for (const log of logs) {
          // Decode the data
          const types = ['address', 'uint256', 'uint256'];
          const decoded = ethers.utils.defaultAbiCoder.decode(types, log.data);
          const recipient = decoded[0];
          
          if (recipient.toLowerCase() === BUY_PROCESS_CONTRACT.toLowerCase()) {
            allCollects.push({
              blockNumber: log.blockNumber,
              transactionHash: log.transactionHash,
              args: {
                recipient: recipient,
                amount0: decoded[1], // TORUS
                amount1: decoded[2]  // TitanX
              }
            });
            console.log(`Found Buy & Process fee collection in block ${log.blockNumber}`);
          }
        }
      } catch (e) {
        console.log(`Error in block range ${fromBlock}-${toBlock}: ${e.message}`);
      }
      
      // Progress
      if ((fromBlock - deploymentBlock) % 200000 === 0 && fromBlock > deploymentBlock) {
        const progress = ((fromBlock - deploymentBlock) / (currentBlock - deploymentBlock) * 100).toFixed(1);
        console.log(`Progress: ${progress}%`);
      }
    }
    
    console.log(`\nTotal fee collections found: ${allCollects.length}\n`);
    
    // For each fee collection, check if TORUS was burned in the same transaction
    const feeBurns = [];
    
    for (const collect of allCollects) {
      const receipt = await provider.getTransactionReceipt(collect.transactionHash);
      
      // Look for TORUS burn (transfer to 0x0) in the same transaction
      const burnLogs = receipt.logs.filter(log => 
        log.address.toLowerCase() === TORUS_TOKEN.toLowerCase() &&
        log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' && // Transfer
        log.topics[1] === ethers.utils.hexZeroPad(BUY_PROCESS_CONTRACT.toLowerCase(), 32) && // from Buy & Process
        log.topics[2] === '0x0000000000000000000000000000000000000000000000000000000000000000' // to 0x0
      );
      
      if (burnLogs.length > 0) {
        const block = await provider.getBlock(collect.blockNumber);
        const burnAmount = ethers.BigNumber.from(burnLogs[0].data);
        
        const feeBurn = {
          blockNumber: collect.blockNumber,
          timestamp: block.timestamp,
          date: new Date(block.timestamp * 1000).toISOString(),
          transactionHash: collect.transactionHash,
          torusCollected: ethers.utils.formatEther(collect.args.amount0),
          titanxCollected: ethers.utils.formatEther(collect.args.amount1),
          torusBurned: ethers.utils.formatEther(burnAmount),
          burnPercentage: (burnAmount.mul(10000).div(collect.args.amount0).toNumber() / 100).toFixed(2)
        };
        
        feeBurns.push(feeBurn);
        
        console.log(`Fee Collection & Burn at block ${collect.blockNumber}:`);
        console.log(`  Date: ${feeBurn.date}`);
        console.log(`  TORUS collected: ${feeBurn.torusCollected}`);
        console.log(`  TORUS burned: ${feeBurn.torusBurned} (${feeBurn.burnPercentage}%)`);
        console.log(`  TitanX collected: ${feeBurn.titanxCollected}`);
        console.log(`  Tx: ${feeBurn.transactionHash}\n`);
      }
    }
    
    // Calculate totals
    let totalTorusCollected = ethers.BigNumber.from(0);
    let totalTorusBurned = ethers.BigNumber.from(0);
    let totalTitanxCollected = ethers.BigNumber.from(0);
    
    for (const burn of feeBurns) {
      totalTorusCollected = totalTorusCollected.add(ethers.utils.parseEther(burn.torusCollected));
      totalTorusBurned = totalTorusBurned.add(ethers.utils.parseEther(burn.torusBurned));
      totalTitanxCollected = totalTitanxCollected.add(ethers.utils.parseEther(burn.titanxCollected));
    }
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total Fee Collections: ${feeBurns.length}`);
    console.log(`Total TORUS Collected: ${ethers.utils.formatEther(totalTorusCollected)}`);
    console.log(`Total TORUS Burned: ${ethers.utils.formatEther(totalTorusBurned)}`);
    console.log(`Total TitanX Collected: ${ethers.utils.formatEther(totalTitanxCollected)}`);
    console.log(`Average Burn Rate: ${totalTorusCollected.gt(0) ? (totalTorusBurned.mul(10000).div(totalTorusCollected).toNumber() / 100).toFixed(2) : 0}%`);
    
    // Also check for any direct TORUS burns not from fee collections
    console.log('\n\nChecking for additional TORUS burns from Buy & Process...');
    
    const burnFilter = torusContract.filters.Transfer(BUY_PROCESS_CONTRACT, '0x0000000000000000000000000000000000000000');
    const recentBurns = await torusContract.queryFilter(burnFilter, currentBlock - 9000, currentBlock);
    
    console.log(`Found ${recentBurns.length} total burns in last 50k blocks`);
    
    // Filter out the fee collection burns we already found
    const feeBurnTxs = new Set(feeBurns.map(b => b.transactionHash));
    const otherBurns = recentBurns.filter(burn => !feeBurnTxs.has(burn.transactionHash));
    
    console.log(`${otherBurns.length} burns are NOT from fee collections\n`);
    
    if (otherBurns.length > 0) {
      console.log('Sample of non-fee-collection burns:');
      for (const burn of otherBurns.slice(-5)) {
        const block = await provider.getBlock(burn.blockNumber);
        const date = new Date(block.timestamp * 1000);
        
        console.log(`\n${date.toISOString()}:`);
        console.log(`  Amount: ${ethers.utils.formatEther(burn.args.value)} TORUS`);
        console.log(`  Block: ${burn.blockNumber}`);
        console.log(`  Tx: ${burn.transactionHash}`);
      }
    }
    
    // Save data for dashboard integration
    const buyProcessData = {
      lastUpdated: new Date().toISOString(),
      lastBlock: currentBlock,
      nftPosition: {
        tokenId: NFT_TOKEN_ID,
        owner: BUY_PROCESS_CONTRACT
      },
      feeDrivenBurns: feeBurns,
      totals: {
        feeCollections: feeBurns.length,
        torusCollected: ethers.utils.formatEther(totalTorusCollected),
        torusBurned: ethers.utils.formatEther(totalTorusBurned),
        titanxCollected: ethers.utils.formatEther(totalTitanxCollected),
        averageBurnRate: totalTorusCollected.gt(0) ? (totalTorusBurned.mul(10000).div(totalTorusCollected).toNumber() / 100).toFixed(2) : '0'
      }
    };
    
    // Save to file
    await fs.writeFile(
      './public/data/buy-process-burns.json',
      JSON.stringify(buyProcessData, null, 2)
    );
    
    console.log('\n✅ Data saved to public/data/buy-process-burns.json');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

trackBuyProcessFeeBurns().catch(console.error);