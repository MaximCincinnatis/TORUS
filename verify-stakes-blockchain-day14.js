const { ethers } = require('ethers');

async function verifyDay14Stakes() {
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const CREATE_STAKE_ADDRESS = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  console.log('=== VERIFYING DAY 14 STAKES ON BLOCKCHAIN ===\n');
  
  // Contract start time (15:00 UTC)
  const CONTRACT_START = new Date('2025-07-10T15:00:00Z');
  
  // Calculate day 14 block range
  const day14Start = new Date(CONTRACT_START);
  day14Start.setUTCDate(day14Start.getUTCDate() + 13); // Day 14 starts after 13 full days
  const day14End = new Date(day14Start);
  day14End.setUTCDate(day14End.getUTCDate() + 1);
  
  console.log(`Day 14: ${day14Start.toISOString()} to ${day14End.toISOString()}`);
  
  // Get approximate blocks (assuming ~12 sec per block)
  const currentBlock = await provider.getBlockNumber();
  const msPerBlock = 12000;
  const day14StartTime = day14Start.getTime();
  const currentTime = Date.now();
  const msElapsed = currentTime - day14StartTime;
  const blocksElapsed = Math.floor(msElapsed / msPerBlock);
  const day14StartBlock = currentBlock - blocksElapsed;
  const day14EndBlock = day14StartBlock + 7200; // ~1 day worth of blocks
  
  console.log(`Block range: ${day14StartBlock} to ${day14EndBlock}\n`);
  
  // Get Staked events
  const stakedTopic = ethers.utils.id('Staked(address,uint256,uint256,uint256,uint8)');
  
  try {
    const logs = await provider.getLogs({
      address: CREATE_STAKE_ADDRESS,
      topics: [stakedTopic],
      fromBlock: day14StartBlock,
      toBlock: day14EndBlock
    });
    
    console.log(`Found ${logs.length} stake events on Day 14\n`);
    
    // Parse events
    const stakeInterface = new ethers.utils.Interface([
      'event Staked(address indexed user, uint256 indexed stakeIndex, uint256 torusAmount, uint256 duration, uint8 paymentType)'
    ]);
    
    let totalStaked = ethers.BigNumber.from(0);
    let totalTitanX = ethers.BigNumber.from(0);
    let totalETH = ethers.BigNumber.from(0);
    
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const parsed = stakeInterface.parseLog(log);
      const torusAmount = parsed.args.torusAmount;
      
      totalStaked = totalStaked.add(torusAmount);
      
      console.log(`Stake ${i + 1}:`);
      console.log(`  User: ${parsed.args.user}`);
      console.log(`  Amount: ${ethers.utils.formatEther(torusAmount)} TORUS`);
      console.log(`  Duration: ${parsed.args.duration} days`);
      console.log(`  Payment Type: ${parsed.args.paymentType}`);
      console.log(`  Tx: ${log.transactionHash}`);
      
      // Get transaction to check payment
      const tx = await provider.getTransaction(log.transactionHash);
      const receipt = await provider.getTransactionReceipt(log.transactionHash);
      
      // Check for TitanX transfers
      const titanXTransferTopic = ethers.utils.id('Transfer(address,address,uint256)');
      const TITANX_ADDRESS = '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1';
      
      const titanXTransfers = receipt.logs.filter(l => 
        l.address.toLowerCase() === TITANX_ADDRESS.toLowerCase() &&
        l.topics[0] === titanXTransferTopic &&
        l.topics[2] && l.topics[2].toLowerCase() === CREATE_STAKE_ADDRESS.toLowerCase().replace('0x', '0x000000000000000000000000')
      );
      
      if (titanXTransfers.length > 0) {
        const amount = ethers.BigNumber.from(titanXTransfers[0].data);
        totalTitanX = totalTitanX.add(amount);
        console.log(`  TitanX Payment: ${ethers.utils.formatEther(amount)}`);
      } else if (tx.value.gt(0)) {
        totalETH = totalETH.add(tx.value);
        console.log(`  ETH Payment: ${ethers.utils.formatEther(tx.value)}`);
      }
      
      console.log('');
    }
    
    console.log('=== SUMMARY ===');
    console.log(`Total Stakes: ${logs.length}`);
    console.log(`Total TORUS Staked: ${ethers.utils.formatEther(totalStaked)} TORUS`);
    console.log(`Total TitanX Used: ${ethers.utils.formatEther(totalTitanX)} TitanX`);
    console.log(`Total ETH Used: ${ethers.utils.formatEther(totalETH)} ETH`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

verifyDay14Stakes().catch(console.error);