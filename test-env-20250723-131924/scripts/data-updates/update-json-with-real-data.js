// Update JSON with real ETH and TitanX amounts from blockchain using working RPCs
const { ethers } = require('ethers');
const fs = require('fs');

// Working RPC providers (tested and confirmed working)
const WORKING_RPC_PROVIDERS = [
  'https://eth.drpc.org',
  'https://rpc.payload.de',
  'https://eth-mainnet.public.blastapi.io',
  'https://rpc.flashbots.net',
  'https://eth-mainnet.nodereal.io/v1/REDACTED_API_KEY'
];

const CONTRACT_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
    "name": "getStakePositions",
    "outputs": [{
      "components": [
        {"internalType": "uint256", "name": "principal", "type": "uint256"},
        {"internalType": "uint256", "name": "power", "type": "uint256"},
        {"internalType": "uint24", "name": "stakingDays", "type": "uint24"},
        {"internalType": "uint256", "name": "startTime", "type": "uint256"},
        {"internalType": "uint24", "name": "startDayIndex", "type": "uint24"},
        {"internalType": "uint256", "name": "endTime", "type": "uint256"},
        {"internalType": "uint256", "name": "shares", "type": "uint256"},
        {"internalType": "bool", "name": "claimedCreate", "type": "bool"},
        {"internalType": "bool", "name": "claimedStake", "type": "bool"},
        {"internalType": "uint256", "name": "costTitanX", "type": "uint256"},
        {"internalType": "uint256", "name": "costETH", "type": "uint256"},
        {"internalType": "uint256", "name": "rewards", "type": "uint256"},
        {"internalType": "uint256", "name": "penalties", "type": "uint256"},
        {"internalType": "uint256", "name": "claimedAt", "type": "uint256"},
        {"internalType": "bool", "name": "isCreate", "type": "bool"}
      ],
      "internalType": "struct StakeTorus[]",
      "name": "",
      "type": "tuple[]"
    }],
    "stateMutability": "view",
    "type": "function"
  }
];

