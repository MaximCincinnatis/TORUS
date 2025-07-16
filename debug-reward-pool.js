// Debug reward pool functions
const { ethers } = require('ethers');

async function debugRewardPool() {
  console.log('🔍 DEBUGGING REWARD POOL FUNCTIONS');
  console.log('==================================');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  // Try different function signatures
  const ABI_VARIATIONS = [
    // Original
    ['function rewardPool(uint24 day) view returns (uint256)'],
    // Alternative signatures
    ['function rewardPool(uint256 day) view returns (uint256)'],
    ['function getRewardPool(uint24 day) view returns (uint256)'],
    ['function getRewardPool(uint256 day) view returns (uint256)'],
    ['function rewardPoolSupply() view returns (uint256)'],
    ['function totalRewardPool() view returns (uint256)']
  ];
  
  console.log('Testing different function signatures...\n');
  
  for (const abi of ABI_VARIATIONS) {
    try {
      const contract = new ethers.Contract(CREATE_STAKE_CONTRACT, abi, provider);
      const functionName = abi[0].match(/function (\w+)/)[1];
      
      console.log(`Testing: ${functionName}`);
      
      if (functionName.includes('Supply') || functionName.includes('total')) {
        // No parameters
        const result = await contract[functionName]();
        console.log(`  ✅ Success! Result: ${ethers.utils.formatEther(result)} TORUS`);
      } else {
        // Try with day parameter
        const result = await contract[functionName](6);
        console.log(`  ✅ Success! Day 6 result: ${ethers.utils.formatEther(result)} TORUS`);
      }
    } catch (error) {
      console.log(`  ❌ Failed: ${error.message.substring(0, 50)}...`);
    }
  }
  
  // Also check if rewards are stored differently
  console.log('\n🔍 Checking contract for reward-related functions...');
  
  const EXPLORATION_ABI = [
    'function getCurrentDayIndex() view returns (uint24)',
    'function protocolStart() view returns (uint256)',
    'function dailyRewards(uint256) view returns (uint256)',
    'function rewardsByDay(uint256) view returns (uint256)',
    'function getRewards(address user) view returns (uint256)'
  ];
  
  const contract = new ethers.Contract(CREATE_STAKE_CONTRACT, EXPLORATION_ABI, provider);
  
  try {
    const currentDay = await contract.getCurrentDayIndex();
    console.log(`\nCurrent protocol day: ${currentDay}`);
    
    const protocolStart = await contract.protocolStart();
    console.log(`Protocol start: ${new Date(protocolStart * 1000).toISOString()}`);
  } catch (e) {
    console.log('Could not get protocol info');
  }
}

debugRewardPool().catch(console.error);