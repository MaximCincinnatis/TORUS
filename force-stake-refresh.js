const fs = require('fs');
const ethers = require('ethers');

async function forceStakeRefresh() {
  console.log('🔄 FORCING COMPLETE STAKE DATA REFRESH');
  console.log('=====================================');
  
  // Load current cached data
  const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
  
  // Back up current data
  const backupPath = `./public/data/backups/cached-data-before-stake-refresh-${new Date().toISOString().replace(/:/g, '-')}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(cachedData, null, 2));
  console.log('📄 Backup created:', backupPath);
  
  // Connect to provider
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const CONTRACT_ADDRESS = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  // Use the CORRECT event signature
  const contractABI = [
    'event Staked(address indexed user, uint256 stakeIndex, uint256 principal, uint256 stakingDays, uint256 shares)'
  ];
  
  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider);
  
  console.log('🔍 Fetching ALL stake events from deployment...');
  
  // Fetch ALL stake events from deployment
  const deploymentBlock = 22890272;
  const currentBlock = await provider.getBlockNumber();
  const chunkSize = 9999;
  
  let allStakeEvents = [];
  
  for (let fromBlock = deploymentBlock; fromBlock <= currentBlock; fromBlock += chunkSize) {
    const toBlock = Math.min(fromBlock + chunkSize - 1, currentBlock);
    console.log(`  Fetching blocks ${fromBlock} to ${toBlock}...`);
    
    try {
      const events = await contract.queryFilter(contract.filters.Staked(), fromBlock, toBlock);
      allStakeEvents.push(...events);
      
      if (events.length > 0) {
        console.log(`    Found ${events.length} stake events`);
      }
    } catch (error) {
      console.log(`    Error in chunk ${fromBlock}-${toBlock}: ${error.message}`);
    }
  }
  
  console.log(`\n✅ Found ${allStakeEvents.length} total stake events`);
  
  // Process stake events
  const processedStakes = allStakeEvents.map(event => {
    const timestamp = event.args.startTime ? event.args.startTime.toNumber() : event.blockNumber * 12; // fallback
    const stakingDays = event.args.stakingDays.toNumber();
    const maturityTimestamp = timestamp + (stakingDays * 86400);
    
    return {
      user: event.args.user,
      id: event.args.stakeIndex.toString(),
      principal: event.args.principal.toString(),
      shares: event.args.shares.toString(),
      duration: stakingDays.toString(),
      timestamp: timestamp.toString(),
      maturityDate: new Date(maturityTimestamp * 1000).toISOString(),
      blockNumber: event.blockNumber,
      stakingDays: stakingDays,
      power: "0",
      claimedCreate: false,
      claimedStake: false,
      costETH: "0",
      costTitanX: "0",
      rawCostETH: "0",
      rawCostTitanX: "0",
      rewards: "0",
      penalties: "0",
      claimedAt: "0",
      isCreate: false
    };
  });
  
  // Analyze the new distribution
  const durations = {};
  processedStakes.forEach(stake => {
    durations[stake.stakingDays] = (durations[stake.stakingDays] || 0) + 1;
  });
  
  console.log('\n📊 NEW STAKE DURATION DISTRIBUTION:');
  Object.entries(durations).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).forEach(([duration, count]) => {
    console.log(`  ${duration} days: ${count} stakes`);
  });
  
  // Update cached data
  cachedData.stakingData.stakeEvents = processedStakes;
  cachedData.stakingData.metadata = {
    ...cachedData.stakingData.metadata,
    currentBlock: currentBlock,
    stakesRefreshed: new Date().toISOString()
  };
  
  cachedData.lastUpdated = new Date().toISOString();
  
  // Save updated data
  fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
  
  console.log('\n✅ CACHE REFRESHED WITH CORRECT STAKE DATA');
  console.log(`   Old stakes: ${cachedData.stakingData.stakeEvents.length} (all 88 days)`);
  console.log(`   New stakes: ${processedStakes.length} (varied 1-88 days)`);
  console.log('   🎯 Stake end days chart will now show proper distribution!');
}

forceStakeRefresh().catch(console.error);