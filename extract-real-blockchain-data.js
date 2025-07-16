// Extract real ETH and TitanX amounts from blockchain using RPC
const ethers = require('ethers');
const fs = require('fs');

console.log('🔍 EXTRACTING REAL BLOCKCHAIN DATA...');

// Try multiple RPC providers for reliability
const providers = [
  'https://eth-mainnet.g.alchemy.com/v2/NXKKZWXJqNYLdXjFXjcZxNQJMbCfPgZ5',
  'https://rpc.ankr.com/eth',
  'https://ethereum.publicnode.com',
  'https://eth.drpc.org'
];

let provider;
let providerIndex = 0;

async function initializeProvider() {
  for (let i = 0; i < providers.length; i++) {
    try {
      console.log(`📡 Trying RPC provider ${i + 1}/${providers.length}: ${providers[i]}`);
      const testProvider = new ethers.providers.JsonRpcProvider(providers[i]);
      await testProvider.getBlockNumber(); // Test connection
      provider = testProvider;
      providerIndex = i;
      console.log(`✅ Connected to RPC provider ${i + 1}`);
      return true;
    } catch (error) {
      console.log(`❌ Provider ${i + 1} failed: ${error.message}`);
    }
  }
  return false;
}

const createStakeContractABI = [
  "function getStakePositions(address user) view returns (tuple(uint256 principal, uint256 shares, uint256 endTime, uint256 costETH, uint256 costTitanX, bool isCreate)[])",
  "function getUserInfo(address user, uint256 stakeIndex) view returns (tuple(uint256 principal, uint256 shares, uint256 endTime, uint256 costETH, uint256 costTitanX, bool isCreate))"
];

async function extractRealData() {
  if (!await initializeProvider()) {
    console.error('❌ All RPC providers failed');
    return;
  }

  const createStakeContract = new ethers.Contract(
    '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507',
    createStakeContractABI,
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

  // Process users in batches to avoid timeouts
  const batchSize = 10;
  const users = Array.from(allUsers);
  const userPositions = new Map();

  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    console.log(`📡 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(users.length / batchSize)} (${batch.length} users)`);

    const batchPromises = batch.map(async (user) => {
      try {
        const positions = await createStakeContract.getStakePositions(user);
        return { user, positions };
      } catch (error) {
        console.log(`❌ Error getting positions for ${user}: ${error.message}`);
        return { user, positions: [] };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    
    batchResults.forEach(({ user, positions }) => {
      if (positions.length > 0) {
        userPositions.set(user, positions);
      }
    });

    // Add delay between batches to avoid rate limiting
    if (i + batchSize < users.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`✅ Got positions for ${userPositions.size} users`);

  // Update stake events with real ETH and TitanX amounts
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
        event.costETH = matchingPosition.costETH.toString();
        event.costTitanX = matchingPosition.costTitanX.toString();
        stakeETHUpdated++;
        stakeTitanXUpdated++;
      }
    }
  });

  // Update create events with real ETH and TitanX amounts
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
        event.costETH = matchingPosition.costETH.toString();
        event.costTitanX = matchingPosition.costTitanX.toString();
        createETHUpdated++;
        createTitanXUpdated++;
      }
    }
  });

  console.log(`🔄 Updated ${stakeETHUpdated} stake events with real ETH amounts`);
  console.log(`🔄 Updated ${stakeTitanXUpdated} stake events with real TitanX amounts`);
  console.log(`🔄 Updated ${createETHUpdated} create events with real ETH amounts`);
  console.log(`🔄 Updated ${createTitanXUpdated} create events with real TitanX amounts`);

  // Calculate real totals
  let totalStakeETH = 0;
  let totalCreateETH = 0;
  let totalStakeTitanX = 0;
  let totalCreateTitanX = 0;

  stakeEvents.forEach(event => {
    if (event.costETH && event.costETH !== "0") {
      totalStakeETH += parseFloat(event.costETH) / 1e18;
    }
    if (event.costTitanX && event.costTitanX !== "0") {
      totalStakeTitanX += parseFloat(event.costTitanX) / 1e18;
    }
  });

  createEvents.forEach(event => {
    if (event.costETH && event.costETH !== "0") {
      totalCreateETH += parseFloat(event.costETH) / 1e18;
    }
    if (event.costTitanX && event.costTitanX !== "0") {
      totalCreateTitanX += parseFloat(event.costTitanX) / 1e18;
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

  cachedData.totals.totalETH = totalETH.toString();
  cachedData.totals.totalStakedETH = totalStakeETH.toString();
  cachedData.totals.totalCreatedETH = totalCreateETH.toString();
  cachedData.totals.totalTitanX = totalTitanX.toString();
  cachedData.totals.totalStakedTitanX = totalStakeTitanX.toString();
  cachedData.totals.totalCreatedTitanX = totalCreateTitanX.toString();
  cachedData.lastUpdated = new Date().toISOString();

  // Save updated data
  fs.writeFileSync('public/data/cached-data.json', JSON.stringify(cachedData, null, 2));

  console.log('✅ Updated cached data with real blockchain amounts');
  console.log('🔄 Refresh localhost to see real ETH and TitanX data');
}

extractRealData().catch(console.error);