async function getWorkingProvider() {
  for (const rpcUrl of WORKING_RPC_PROVIDERS) {
    try {
      console.log(`📡 Testing provider: ${rpcUrl}`);
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      
      // Test with 3 second timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 3000);
      });
      
      const blockNumber = await Promise.race([
        provider.getBlockNumber(),
        timeoutPromise
      ]);
      
      console.log(`✅ Connected to ${rpcUrl} - Block: ${blockNumber}`);
      return provider;
      
    } catch (error) {
      console.log(`❌ Failed ${rpcUrl}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error('All RPC providers failed');
}

async function updateJsonWithRealData() {
  console.log('🔄 UPDATING JSON WITH REAL BLOCKCHAIN DATA...');
  
  try {
    // Get working provider
    const provider = await getWorkingProvider();
    const contract = new ethers.Contract(
      '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507',
      CONTRACT_ABI,
      provider
    );
    
    // Load cached data
    const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
    const stakeEvents = cachedData.stakingData.stakeEvents;
    const createEvents = cachedData.stakingData.createEvents;
    
    console.log(`📊 Processing ${stakeEvents.length} stakes and ${createEvents.length} creates`);
    
    // Get unique users
    const allUsers = new Set();
    stakeEvents.forEach(event => allUsers.add(event.user));
    createEvents.forEach(event => allUsers.add(event.user));
    
    console.log(`👥 Found ${allUsers.size} unique users`);
    
    // Process users in small batches to avoid rate limits
    const users = Array.from(allUsers);
    const batchSize = 5;
    const userPositions = new Map();
    
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      console.log(`📡 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(users.length / batchSize)} (${batch.length} users)`);
      
      const batchPromises = batch.map(async (user) => {
        try {
          const positions = await contract.getStakePositions(user);
          return { user, positions };
        } catch (error) {
          console.log(`❌ Error getting positions for ${user.substring(0, 10)}...: ${error.message}`);
          return { user, positions: [] };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(({ user, positions }) => {
        if (positions.length > 0) {
          userPositions.set(user, positions);
        }
      });
      
      // Show progress
      const processed = Math.min(i + batchSize, users.length);
      console.log(`  Progress: ${processed}/${users.length} users (${((processed / users.length) * 100).toFixed(1)}%)`);
      
      // Add delay between batches to avoid rate limiting
      if (i + batchSize < users.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`✅ Got positions for ${userPositions.size} users`);
    
    // Update stake events with real amounts
    let stakeETHUpdated = 0;
    let stakeTitanXUpdated = 0;
    
    stakeEvents.forEach(event => {
      const userPos = userPositions.get(event.user);
      if (userPos) {
        const eventMaturityTime = Math.floor(new Date(event.maturityDate).getTime() / 1000);
        const matchingPosition = userPos.find(pos => 
          Math.abs(Number(pos.endTime) - eventMaturityTime) < 86400 && // Within 1 day
          !pos.isCreate // This is a stake
        );
        
        if (matchingPosition) {
          // Convert wei to ETH for display (keep raw values for totals calculation)
          event.costETH = ethers.utils.formatEther(matchingPosition.costETH);
          event.costTitanX = ethers.utils.formatEther(matchingPosition.costTitanX);
          event.rawCostETH = matchingPosition.costETH.toString();
          event.rawCostTitanX = matchingPosition.costTitanX.toString();
          stakeETHUpdated++;
          stakeTitanXUpdated++;
        }
      }
    });
    
    // Update create events with real amounts
    let createETHUpdated = 0;
    let createTitanXUpdated = 0;
    
    createEvents.forEach(event => {
      const userPos = userPositions.get(event.user);
      if (userPos) {
        const eventMaturityTime = Math.floor(new Date(event.maturityDate).getTime() / 1000);
        const matchingPosition = userPos.find(pos => 
          Math.abs(Number(pos.endTime) - eventMaturityTime) < 86400 && // Within 1 day
          pos.isCreate // This is a create
        );
        
        if (matchingPosition) {
          // Convert wei to ETH for display (keep raw values for totals calculation)
          event.costETH = ethers.utils.formatEther(matchingPosition.costETH);
          event.costTitanX = ethers.utils.formatEther(matchingPosition.costTitanX);
          event.rawCostETH = matchingPosition.costETH.toString();
          event.rawCostTitanX = matchingPosition.costTitanX.toString();
          createETHUpdated++;
          createTitanXUpdated++;
        }
      }
    });
    
    console.log(`\n🔄 UPDATED WITH REAL BLOCKCHAIN DATA:`);
    console.log(`  Stakes - ETH: ${stakeETHUpdated}, TitanX: ${stakeTitanXUpdated}`);
    console.log(`  Creates - ETH: ${createETHUpdated}, TitanX: ${createTitanXUpdated}`);
    
    // Calculate real totals
    let totalStakeETH = 0;
    let totalCreateETH = 0;
    let totalStakeTitanX = 0;
    let totalCreateTitanX = 0;
    
    stakeEvents.forEach(event => {
      if (event.rawCostETH && event.rawCostETH !== "0") {
        totalStakeETH += parseFloat(event.rawCostETH) / 1e18;
      }
      if (event.rawCostTitanX && event.rawCostTitanX !== "0") {
        totalStakeTitanX += parseFloat(event.rawCostTitanX) / 1e18;
      }
    });
    
    createEvents.forEach(event => {
      if (event.rawCostETH && event.rawCostETH !== "0") {
        totalCreateETH += parseFloat(event.rawCostETH) / 1e18;
      }
      if (event.rawCostTitanX && event.rawCostTitanX !== "0") {
        totalCreateTitanX += parseFloat(event.rawCostTitanX) / 1e18;
      }
    });
    
    const totalETH = totalStakeETH + totalCreateETH;
    const totalTitanX = totalStakeTitanX + totalCreateTitanX;
    
    console.log(`\n💰 REAL BLOCKCHAIN TOTALS:`);
    console.log(`  Total ETH: ${totalETH.toFixed(6)} ETH`);
    console.log(`  Stake ETH: ${totalStakeETH.toFixed(6)} ETH`);
    console.log(`  Create ETH: ${totalCreateETH.toFixed(6)} ETH`);
    console.log(`  Total TitanX: ${(totalTitanX / 1e12).toFixed(2)}T TitanX`);
    console.log(`  Stake TitanX: ${(totalStakeTitanX / 1e12).toFixed(2)}T TitanX`);
    console.log(`  Create TitanX: ${(totalCreateTitanX / 1e12).toFixed(2)}T TitanX`);
    
    // Update totals in cached data
    if (!cachedData.totals) {
      cachedData.totals = {};
    }
    
    cachedData.totals.totalETH = totalETH.toFixed(6);
    cachedData.totals.totalStakedETH = totalStakeETH.toFixed(6);
    cachedData.totals.totalCreatedETH = totalCreateETH.toFixed(6);
    cachedData.totals.totalTitanX = totalTitanX.toFixed(2);
    cachedData.totals.totalStakedTitanX = totalStakeTitanX.toFixed(2);
    cachedData.totals.totalCreatedTitanX = totalCreateTitanX.toFixed(2);
    
    // Update metadata
    cachedData.lastUpdated = new Date().toISOString();
    cachedData.metadata.lastRPCUpdate = new Date().toISOString();
    cachedData.metadata.realDataExtracted = true;
    cachedData.metadata.usersProcessed = userPositions.size;
    cachedData.metadata.totalUsers = allUsers.size;
    
    // Save updated data
    fs.writeFileSync('public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
    
    console.log('✅ Updated JSON with real blockchain data');
    console.log(`📊 Coverage: ${userPositions.size}/${allUsers.size} users (${((userPositions.size / allUsers.size) * 100).toFixed(1)}%)`);
    console.log('🔄 Refresh localhost to see real data');
    
  } catch (error) {
    console.error('❌ Error updating JSON with real data:', error);
  }
}

updateJsonWithRealData();