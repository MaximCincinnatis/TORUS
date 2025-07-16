const ethers = require('ethers');

const CONTRACT_ADDRESS = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
const RPC_URL = 'https://eth.drpc.org';

async function analyzeStakeEvents() {
  console.log('🔍 Analyzing real stake events to deduce CREATE_CYCLE_DURATION...\n');
  
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  
  // Get the full contract ABI to check all functions
  const contractAbi = [
    'event Staked(address indexed user, uint256 indexed id, uint256 amount, uint256 shares, uint16 indexed duration, uint256 timestamp)',
    'event StakeEnded(address indexed user, uint256 indexed id, uint256 amount, uint256 shares, uint256 penalties, uint256 timestamp)',
    'function getUserStake(address user, uint256 id) external view returns (uint256 amount, uint256 shares, uint16 duration, uint256 timestamp, uint256 endTime)',
    'function getStakeCount(address user) external view returns (uint256)',
    'function currentDay() external view returns (uint256)'
  ];
  
  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi, provider);
  
  // Get recent stake events
  const currentBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(currentBlock - 5000, 22890272); // Contract deployment block
  
  console.log(`Searching for events from block ${fromBlock} to ${currentBlock}...`);
  
  const [stakeEvents, stakeEndEvents] = await Promise.all([
    contract.queryFilter(contract.filters.Staked(), fromBlock, currentBlock),
    contract.queryFilter(contract.filters.StakeEnded(), fromBlock, currentBlock)
  ]);
  
  console.log(`Found ${stakeEvents.length} stake events and ${stakeEndEvents.length} stake end events`);
  
  // Try to get current protocol day
  try {
    const currentDay = await contract.currentDay();
    console.log(`Current protocol day: ${currentDay.toString()}`);
  } catch (e) {
    console.log('Could not get current protocol day');
  }
  
  // Analyze stake end events to determine actual cycle duration
  if (stakeEndEvents.length > 0) {
    console.log('\n🎯 ANALYZING STAKE END EVENTS (ACTUAL PROOF):');
    
    for (let i = 0; i < Math.min(5, stakeEndEvents.length); i++) {
      const endEvent = stakeEndEvents[i];
      const endTimestamp = endEvent.args.timestamp.toNumber();
      const userId = endEvent.args.user;
      const stakeId = endEvent.args.id.toNumber();
      
      // Find the corresponding stake start event
      const startEvent = stakeEvents.find(e => 
        e.args.user === userId && e.args.id.toNumber() === stakeId
      );
      
      if (startEvent) {
        const startTimestamp = startEvent.args.timestamp.toNumber();
        const duration = startEvent.args.duration.toNumber();
        const actualDuration = endTimestamp - startTimestamp;
        const cycleDuration = actualDuration / duration;
        
        console.log(`\nStake ${i}:`);
        console.log(`  User: ${userId}`);
        console.log(`  ID: ${stakeId}`);
        console.log(`  Start: ${startTimestamp} (${new Date(startTimestamp * 1000).toISOString()})`);
        console.log(`  End: ${endTimestamp} (${new Date(endTimestamp * 1000).toISOString()})`);
        console.log(`  Duration param: ${duration} "days"`);
        console.log(`  Actual seconds: ${actualDuration}`);
        console.log(`  🔑 CYCLE_DURATION: ${cycleDuration} seconds (${cycleDuration/3600} hours)`);
      }
    }
  } else {
    console.log('\n⚠️  No stake end events found - stakes may still be active');
    
    // Try to query individual stakes to get endTime
    console.log('\n🔍 Trying to get stake details from contract...');
    
    const sampleStakes = stakeEvents.slice(0, 3);
    
    for (let i = 0; i < sampleStakes.length; i++) {
      const event = sampleStakes[i];
      const user = event.args.user;
      const id = event.args.id;
      
      try {
        const stakeData = await contract.getUserStake(user, id);
        const [amount, shares, duration, timestamp, endTime] = stakeData;
        
        const startTime = timestamp.toNumber();
        const endTimestamp = endTime.toNumber();
        const durationDays = duration.toNumber();
        
        const actualDuration = endTimestamp - startTime;
        const cycleDuration = actualDuration / durationDays;
        
        console.log(`\nStake ${i}:`);
        console.log(`  User: ${user}`);
        console.log(`  Start: ${startTime} (${new Date(startTime * 1000).toISOString()})`);
        console.log(`  End: ${endTimestamp} (${new Date(endTimestamp * 1000).toISOString()})`);
        console.log(`  Duration: ${durationDays} "days"`);
        console.log(`  Actual seconds: ${actualDuration}`);
        console.log(`  🔑 CYCLE_DURATION: ${cycleDuration} seconds (${cycleDuration/3600} hours)`);
        
        // Check if this matches our known constants
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
        console.log(`  ❌ Could not get stake ${i} data: ${e.message}`);
      }
    }
  }
}

analyzeStakeEvents().catch(console.error);