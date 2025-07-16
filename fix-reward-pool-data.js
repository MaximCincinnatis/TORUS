// Fix missing reward pool data in cached data
const ethers = require('ethers');
const fs = require('fs');

console.log('🔧 FIXING REWARD POOL DATA...');

// Contract setup
const provider = new ethers.providers.JsonRpcProvider('https://eth-mainnet.g.alchemy.com/v2/NXKKZWXJqNYLdXjFXjcZxNQJMbCfPgZ5');

const createStakeContractABI = [
  "function rewardPool(uint256 day) view returns (uint256)",
  "function totalShares(uint256 day) view returns (uint256)",
  "function penaltiesInRewardPool(uint256 day) view returns (uint256)",
  "function getCurrentDayIndex() view returns (uint256)"
];

const createStakeContract = new ethers.Contract(
  '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507',
  createStakeContractABI,
  provider
);

async function fetchRewardPoolData() {
  try {
    console.log('📡 Getting current protocol day...');
    const currentDay = await createStakeContract.getCurrentDayIndex();
    const currentDayNum = Number(currentDay);
    
    console.log(`📅 Current protocol day: ${currentDayNum}`);
    
    // Fetch reward pool data for next 88 days (current day + 88)
    const rewardPoolData = [];
    const startDay = currentDayNum;
    const endDay = currentDayNum + 88;
    
    console.log(`📊 Fetching reward pool data for days ${startDay} to ${endDay}...`);
    
    for (let day = startDay; day <= endDay; day++) {
      try {
        console.log(`  Getting data for day ${day}...`);
        
        const [rewardPool, totalShares, penalties] = await Promise.all([
          createStakeContract.rewardPool(day),
          createStakeContract.totalShares(day),
          createStakeContract.penaltiesInRewardPool(day)
        ]);
        
        const dayData = {
          day: day,
          rewardPool: rewardPool.toString(),
          totalShares: totalShares.toString(),
          penalties: penalties.toString(),
          dailyRewardRate: totalShares.gt(0) ? rewardPool.div(totalShares).toString() : "0"
        };
        
        rewardPoolData.push(dayData);
        
        if (day % 10 === 0) {
          console.log(`    Day ${day}: Reward pool ${ethers.utils.formatEther(rewardPool)} TORUS, Total shares: ${ethers.utils.formatEther(totalShares)}`);
        }
        
      } catch (error) {
        console.log(`    ❌ Error getting data for day ${day}: ${error.message}`);
        // Add empty data for this day
        rewardPoolData.push({
          day: day,
          rewardPool: "0",
          totalShares: "0",
          penalties: "0",
          dailyRewardRate: "0"
        });
      }
    }
    
    console.log(`✅ Fetched reward pool data for ${rewardPoolData.length} days`);
    
    // Update cached data
    const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
    cachedData.stakingData.rewardPoolData = rewardPoolData;
    cachedData.stakingData.currentProtocolDay = currentDayNum;
    cachedData.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync('public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
    
    console.log('✅ Updated cached data with reward pool data');
    console.log(`📊 Total reward pool entries: ${rewardPoolData.length}`);
    
    // Show summary
    const nonZeroRewards = rewardPoolData.filter(day => day.rewardPool !== "0");
    console.log(`📊 Days with rewards: ${nonZeroRewards.length}`);
    
    if (nonZeroRewards.length > 0) {
      const totalRewards = nonZeroRewards.reduce((sum, day) => sum + parseFloat(ethers.utils.formatEther(day.rewardPool)), 0);
      console.log(`💰 Total rewards in pool: ${totalRewards.toFixed(4)} TORUS`);
    }
    
    console.log('🔄 Refresh localhost to see updated release schedule chart');
    
  } catch (error) {
    console.error('❌ Error fetching reward pool data:', error);
  }
}

fetchRewardPoolData();