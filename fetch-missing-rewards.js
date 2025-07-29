// Fetch missing reward data from contract

const fs = require('fs');
const { ethers } = require('ethers');

const STAKE_CONTRACT_ADDRESS = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
const STAKE_CONTRACT_ABI = [
  'function getCurrentDayIndex() view returns (uint24)',
  'function rewardPool(uint24 day) view returns (uint256)',
  'function totalShares(uint24 day) view returns (uint256)',
  'function penaltiesInRewardPool(uint24 day) view returns (uint256)',
];

const WORKING_RPC_PROVIDERS = [
  'https://eth.drpc.org',
  'https://rpc.payload.de',
  'https://eth-mainnet.public.blastapi.io',
  'https://ethereum.publicnode.com'
];

async function getWorkingProvider() {
  for (const rpcUrl of WORKING_RPC_PROVIDERS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      await provider.getBlockNumber();
      console.log(`✅ Connected to ${rpcUrl}`);
      return provider;
    } catch (error) {
      console.log(`❌ Failed to connect to ${rpcUrl}`);
    }
  }
  throw new Error('No working RPC provider found');
}

async function fetchMissingRewards() {
  console.log('🔧 FETCHING MISSING REWARD DATA');
  console.log('===============================');
  
  try {
    // Read existing data
    const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
    
    // Backup
    const backupPath = `public/data/cached-data-backup-${Date.now()}.json`;
    fs.writeFileSync(backupPath, JSON.stringify(cachedData, null, 2));
    console.log(`✅ Backup saved to ${backupPath}`);
    
    const provider = await getWorkingProvider();
    const contract = new ethers.Contract(STAKE_CONTRACT_ADDRESS, STAKE_CONTRACT_ABI, provider);
    
    const currentDay = await contract.getCurrentDayIndex();
    console.log(`Current protocol day: ${currentDay}`);
    
    const rewardPoolData = cachedData.stakingData.rewardPoolData || [];
    
    // Find missing days
    const missingDays = [];
    for (let day = 1; day <= Math.min(currentDay + 100, 365); day++) {
      const existing = rewardPoolData.find(d => d.day === day);
      if (!existing || existing.rewardPool === 0) {
        missingDays.push(day);
      }
    }
    
    console.log(`Found ${missingDays.length} days with missing rewards`);
    console.log('Missing days:', missingDays.slice(0, 20).join(', '), '...');
    
    // Fetch in batches
    const batchSize = 10;
    let updated = 0;
    
    for (let i = 0; i < missingDays.length; i += batchSize) {
      const batch = missingDays.slice(i, i + batchSize);
      console.log(`\nFetching days ${batch[0]}-${batch[batch.length - 1]}...`);
      
      const promises = batch.map(async (day) => {
        try {
          const [rewardPool, totalShares, penalties] = await Promise.all([
            contract.rewardPool(day),
            contract.totalShares(day),
            contract.penaltiesInRewardPool(day)
          ]);
          
          // Convert from wei
          const rewardDecimal = parseFloat(ethers.utils.formatEther(rewardPool));
          const sharesDecimal = parseFloat(ethers.utils.formatEther(totalShares));
          const penaltiesDecimal = parseFloat(ethers.utils.formatEther(penalties));
          
          return {
            day,
            rewardPool: rewardDecimal,
            totalShares: sharesDecimal,
            penaltiesInPool: penaltiesDecimal
          };
        } catch (error) {
          console.error(`Error fetching day ${day}:`, error.message);
          return null;
        }
      });
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        if (result) {
          // Update or add
          const existingIndex = rewardPoolData.findIndex(d => d.day === result.day);
          if (existingIndex >= 0) {
            rewardPoolData[existingIndex] = {
              ...rewardPoolData[existingIndex],
              ...result,
              lastUpdated: new Date().toISOString()
            };
          } else {
            rewardPoolData.push({
              ...result,
              lastUpdated: new Date().toISOString()
            });
          }
          
          if (result.rewardPool > 0) {
            console.log(`  Day ${result.day}: ${result.rewardPool.toFixed(2)} TORUS reward found ✅`);
            updated++;
          }
        }
      });
      
      // Rate limit
      if (i + batchSize < missingDays.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Sort by day
    rewardPoolData.sort((a, b) => a.day - b.day);
    
    // Update cached data
    cachedData.stakingData.rewardPoolData = rewardPoolData;
    cachedData.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync('public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
    
    console.log(`\n✅ Updated ${updated} days with reward data`);
    
    // Verify
    const day18 = rewardPoolData.find(d => d.day === 18);
    const day88 = rewardPoolData.find(d => d.day === 88);
    console.log('\n📊 Verification:');
    console.log(`Day 18: ${day18 ? day18.rewardPool.toFixed(2) : 'Not found'} TORUS`);
    console.log(`Day 88: ${day88 ? day88.rewardPool.toFixed(2) : 'Not found'} TORUS`);
    
    // Calculate total rewards now available
    const totalRewards = rewardPoolData.reduce((sum, d) => sum + d.rewardPool, 0);
    console.log(`Total rewards in pool: ${totalRewards.toFixed(2)} TORUS`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fetchMissingRewards().catch(console.error);