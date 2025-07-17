const { ethers } = require('ethers');
const fs = require('fs');

console.log('🔧 FETCHING MISSING REWARD POOL DAYS 1-7');
console.log('==========================================');

// Working RPC providers
const WORKING_RPC_PROVIDERS = [
  'https://eth.drpc.org',
  'https://rpc.payload.de',
  'https://eth-mainnet.public.blastapi.io',
  'https://rpc.flashbots.net',
  'https://ethereum.publicnode.com'
];

const STAKE_CONTRACT_ABI = [
  'function getCurrentDayIndex() view returns (uint24)',
  'function rewardPool(uint24 day) view returns (uint256)',
  'function totalShares(uint24 day) view returns (uint256)',
  'function penaltiesInRewardPool(uint24 day) view returns (uint256)',
];

const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';

async function getWorkingProvider() {
  for (const rpcUrl of WORKING_RPC_PROVIDERS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      const blockNumber = await provider.getBlockNumber();
      console.log(`✅ Connected to ${rpcUrl} - Block: ${blockNumber}`);
      return provider;
    } catch (error) {
      console.log(`❌ Failed ${rpcUrl}: ${error.message}`);
    }
  }
  throw new Error('All RPC providers failed');
}

async function fetchMissingDays() {
  try {
    const provider = await getWorkingProvider();
    const contract = new ethers.Contract(CREATE_STAKE_CONTRACT, STAKE_CONTRACT_ABI, provider);
    
    // Get current protocol day
    const currentDay = await contract.getCurrentDayIndex();
    console.log(`📅 Current protocol day: ${currentDay}`);
    
    // Load existing cached data
    const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
    
    // Create backup
    const backupPath = `public/data/backups/cached-data-before-missing-days-${new Date().toISOString().replace(/:/g, '-')}.json`;
    fs.writeFileSync(backupPath, JSON.stringify(cachedData, null, 2));
    console.log(`📁 Backup created: ${backupPath}`);
    
    // Fetch missing days 1-7
    const missingDays = [1, 2, 3, 4, 5, 6, 7];
    const missingDaysData = [];
    
    console.log('📊 Fetching missing days...');
    
    for (const day of missingDays) {
      try {
        console.log(`  Getting data for day ${day}...`);
        
        const [rewardPool, totalShares, penalties] = await Promise.all([
          contract.rewardPool(day).catch(() => ethers.BigNumber.from(0)),
          contract.totalShares(day).catch(() => ethers.BigNumber.from(0)),
          contract.penaltiesInRewardPool(day).catch(() => ethers.BigNumber.from(0))
        ]);
        
        const dayData = {
          day: day,
          rewardPool: parseFloat(ethers.utils.formatEther(rewardPool)),
          totalShares: parseFloat(ethers.utils.formatEther(totalShares)),
          penaltiesInPool: parseFloat(ethers.utils.formatEther(penalties))
        };
        
        missingDaysData.push(dayData);
        
        console.log(`    Day ${day}: Reward pool ${dayData.rewardPool.toFixed(6)} TORUS, Total shares: ${dayData.totalShares.toFixed(0)}`);
        
      } catch (error) {
        console.log(`    ❌ Error getting data for day ${day}: ${error.message}`);
        // Add zero data for this day
        missingDaysData.push({
          day: day,
          rewardPool: 0,
          totalShares: 0,
          penaltiesInPool: 0
        });
      }
    }
    
    // Merge with existing data
    const existingRewardPoolData = cachedData.rewardPoolData || [];
    const mergedData = [...missingDaysData, ...existingRewardPoolData];
    
    // Sort by day
    mergedData.sort((a, b) => a.day - b.day);
    
    // Update cached data
    cachedData.rewardPoolData = mergedData;
    cachedData.stakingData.rewardPoolData = mergedData;
    cachedData.lastUpdated = new Date().toISOString();
    
    // Save updated data
    fs.writeFileSync('public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
    
    console.log('✅ Updated cached data with missing days');
    console.log(`📊 Total reward pool entries: ${mergedData.length}`);
    
    // Show summary of missing days
    console.log('\n📋 MISSING DAYS SUMMARY:');
    missingDaysData.forEach(day => {
      console.log(`Day ${day.day}: ${day.rewardPool.toFixed(6)} TORUS reward pool`);
    });
    
    // Check if we now have the expected decreasing pattern
    console.log('\n📉 REWARD POOL DECREASE PATTERN:');
    const nonZeroRewards = mergedData.filter(day => day.rewardPool > 0);
    console.log(`Days with non-zero reward pools: ${nonZeroRewards.length}`);
    
    if (nonZeroRewards.length > 1) {
      for (let i = 1; i < nonZeroRewards.length; i++) {
        const prev = nonZeroRewards[i-1];
        const curr = nonZeroRewards[i];
        const decrease = prev.rewardPool - curr.rewardPool;
        const decreasePercent = (decrease / prev.rewardPool) * 100;
        console.log(`Day ${prev.day} to ${curr.day}: ${prev.rewardPool.toFixed(6)} → ${curr.rewardPool.toFixed(6)} (${decrease.toFixed(6)} decrease, ${decreasePercent.toFixed(3)}%)`);
      }
    }
    
    console.log('\n🔄 Refresh your dashboard to see the updated chart with missing days!');
    
  } catch (error) {
    console.error('❌ Error fetching missing days:', error);
  }
}

fetchMissingDays();