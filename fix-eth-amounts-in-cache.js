// Fix ETH amounts in cached data by adding getUserInfo/getStakePositions calls
const ethers = require('ethers');
const fs = require('fs');

console.log('🔧 FIXING ETH AMOUNTS IN CACHED DATA...');

// Contract setup
const provider = new ethers.providers.JsonRpcProvider('https://eth-mainnet.g.alchemy.com/v2/NXKKZWXJqNYLdXjFXjcZxNQJMbCfPgZ5');

const createStakeContractABI = [
  "function getUserInfo(address user, uint256 stakeIndex) view returns (tuple(uint256 principal, uint256 shares, uint256 endTime, uint256 costETH, uint256 costTitanX, bool isCreate))",
  "function getStakePositions(address user) view returns (tuple(uint256 principal, uint256 shares, uint256 endTime, uint256 costETH, uint256 costTitanX, bool isCreate)[])"
];

const createStakeContract = new ethers.Contract(
  '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507',
  createStakeContractABI,
  provider
);

async function fixETHAmounts() {
  // Load current cached data
  const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  const stakeEvents = data.stakingData.stakeEvents;
  const createEvents = data.stakingData.createEvents;
  
  console.log(`📊 Processing ${stakeEvents.length} stakes and ${createEvents.length} creates`);
  
  // Get unique users to batch contract calls
  const allUsers = new Set();
  stakeEvents.forEach(event => allUsers.add(event.user));
  createEvents.forEach(event => allUsers.add(event.user));
  
  console.log(`👥 Found ${allUsers.size} unique users`);
  
  // Get positions for each user
  const userPositions = new Map();
  let processed = 0;
  
  for (const user of allUsers) {
    try {
      console.log(`🔍 Getting positions for user ${processed + 1}/${allUsers.size}: ${user}`);
      const positions = await createStakeContract.getStakePositions(user);
      userPositions.set(user, positions);
      processed++;
      
      if (processed % 20 === 0) {
        console.log(`   Progress: ${processed}/${allUsers.size} users processed`);
      }
    } catch (error) {
      console.error(`❌ Error getting positions for ${user}:`, error.message);
    }
  }
  
  console.log(`✅ Got positions for ${userPositions.size} users`);
  
  // Update stake events with ETH amounts
  let stakeETHUpdated = 0;
  stakeEvents.forEach(event => {
    const userPos = userPositions.get(event.user);
    if (userPos) {
      // Find matching position by endTime (maturity date)
      const eventMaturityTime = Math.floor(new Date(event.maturityDate).getTime() / 1000);
      const matchingPosition = userPos.find(pos => 
        Math.abs(Number(pos.endTime) - eventMaturityTime) < 86400 && // Within 1 day
        !pos.isCreate // This is a stake
      );
      
      if (matchingPosition) {
        event.costETH = matchingPosition.costETH.toString();
        stakeETHUpdated++;
      }
    }
  });
  
  // Update create events with ETH amounts
  let createETHUpdated = 0;
  createEvents.forEach(event => {
    const userPos = userPositions.get(event.user);
    if (userPos) {
      // Find matching position by endTime (maturity date)
      const eventMaturityTime = Math.floor(new Date(event.maturityDate).getTime() / 1000);
      const matchingPosition = userPos.find(pos => 
        Math.abs(Number(pos.endTime) - eventMaturityTime) < 86400 && // Within 1 day
        pos.isCreate // This is a create
      );
      
      if (matchingPosition) {
        event.costETH = matchingPosition.costETH.toString();
        createETHUpdated++;
      }
    }
  });
  
  console.log(`🔄 Updated ${stakeETHUpdated} stake events with ETH amounts`);
  console.log(`🔄 Updated ${createETHUpdated} create events with ETH amounts`);
  
  // Recalculate totals
  let totalStakeETH = 0;
  let totalCreateETH = 0;
  
  stakeEvents.forEach(event => {
    if (event.costETH && event.costETH !== "0") {
      totalStakeETH += parseFloat(event.costETH) / 1e18;
    }
  });
  
  createEvents.forEach(event => {
    if (event.costETH && event.costETH !== "0") {
      totalCreateETH += parseFloat(event.costETH) / 1e18;
    }
  });
  
  const totalETH = totalStakeETH + totalCreateETH;
  
  console.log(`💰 UPDATED ETH TOTALS:`);
  console.log(`   Stake ETH: ${totalStakeETH.toFixed(4)} ETH`);
  console.log(`   Create ETH: ${totalCreateETH.toFixed(4)} ETH`);
  console.log(`   Total ETH: ${totalETH.toFixed(4)} ETH`);
  
  // Update totals in data
  if (!data.totals) {
    data.totals = {};
  }
  data.totals.totalETH = totalETH.toString();
  data.totals.totalStakedETH = totalStakeETH.toString();
  data.totals.totalCreatedETH = totalCreateETH.toString();
  
  // Update timestamp
  data.lastUpdated = new Date().toISOString();
  
  // Save updated data
  fs.writeFileSync('public/data/cached-data.json', JSON.stringify(data, null, 2));
  console.log('✅ Updated cached data with ETH amounts');
}

fixETHAmounts().catch(console.error);