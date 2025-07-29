// SAFE FIX: Only update reward pool data for Days 89+ without rebuilding entire JSON

const fs = require('fs');
const { ethers } = require('ethers');

// Contract configuration
const STAKE_CONTRACT_ADDRESS = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
const STAKE_CONTRACT_ABI = [
  'function getCurrentDayIndex() view returns (uint24)',
  'function rewardPool(uint24 day) view returns (uint256)',
  'function totalShares(uint24 day) view returns (uint256)',
  'function penaltiesInRewardPool(uint24 day) view returns (uint256)',
];

// Working RPC providers
const WORKING_RPC_PROVIDERS = [
  'https://eth.drpc.org',
  'https://rpc.payload.de',
  'https://eth-mainnet.public.blastapi.io',
  'https://rpc.flashbots.net',
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

async function updateRewardPoolsOnly() {
  console.log('🔧 SAFE FIX: Updating reward pools for Days 89+ only');
  console.log('==================================================');
  
  try {
    // Read existing data - DO NOT REBUILD
    const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
    
    // Backup before any changes
    const backupPath = `public/data/cached-data-backup-${Date.now()}.json`;
    fs.writeFileSync(backupPath, JSON.stringify(cachedData, null, 2));
    console.log(`✅ Backup saved to ${backupPath}`);
    
    // Get provider and contract
    const provider = await getWorkingProvider();
    const contract = new ethers.Contract(STAKE_CONTRACT_ADDRESS, STAKE_CONTRACT_ABI, provider);
    
    // Get current protocol day
    const currentDay = await contract.getCurrentDayIndex();
    console.log(`Current protocol day: ${currentDay}`);
    
    // Find existing reward pool data
    const rewardPoolData = cachedData.stakingData.rewardPoolData || [];
    console.log(`Found ${rewardPoolData.length} existing reward pool entries`);
    
    // Only update Days 89+ that are missing or have zero rewards
    console.log('\n🔍 Checking Days 89+ for penalty rewards...');
    
    let updatedCount = 0;
    const batchSize = 10;
    
    // Process days 89 to current day + 30 (for future projections)
    const maxDay = Math.min(currentDay + 30, 365);
    
    for (let day = 89; day <= maxDay; day += batchSize) {
      const batchEnd = Math.min(day + batchSize - 1, maxDay);
      console.log(`\nFetching days ${day}-${batchEnd}...`);
      
      const batchPromises = [];
      for (let d = day; d <= batchEnd; d++) {
        // Check if we need to update this day
        const existingDay = rewardPoolData.find(item => item.day === d);
        if (!existingDay || existingDay.rewardPool === 0) {
          batchPromises.push(fetchDayData(contract, d));
        }
      }
      
      if (batchPromises.length > 0) {
        try {
          const results = await Promise.all(batchPromises);
          
          results.forEach(dayData => {
            if (dayData) {
              // Find and update or add the day
              const existingIndex = rewardPoolData.findIndex(item => item.day === dayData.day);
              
              if (existingIndex >= 0) {
                // Update existing entry, preserving other fields
                rewardPoolData[existingIndex] = {
                  ...rewardPoolData[existingIndex],
                  ...dayData,
                  lastUpdated: new Date().toISOString()
                };
              } else {
                // Add new entry
                rewardPoolData.push({
                  ...dayData,
                  lastUpdated: new Date().toISOString()
                });
              }
              
              if (dayData.penaltiesInPool > 0) {
                console.log(`  Day ${dayData.day}: Found ${dayData.penaltiesInPool.toFixed(2)} TORUS in penalties`);
                updatedCount++;
              }
            }
          });
          
          // Rate limiting
          if (batchEnd < maxDay) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`Error fetching batch ${day}-${batchEnd}:`, error.message);
        }
      }
    }
    
    // Sort by day
    rewardPoolData.sort((a, b) => a.day - b.day);
    
    // Update the cached data with ONLY the reward pool changes
    cachedData.stakingData.rewardPoolData = rewardPoolData;
    cachedData.lastUpdated = new Date().toISOString();
    
    // Write back the minimally modified data
    fs.writeFileSync('public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
    
    console.log(`\n✅ Updated ${updatedCount} days with penalty rewards`);
    console.log('✅ Cached data updated with minimal changes');
    console.log('✅ All other data preserved intact');
    
    // Verify the fix
    const day89 = rewardPoolData.find(d => d.day === 89);
    const day90 = rewardPoolData.find(d => d.day === 90);
    console.log('\n🔍 Verification:');
    console.log(`Day 89: ${day89 ? `${(day89.rewardPool + (day89.penaltiesInPool || 0)).toFixed(2)} TORUS total` : 'Not found'}`);
    console.log(`Day 90: ${day90 ? `${(day90.rewardPool + (day90.penaltiesInPool || 0)).toFixed(2)} TORUS total` : 'Not found'}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\n⚠️  No changes made to cached data');
  }
}

async function fetchDayData(contract, day) {
  try {
    const [baseReward, totalShares, penalties] = await Promise.all([
      contract.rewardPool(day),
      contract.totalShares(day),
      contract.penaltiesInRewardPool(day)
    ]);
    
    // Convert from wei to human-readable but keep in same format as existing data
    const baseRewardDecimal = parseFloat(ethers.utils.formatEther(baseReward));
    const penaltiesDecimal = parseFloat(ethers.utils.formatEther(penalties));
    const totalSharesDecimal = parseFloat(ethers.utils.formatEther(totalShares));
    
    return {
      day,
      rewardPool: day <= 88 ? baseRewardDecimal : 0, // Base rewards only for days 1-88
      penaltiesInPool: penaltiesDecimal,
      totalShares: totalSharesDecimal,
      // Include total for backward compatibility
      totalPool: baseRewardDecimal + penaltiesDecimal
    };
  } catch (error) {
    console.error(`Error fetching day ${day}:`, error.message);
    return null;
  }
}

// Run the update
updateRewardPoolsOnly().catch(console.error);