const { ethers } = require('ethers');
const fs = require('fs');

async function fixDay12StakesOnly() {
  console.log('🔄 FIXING DAY 12 STAKES ONLY...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  const TITANX_CONTRACT = '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1';
  
  // Get Day 12 stakes
  const DAY_12_START = new Date('2025-07-21T00:00:00Z');
  const DAY_12_END = new Date('2025-07-22T00:00:00Z');
  
  const day12Stakes = data.stakingData.stakeEvents.filter(e => {
    const ts = parseInt(e.timestamp) * 1000;
    return ts >= DAY_12_START.getTime() && ts < DAY_12_END.getTime();
  });
  
  console.log(`Found ${day12Stakes.length} stakes on Day 12\n`);
  
  // Get event signatures
  const stakedEventSig = ethers.utils.id('Staked(address,uint256,uint256,uint256,uint256)');
  const transferEventSig = ethers.utils.id('Transfer(address,address,uint256)');
  
  let fixed = 0;
  
  // Day 12 is approximately blocks 22964000-22971000
  const DAY_12_START_BLOCK = 22964000;
  const DAY_12_END_BLOCK = 22971000;
  
  // Fetch all stake events in Day 12
  console.log('Fetching all stake events from Day 12...');
  const logs = await provider.getLogs({
    address: CREATE_STAKE_CONTRACT,
    topics: [stakedEventSig],
    fromBlock: DAY_12_START_BLOCK,
    toBlock: DAY_12_END_BLOCK
  });
  
  console.log(`Found ${logs.length} total stake events on Day 12\n`);
  
  // Process each Day 12 stake
  for (const stake of day12Stakes) {
    console.log(`\nProcessing stake ${stake.id} by ${stake.user.substring(0, 10)}...`);
    
    // Find matching log
    const userAddress = stake.user.toLowerCase();
    const matchingLog = logs.find(log => {
      const decoded = ethers.utils.defaultAbiCoder.decode(
        ['uint256', 'uint256', 'uint256', 'uint256'],
        log.data
      );
      const logUser = '0x' + log.topics[1].substring(26);
      const logStakeIndex = decoded[0].toString();
      const logPrincipal = decoded[1].toString();
      
      return logUser.toLowerCase() === userAddress && 
             logStakeIndex === stake.id && 
             logPrincipal === stake.principal;
    });
    
    if (matchingLog) {
      console.log(`  ✓ Found matching event`);
      console.log(`  Tx Hash: ${matchingLog.transactionHash}`);
      
      // Update transaction hash
      stake.transactionHash = matchingLog.transactionHash;
      stake.blockNumber = matchingLog.blockNumber;
      
      // Fetch transaction details
      const tx = await provider.getTransaction(matchingLog.transactionHash);
      
      // Check ETH payment
      const ethSent = tx.value;
      if (ethSent && ethSent.gt(0)) {
        stake.rawCostETH = ethSent.toString();
        stake.costETH = ethSent.toString();
        console.log(`  ETH Payment: ${ethers.utils.formatEther(ethSent)}`);
      }
      
      // Check for TitanX transfers
      const contractAddress = ethers.utils.hexZeroPad(CREATE_STAKE_CONTRACT.toLowerCase(), 32);
      const userAddressPadded = ethers.utils.hexZeroPad(userAddress, 32);
      
      const titanXLogs = await provider.getLogs({
        address: TITANX_CONTRACT,
        topics: [transferEventSig, userAddressPadded, contractAddress],
        blockHash: matchingLog.blockHash
      });
      
      let titanXSent = ethers.BigNumber.from(0);
      titanXLogs.forEach(log => {
        if (log.transactionHash === matchingLog.transactionHash) {
          titanXSent = titanXSent.add(ethers.BigNumber.from(log.data));
        }
      });
      
      if (titanXSent.gt(0)) {
        stake.rawCostTitanX = titanXSent.toString();
        stake.costTitanX = titanXSent.toString();
        console.log(`  TitanX Payment: ${ethers.utils.formatEther(titanXSent)}`);
      }
      
      if (!ethSent.gt(0) && !titanXSent.gt(0)) {
        console.log(`  ⚠️  No payment found`);
      }
      
      fixed++;
    } else {
      console.log(`  ❌ No matching event found`);
    }
  }
  
  // Save updated data
  console.log(`\n💾 Saving updated data...`);
  fs.writeFileSync('public/data/cached-data.json', JSON.stringify(data, null, 2));
  
  console.log(`\n✅ Fixed ${fixed} stakes on Day 12`);
  
  // Show updated Day 12 summary
  console.log('\n=== DAY 12 SUMMARY ===');
  let withTitanX = 0;
  let withETH = 0;
  let withNoData = 0;
  
  day12Stakes.forEach(s => {
    if (s.rawCostTitanX && s.rawCostTitanX !== '0') withTitanX++;
    else if (s.rawCostETH && s.rawCostETH !== '0') withETH++;
    else withNoData++;
  });
  
  console.log(`Total stakes: ${day12Stakes.length}`);
  console.log(`With TitanX: ${withTitanX}`);
  console.log(`With ETH: ${withETH}`);
  console.log(`No payment data: ${withNoData}`);
}

fixDay12StakesOnly().catch(console.error);