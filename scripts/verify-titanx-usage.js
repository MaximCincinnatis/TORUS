const { ethers } = require('ethers');

async function verifyTitanXUsage() {
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  
  // Contract addresses
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  // ABIs for events
  const contractABI = [
    'event Created(address indexed user, uint256 stakeIndex, uint256 torusAmount, uint256 endTime)',
    'event Staked(address indexed user, uint256 stakeIndex, uint256 principal, uint256 stakingDays, uint256 shares)',
    'function userStakes(address user, uint256 index) view returns (uint256 principal, uint256 shares, uint256 duration, uint256 timestamp, bool claimedCreate, bool claimedStake, uint256 costETH, uint256 costTitanX)'
  ];
  
  const contract = new ethers.Contract(CREATE_STAKE_CONTRACT, contractABI, provider);
  
  // Day 13-14 block ranges (approximate)
  // July 22: blocks around 22963000-22966500
  // July 23: blocks around 22966500-22970000
  
  console.log('Verifying Day 13-14 TitanX usage on blockchain...\n');
  
  // Get some sample events from Day 13
  console.log('Checking Day 13 (July 22) Creates...');
  const day13CreateFilter = contract.filters.Created();
  const day13Creates = await contract.queryFilter(day13CreateFilter, 22963000, 22964000);
  
  console.log(`Found ${day13Creates.length} creates in sample block range`);
  
  // Check a few creates for TitanX usage
  for (let i = 0; i < Math.min(5, day13Creates.length); i++) {
    const event = day13Creates[i];
    const user = event.args.user;
    const stakeIndex = event.args.stakeIndex;
    
    try {
      // Get the stake details to see if TitanX was used
      const stakeDetails = await contract.userStakes(user, stakeIndex);
      console.log(`  User: ${user.slice(0,10)}... StakeIndex: ${stakeIndex}`);
      console.log(`    CostETH: ${ethers.utils.formatEther(stakeDetails.costETH)} ETH`);
      console.log(`    CostTitanX: ${ethers.utils.formatEther(stakeDetails.costTitanX)} TitanX`);
    } catch (e) {
      console.log(`  Error reading stake ${stakeIndex}: ${e.message}`);
    }
  }
  
  // Check Day 13 Stakes
  console.log('\nChecking Day 13 Stakes...');
  const day13StakeFilter = contract.filters.Staked();
  const day13Stakes = await contract.queryFilter(day13StakeFilter, 22963000, 22964000);
  
  console.log(`Found ${day13Stakes.length} stakes in sample block range`);
  
  for (let i = 0; i < Math.min(3, day13Stakes.length); i++) {
    const event = day13Stakes[i];
    const user = event.args.user;
    const stakeIndex = event.args.stakeIndex;
    
    try {
      const stakeDetails = await contract.userStakes(user, stakeIndex);
      console.log(`  User: ${user.slice(0,10)}... StakeIndex: ${stakeIndex}`);
      console.log(`    CostETH: ${ethers.utils.formatEther(stakeDetails.costETH)} ETH`);
      console.log(`    CostTitanX: ${ethers.utils.formatEther(stakeDetails.costTitanX)} TitanX`);
    } catch (e) {
      console.log(`  Error reading stake ${stakeIndex}: ${e.message}`);
    }
  }
  
  console.log('\nConclusion: Checking actual blockchain data for Day 13-14 events...');
}

verifyTitanXUsage().catch(console.error);