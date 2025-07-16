const ethers = require('ethers');
const fs = require('fs');

const CONTRACT_ADDRESS = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
const RPC_URL = 'https://eth.drpc.org';

async function queryExistingStakes() {
  console.log('🔍 Querying existing stakes from cached data...\n');
  
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  
  // Load our cached stakes
  const data = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
  const stakes = data.stakingData?.stakeEvents || [];
  
  console.log(`Found ${stakes.length} stakes in cached data`);
  
  const contractAbi = [
    'function getUserStake(address user, uint256 id) external view returns (uint256 amount, uint256 shares, uint16 duration, uint256 timestamp, uint256 endTime)',
    'function getStakeCount(address user) external view returns (uint256)',
    'function currentDay() external view returns (uint256)'
  ];
  
  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi, provider);
  
  // Try to get current protocol day
  try {
    const currentDay = await contract.currentDay();
    console.log(`Current protocol day: ${currentDay.toString()}`);
  } catch (e) {
    console.log('Could not get current protocol day');
  }
  
  // Query a few stakes to get their actual endTime
  const sampleStakes = stakes.slice(0, 5);
  
  for (let i = 0; i < sampleStakes.length; i++) {
    const stake = sampleStakes[i];
    const user = stake.user;
    const id = stake.id;
    
    console.log(`\nQuerying stake ${i} (User: ${user}, ID: ${id})...`);
    
    try {
      const stakeData = await contract.getUserStake(user, id);
      const [amount, shares, duration, timestamp, endTime] = stakeData;
      
      const startTime = timestamp.toNumber();
      const endTimestamp = endTime.toNumber();
      const durationDays = duration.toNumber();
      
      const actualDuration = endTimestamp - startTime;
      const cycleDuration = actualDuration / durationDays;
      
      console.log(`  Amount: ${ethers.utils.formatEther(amount)} TORUS`);
      console.log(`  Shares: ${shares.toString()}`);
      console.log(`  Duration: ${durationDays} "days"`);
      console.log(`  Start: ${startTime} (${new Date(startTime * 1000).toISOString()})`);
      console.log(`  End: ${endTimestamp} (${new Date(endTimestamp * 1000).toISOString()})`);
      console.log(`  Actual seconds: ${actualDuration}`);
      console.log(`  🔑 CYCLE_DURATION: ${cycleDuration} seconds (${cycleDuration/3600} hours)`);
      
      // Compare with our cached maturityDate
      if (stake.maturityDate) {
        const cachedMaturity = new Date(stake.maturityDate).getTime() / 1000;
        const contractMaturity = endTimestamp;
        const diff = Math.abs(cachedMaturity - contractMaturity);
        
        console.log(`  Cached maturity: ${stake.maturityDate}`);
        console.log(`  Contract maturity: ${new Date(endTimestamp * 1000).toISOString()}`);
        console.log(`  Difference: ${diff} seconds ${diff === 0 ? '✅ MATCH' : '❌ MISMATCH'}`);
      }
      
      // Check standard durations
      if (cycleDuration === 86400) {
        console.log(`  ✅ This matches 1 day (86400 seconds)`);
      } else if (cycleDuration === 21600) {
        console.log(`  ✅ This matches 6 hours (21600 seconds)`);
      } else if (cycleDuration === 3600) {
        console.log(`  ✅ This matches 1 hour (3600 seconds)`);
      } else {
        console.log(`  🤔 This is a custom duration: ${cycleDuration} seconds`);
      }
      
    } catch (e) {
      console.log(`  ❌ Could not get stake data: ${e.message}`);
      
      // Try to get stake count for this user
      try {
        const stakeCount = await contract.getStakeCount(user);
        console.log(`  User has ${stakeCount.toString()} stakes`);
      } catch (e2) {
        console.log(`  Could not get stake count: ${e2.message}`);
      }
    }
  }
  
  // Also try to find recent stake events from deployment
  console.log('\n🔍 Searching for stake events from deployment...');
  
  const deploymentBlock = 22890272;
  const currentBlock = await provider.getBlockNumber();
  
  const stakeEventAbi = [
    'event Staked(address indexed user, uint256 indexed id, uint256 amount, uint256 shares, uint16 indexed duration, uint256 timestamp)'
  ];
  
  const eventContract = new ethers.Contract(CONTRACT_ADDRESS, stakeEventAbi, provider);
  
  try {
    // Search in chunks
    const chunkSize = 10000;
    for (let fromBlock = deploymentBlock; fromBlock < currentBlock; fromBlock += chunkSize) {
      const toBlock = Math.min(fromBlock + chunkSize - 1, currentBlock);
      
      console.log(`  Searching blocks ${fromBlock} to ${toBlock}...`);
      
      const events = await eventContract.queryFilter(eventContract.filters.Staked(), fromBlock, toBlock);
      
      if (events.length > 0) {
        console.log(`  Found ${events.length} stake events!`);
        
        // Take the first event and verify it matches our cached data
        const firstEvent = events[0];
        const eventUser = firstEvent.args.user;
        const eventId = firstEvent.args.id.toString();
        const eventTimestamp = firstEvent.args.timestamp.toNumber();
        const eventDuration = firstEvent.args.duration.toNumber();
        
        console.log(`  First event: User=${eventUser}, ID=${eventId}, Timestamp=${eventTimestamp}, Duration=${eventDuration}`);
        
        // Find this in our cached data
        const cachedStake = stakes.find(s => s.user === eventUser && s.id === eventId);
        if (cachedStake) {
          console.log(`  ✅ Found matching cached stake`);
          console.log(`  Cached timestamp: ${cachedStake.timestamp}`);
          console.log(`  Event timestamp: ${eventTimestamp}`);
          console.log(`  Match: ${cachedStake.timestamp === eventTimestamp.toString() ? '✅' : '❌'}`);
        }
        
        break; // Found events, no need to search more
      }
    }
  } catch (e) {
    console.log(`  Error searching events: ${e.message}`);
  }
}

queryExistingStakes().catch(console.error);