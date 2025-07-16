const fs = require('fs');
const ethers = require('ethers');

const CACHE_FILE = './public/data/cached-data.json';
const RPC_URL = 'https://eth.drpc.org';
const CONTRACTS = {
  TORUS_CREATE_STAKE: '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507'
};

async function refreshStakingData() {
  console.log('🔄 Refreshing staking data...');
  
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const currentBlock = await provider.getBlockNumber();
  
  // Load current data
  const cachedData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  
  console.log(`Current stakes: ${cachedData.stakingData?.stakeEvents?.length || 0}`);
  console.log(`Current creates: ${cachedData.stakingData?.createEvents?.length || 0}`);
  
  // Get deployment block
  const deploymentBlock = 22890272;
  const lastCheckedBlock = cachedData.stakingData?.lastBlock || deploymentBlock;
  
  console.log(`Fetching from block ${lastCheckedBlock + 1} to ${currentBlock}`);
  
  const contractABI = [
    'event Staked(address indexed user, uint256 indexed id, uint256 amount, uint256 shares, uint16 indexed duration, uint256 timestamp)',
    'event Created(address indexed user, uint256 indexed createId, uint256 amount, uint256 shares, uint16 indexed duration, uint256 rewardDay, uint256 timestamp, address referrer)'
  ];
  
  const contract = new ethers.Contract(CONTRACTS.TORUS_CREATE_STAKE, contractABI, provider);
  
  // Fetch in chunks
  const MAX_BLOCK_RANGE = 5000;
  let allStakeEvents = [];
  let allCreateEvents = [];
  
  for (let fromBlock = lastCheckedBlock + 1; fromBlock <= currentBlock; fromBlock += MAX_BLOCK_RANGE) {
    const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, currentBlock);
    console.log(`  Fetching blocks ${fromBlock} to ${toBlock}...`);
    
    try {
      const [stakeEvents, createEvents] = await Promise.all([
        contract.queryFilter(contract.filters.Staked(), fromBlock, toBlock),
        contract.queryFilter(contract.filters.Created(), fromBlock, toBlock)
      ]);
      
      console.log(`    Found ${stakeEvents.length} stakes, ${createEvents.length} creates`);
      allStakeEvents.push(...stakeEvents);
      allCreateEvents.push(...createEvents);
    } catch (e) {
      console.error(`  Error fetching blocks ${fromBlock}-${toBlock}:`, e.message);
    }
  }
  
  console.log(`\nTotal new events: ${allStakeEvents.length} stakes, ${allCreateEvents.length} creates`);
  
  if (allStakeEvents.length > 0 || allCreateEvents.length > 0) {
    // Process new stakes
    const newStakes = allStakeEvents.map(event => {
      const maturityTimestamp = parseInt(event.args.timestamp.toString()) + (parseInt(event.args.duration.toString()) * 86400);
      const maturityDate = new Date(maturityTimestamp * 1000).toISOString();
      
      return {
        user: event.args.user,
        id: event.args.id.toString(),
        principal: ethers.utils.formatEther(event.args.amount),
        shares: event.args.shares.toString(),
        duration: event.args.duration.toString(),
        timestamp: event.args.timestamp.toString(),
        maturityDate: maturityDate,
        blockNumber: event.blockNumber,
        stakingDays: parseInt(event.args.duration.toString()),
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
    
    // Process new creates
    const newCreates = allCreateEvents.map(event => ({
      user: event.args.user,
      createId: event.args.createId.toString(),
      principal: ethers.utils.formatEther(event.args.amount),
      shares: event.args.shares.toString(),
      duration: event.args.duration.toString(),
      rewardDay: event.args.rewardDay.toString(),
      timestamp: event.args.timestamp.toString(),
      referrer: event.args.referrer,
      blockNumber: event.blockNumber,
      id: event.args.createId.toString(),
      stakingDays: parseInt(event.args.duration.toString()),
      power: "0",
      claimedCreate: false,
      claimedStake: false,
      costETH: "0",
      costTitanX: "0",
      rawCostETH: "0",
      rawCostTitanX: "0"
    }));
    
    // Merge with existing data
    cachedData.stakingData.stakeEvents = [
      ...(cachedData.stakingData.stakeEvents || []),
      ...newStakes
    ];
    
    cachedData.stakingData.createEvents = [
      ...(cachedData.stakingData.createEvents || []),
      ...newCreates
    ];
  }
  
  // Update metadata
  cachedData.stakingData.metadata = {
    ...cachedData.stakingData.metadata,
    currentBlock: currentBlock,
    lastUpdate: new Date().toISOString()
  };
  cachedData.stakingData.lastBlock = currentBlock;
  
  // Update main timestamp
  cachedData.lastUpdated = new Date().toISOString();
  
  // Save
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cachedData, null, 2));
  
  console.log('\n✅ Staking data refreshed!');
  console.log(`Total stakes: ${cachedData.stakingData.stakeEvents.length}`);
  console.log(`Total creates: ${cachedData.stakingData.createEvents.length}`);
}

refreshStakingData().catch(console.error);