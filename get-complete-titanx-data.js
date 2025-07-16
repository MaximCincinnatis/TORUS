// Get complete TitanX data using getUserInfo() calls
// This will take longer due to individual contract calls for each position
const fs = require('fs');
const { ethers } = require('ethers');

// Contract configurations
const CONTRACTS = {
  TORUS_TOKEN: '0xb47f575807fc5466285e1277ef8acfbb5c6686e8',
  TORUS_CREATE_STAKE: '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507',
};

const CREATE_STAKE_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "user", "type": "address"}
    ],
    "name": "getStakePositions",
    "outputs": [
      {
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
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const RPC_ENDPOINTS = [
  'https://ethereum.publicnode.com',
  'https://1rpc.io/eth',
  'https://eth.llamarpc.com',
  'https://eth-mainnet.public.blastapi.io',
];

async function getCompleteTitanXData() {
  console.log('🔍 GETTING COMPLETE TITANX DATA...');
  console.log('⏱️  This will take longer due to individual contract calls');
  
  const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
  const createStakeContract = new ethers.Contract(CONTRACTS.TORUS_CREATE_STAKE, CREATE_STAKE_ABI, provider);
  
  // Load the complete data from previous fetch
  const completeData = JSON.parse(fs.readFileSync('public/data/cached-data-complete.json', 'utf8'));
  const createEvents = completeData.stakingData.createEvents;
  const stakeEvents = completeData.stakingData.stakeEvents;
  
  console.log(`📊 Found ${createEvents.length} create events and ${stakeEvents.length} stake events`);
  
  // Get unique users to minimize contract calls
  const allUsers = [...new Set([
    ...createEvents.map(c => c.user),
    ...stakeEvents.map(s => s.user)
  ])];
  
  console.log(`👥 Processing ${allUsers.length} unique users...`);
  
  let totalTitanX = 0;
  let totalETH = 0;
  let userCount = 0;
  let positionCount = 0;
  
  // Process each user
  for (const user of allUsers) {
    userCount++;
    if (userCount % 10 === 0) {
      console.log(`   Processing user ${userCount}/${allUsers.length}...`);
    }
    
    try {
      // Get all positions for this user
      const positions = await createStakeContract.getStakePositions(user);
      
      positions.forEach(position => {
        positionCount++;
        
        // Add TitanX costs
        const titanXCost = parseFloat(ethers.utils.formatEther(position.costTitanX));
        const ethCost = parseFloat(ethers.utils.formatEther(position.costETH));
        
        totalTitanX += titanXCost;
        totalETH += ethCost;
        
        // Log significant TitanX amounts
        if (titanXCost > 100000) {
          console.log(`   💰 Large TitanX: ${titanXCost.toLocaleString()} (${user.substr(0,8)}...)`);
        }
      });
      
      // Small delay to avoid overwhelming RPC
      await new Promise(resolve => setTimeout(resolve, 50));
      
    } catch (error) {
      console.warn(`⚠️  Error processing user ${user}: ${error.message}`);
    }
  }
  
  console.log(`\\n📊 COMPLETE TITANX DATA RESULTS:`);
  console.log(`✅ Processed ${userCount} users`);
  console.log(`✅ Found ${positionCount} total positions`);
  console.log(`💰 Total TitanX: ${totalTitanX.toLocaleString()}`);
  console.log(`💰 Total ETH: ${totalETH.toLocaleString()}`);
  console.log(`📈 Average TitanX per position: ${(totalTitanX / positionCount).toLocaleString()}`);
  
  // Compare with previous data
  const previousTitanX = 26424444.641;
  const improvement = totalTitanX - previousTitanX;
  
  console.log(`\\n📊 COMPARISON WITH PREVIOUS DATA:`);
  console.log(`Previous TitanX: ${previousTitanX.toLocaleString()}`);
  console.log(`New TitanX: ${totalTitanX.toLocaleString()}`);
  console.log(`Improvement: ${improvement.toLocaleString()} (+${((improvement / previousTitanX) * 100).toFixed(1)}%)`);
  
  if (totalTitanX > 100000000) {
    console.log(`\\n🎉 SUCCESS: TitanX amounts now in expected range (>100M)!`);
  } else {
    console.log(`\\n⚠️  TitanX amounts still seem low (expecting >100M)`);
  }
  
  // Update the cached data with correct totals
  completeData.totals = {
    totalETH: totalETH.toFixed(6),
    totalTitanX: Math.round(totalTitanX).toString(),
    totalStakedETH: "0", // Could separate stakes vs creates
    totalCreatedETH: totalETH.toFixed(6), // Assuming most ETH is from creates
    totalStakedTitanX: "0", // Stakes don't typically use TitanX
    totalCreatedTitanX: Math.round(totalTitanX).toString()
  };
  
  // Save updated data
  fs.writeFileSync('public/data/cached-data-complete-with-titanx.json', JSON.stringify(completeData, null, 2));
  
  console.log(`\\n✅ Updated data saved to: public/data/cached-data-complete-with-titanx.json`);
  console.log(`🎯 Ready for testing!`);
}

// Run if called directly
if (require.main === module) {
  getCompleteTitanXData()
    .then(() => {
      console.log('\\n✅ Complete TitanX data fetch completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { getCompleteTitanXData };