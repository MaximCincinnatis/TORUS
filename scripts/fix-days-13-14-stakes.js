const { ethers } = require('ethers');
const fs = require('fs');

async function fixDays13And14Stakes() {
  console.log('🔄 FIXING DAYS 13-14 STAKES...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  const TITANX_CONTRACT = '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1';
  
  // Get Days 13-14 stakes
  const DAY_13_START = new Date('2025-07-22T00:00:00Z');
  const DAY_14_END = new Date('2025-07-24T00:00:00Z');
  
  const targetStakes = data.stakingData.stakeEvents.filter(e => {
    const ts = parseInt(e.timestamp) * 1000;
    return ts >= DAY_13_START.getTime() && ts < DAY_14_END.getTime() && 
           (!e.rawCostTitanX || e.rawCostTitanX === '0') && 
           (!e.rawCostETH || e.rawCostETH === '0');
  });
  
  console.log(`Found ${targetStakes.length} stakes needing fixes on Days 13-14\n`);
  
  // Get event signatures
  const stakedEventSig = ethers.utils.id('Staked(address,uint256,uint256,uint256,uint256)');
  const transferEventSig = ethers.utils.id('Transfer(address,address,uint256)');
  
  let fixed = 0;
  
  // Days 13-14 are approximately blocks 22971000-23000000
  const DAY_13_START_BLOCK = 22971000;
  const DAY_14_END_BLOCK = 23000000;
  
  // Process each stake
  for (const stake of targetStakes) {
    console.log(`\nProcessing stake ${stake.id} by ${stake.user.substring(0, 10)}...`);
    console.log(`  Timestamp: ${new Date(parseInt(stake.timestamp) * 1000).toISOString()}`);
    
    try {
      // Search for the stake event
      const userAddress = ethers.utils.hexZeroPad(stake.user.toLowerCase(), 32);
      
      // Estimate block from timestamp
      const timeDiff = parseInt(stake.timestamp) - 1753142400; // Day 13 start timestamp
      const blocksDiff = Math.floor(timeDiff / 12);
      const searchBlock = 22971000 + blocksDiff;
      
      const fromBlock = searchBlock - 100;
      const toBlock = Math.min(searchBlock + 100, DAY_14_END_BLOCK);
      
      console.log(`  Searching blocks ${fromBlock}-${toBlock}...`);
      
      const logs = await provider.getLogs({
        address: CREATE_STAKE_CONTRACT,
        topics: [stakedEventSig, userAddress],
        fromBlock: fromBlock,
        toBlock: toBlock
      });
      
      // Find matching log
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
          console.log(`  ⚠️  No payment found`);
        }
        
        fixed++;
      } else {
        console.log(`  ❌ No matching event found`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
  }
  
  // Save updated data
  console.log(`\n💾 Saving updated data...`);
  fs.writeFileSync('public/data/cached-data.json', JSON.stringify(data, null, 2));
  
  console.log(`\n✅ Fixed ${fixed} stakes on Days 13-14`);
  
  // Show updated summary
  console.log('\n=== UPDATED DAYS 13-14 SUMMARY ===');
  
  [13, 14].forEach(day => {
    const start = new Date(`2025-07-${9 + day}T00:00:00Z`);
    const end = new Date(`2025-07-${10 + day}T00:00:00Z`);
    
    const dayStakes = data.stakingData.stakeEvents.filter(e => {
      const ts = parseInt(e.timestamp) * 1000;
      return ts >= start.getTime() && ts < end.getTime();
    });
    
    const withTitanX = dayStakes.filter(s => s.rawCostTitanX && parseFloat(s.rawCostTitanX) > 0).length;
    const withETH = dayStakes.filter(s => s.rawCostETH && parseFloat(s.rawCostETH) > 0).length;
    const totalTitanX = dayStakes.reduce((sum, s) => sum + (parseFloat(s.rawCostTitanX || '0') / 1e18), 0);
    const totalETH = dayStakes.reduce((sum, s) => sum + (parseFloat(s.rawCostETH || '0') / 1e18), 0);
    
    console.log(`\nDay ${day}:`);
    console.log(`  Total stakes: ${dayStakes.length}`);
    console.log(`  With TitanX: ${withTitanX} (${totalTitanX.toLocaleString()} TitanX)`);
    console.log(`  With ETH: ${withETH} (${totalETH.toFixed(4)} ETH)`);
  });
}

fixDays13And14Stakes().catch(console.error);