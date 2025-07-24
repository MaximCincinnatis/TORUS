const { ethers } = require('ethers');

async function verifyBurnsOnChain() {
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const BUY_PROCESS_ADDRESS = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
  
  console.log('=== VERIFYING BURNS AND BUILDS ON BLOCKCHAIN ===\n');
  
  // Contract start time (15:00 UTC)
  const CONTRACT_START = new Date('2025-07-10T15:00:00Z');
  
  // Calculate block ranges for days 14 and 15
  const day14Start = new Date(CONTRACT_START);
  day14Start.setUTCDate(day14Start.getUTCDate() + 13); // Day 14 starts after 13 full days
  const day14End = new Date(day14Start);
  day14End.setUTCDate(day14End.getUTCDate() + 1);
  
  const day15Start = day14End;
  const day15End = new Date(day15Start);
  day15End.setUTCDate(day15End.getUTCDate() + 1);
  
  console.log(`Day 14: ${day14Start.toISOString()} to ${day14End.toISOString()}`);
  console.log(`Day 15: ${day15Start.toISOString()} to ${day15End.toISOString()}\n`);
  
  // Get approximate blocks
  const currentBlock = await provider.getBlockNumber();
  const blocksPerDay = 7200; // ~12 sec per block
  const day14StartBlock = currentBlock - (blocksPerDay * 2); // Roughly 2 days ago
  const day15StartBlock = currentBlock - blocksPerDay; // Roughly 1 day ago
  
  // Check BuyAndBurn events
  const buyAndBurnTopic = ethers.utils.id('BuyAndBurn(uint256,uint256,uint256,uint256,uint256)');
  const buyAndBuildTopic = ethers.utils.id('BuyAndBuild(uint256,uint256,uint256,uint256)');
  
  try {
    // Get Day 14 burns
    console.log('Checking Day 14 burns...');
    const day14BurnLogs = await provider.getLogs({
      address: BUY_PROCESS_ADDRESS,
      topics: [buyAndBurnTopic],
      fromBlock: day14StartBlock,
      toBlock: day14StartBlock + blocksPerDay
    });
    
    console.log(`Found ${day14BurnLogs.length} burns on Day 14`);
    
    let day14ETHTotal = ethers.BigNumber.from(0);
    for (const log of day14BurnLogs.slice(0, 5)) { // Check first 5
      const tx = await provider.getTransaction(log.transactionHash);
      console.log(`  Tx ${log.transactionHash.slice(0, 10)}... ETH sent: ${ethers.utils.formatEther(tx.value)}`);
      day14ETHTotal = day14ETHTotal.add(tx.value);
    }
    
    console.log(`Day 14 ETH total (first 5): ${ethers.utils.formatEther(day14ETHTotal)}\n`);
    
    // Get Day 15 burns
    console.log('Checking Day 15 burns...');
    const day15BurnLogs = await provider.getLogs({
      address: BUY_PROCESS_ADDRESS,
      topics: [buyAndBurnTopic],
      fromBlock: day15StartBlock,
      toBlock: currentBlock
    });
    
    console.log(`Found ${day15BurnLogs.length} burns on Day 15`);
    
    let day15ETHTotal = ethers.BigNumber.from(0);
    for (const log of day15BurnLogs.slice(0, 5)) { // Check first 5
      const tx = await provider.getTransaction(log.transactionHash);
      console.log(`  Tx ${log.transactionHash.slice(0, 10)}... ETH sent: ${ethers.utils.formatEther(tx.value)}`);
      day15ETHTotal = day15ETHTotal.add(tx.value);
    }
    
    console.log(`Day 15 ETH total (first 5): ${ethers.utils.formatEther(day15ETHTotal)}\n`);
    
    // Check builds
    console.log('Checking Day 15 builds...');
    const day15BuildLogs = await provider.getLogs({
      address: BUY_PROCESS_ADDRESS,
      topics: [buyAndBuildTopic],
      fromBlock: day15StartBlock,
      toBlock: currentBlock
    });
    
    console.log(`Found ${day15BuildLogs.length} builds on Day 15`);
    
    for (const log of day15BuildLogs.slice(0, 3)) { // Check first 3
      const tx = await provider.getTransaction(log.transactionHash);
      console.log(`  Tx ${log.transactionHash.slice(0, 10)}... ETH sent: ${ethers.utils.formatEther(tx.value)}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

verifyBurnsOnChain().catch(console.error);