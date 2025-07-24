const { ethers } = require('ethers');
const fs = require('fs');

async function fixHistoricalStakeData() {
  console.log('🔄 FIXING HISTORICAL STAKE DATA...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  const TITANX_CONTRACT = '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1';
  
  // Find stakes without transaction hashes or payment data
  const stakesNeedingFix = data.stakingData.stakeEvents.filter(s => 
    !s.transactionHash || 
    ((!s.rawCostTitanX || s.rawCostTitanX === '0') && (!s.rawCostETH || s.rawCostETH === '0'))
  );
  
  console.log(`Found ${stakesNeedingFix.length} stakes needing fixes\n`);
  
  // Get Staked event signature
  const stakedEventSig = ethers.utils.id('Staked(address,uint256,uint256,uint256,uint256)');
  const transferEventSig = ethers.utils.id('Transfer(address,address,uint256)');
  
  let fixed = 0;
  let errors = 0;
  
  for (const stake of stakesNeedingFix) {
    console.log(`\nProcessing stake ${stake.id} by ${stake.user.substring(0, 10)}...`);
    console.log(`  Timestamp: ${new Date(parseInt(stake.timestamp) * 1000).toISOString()}`);
    console.log(`  Block: ${stake.blockNumber || 'unknown'}`);
    
    try {
      // If we don't have block number, estimate it from timestamp
      let searchBlock = stake.blockNumber;
      if (!searchBlock) {
        // Ethereum averages ~12 second blocks
        const timeDiff = parseInt(stake.timestamp) - 1752883200; // July 18 timestamp
        const blocksDiff = Math.floor(timeDiff / 12);
        searchBlock = 22942663 + blocksDiff; // July 18 block + estimated blocks
        console.log(`  Estimated block: ${searchBlock}`);
      }
      
      // Search for the Staked event in a range of blocks
      const fromBlock = searchBlock - 50;
      const toBlock = searchBlock + 50;
      
      // Create filter for this user's stake events
      const userAddress = ethers.utils.hexZeroPad(stake.user.toLowerCase(), 32);
      
      const logs = await provider.getLogs({
        address: CREATE_STAKE_CONTRACT,
        topics: [stakedEventSig, userAddress],
        fromBlock: fromBlock,
        toBlock: toBlock
      });
      
      console.log(`  Found ${logs.length} stake events in block range ${fromBlock}-${toBlock}`);
      
      // Find the matching stake by index
      let matchingLog = null;
      for (const log of logs) {
        const decoded = ethers.utils.defaultAbiCoder.decode(
          ['uint256', 'uint256', 'uint256', 'uint256'],
          log.data
        );
        const logStakeIndex = decoded[0].toString();
        const logPrincipal = decoded[1].toString();
        
        if (logStakeIndex === stake.id && logPrincipal === stake.principal) {
          matchingLog = log;
          break;
        }
      }
      
      if (matchingLog) {
        console.log(`  ✓ Found matching stake event`);
        console.log(`  Tx Hash: ${matchingLog.transactionHash}`);
        
        // Update transaction hash
        stake.transactionHash = matchingLog.transactionHash;
        stake.blockNumber = matchingLog.blockNumber;
        
        // Now fetch the transaction to check payment
        const tx = await provider.getTransaction(matchingLog.transactionHash);
        
        // Check ETH payment
        const ethSent = tx.value;
        if (ethSent && ethSent.gt(0)) {
          stake.rawCostETH = ethSent.toString();
          stake.costETH = ethSent.toString();
          console.log(`  ETH Payment: ${ethers.utils.formatEther(ethSent)}`);
        }
        
        // Check for TitanX transfers in same transaction
        const contractAddress = ethers.utils.hexZeroPad(CREATE_STAKE_CONTRACT.toLowerCase(), 32);
        
        const titanXLogs = await provider.getLogs({
          address: TITANX_CONTRACT,
          topics: [transferEventSig, userAddress, contractAddress],
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
          console.log(`  ⚠️  No payment found (might be free stake or special case)`);
        }
        
        fixed++;
      } else {
        console.log(`  ❌ Could not find matching stake event`);
        errors++;
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      console.log(`  Error: ${error.message}`);
      errors++;
    }
  }
  
  // Save updated data
  console.log(`\n💾 Saving updated data...`);
  fs.writeFileSync('public/data/cached-data.json', JSON.stringify(data, null, 2));
  
  console.log(`\n✅ Fixed ${fixed} stakes, ${errors} errors`);
  
  // Verify the fix
  console.log('\n=== VERIFICATION ===');
  const afterJuly18 = new Date('2025-07-18T00:00:00Z').getTime();
  const recentStakes = data.stakingData.stakeEvents
    .filter(s => parseInt(s.timestamp) * 1000 >= afterJuly18)
    .sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp));
    
  console.log('Stakes after July 18:');
  const stakesByDay = {};
  recentStakes.forEach(s => {
    const date = new Date(parseInt(s.timestamp) * 1000).toISOString().split('T')[0];
    if (!stakesByDay[date]) {
      stakesByDay[date] = { total: 0, withTitanX: 0, withETH: 0, noData: 0 };
    }
    stakesByDay[date].total++;
    
    if (s.rawCostTitanX && s.rawCostTitanX !== '0') {
      stakesByDay[date].withTitanX++;
    } else if (s.rawCostETH && s.rawCostETH !== '0') {
      stakesByDay[date].withETH++;
    } else {
      stakesByDay[date].noData++;
    }
  });
  
  Object.entries(stakesByDay).sort().forEach(([date, stats]) => {
    console.log(`${date}: ${stats.total} total (TitanX: ${stats.withTitanX}, ETH: ${stats.withETH}, No data: ${stats.noData})`);
  });
}

fixHistoricalStakeData().catch(console.error);