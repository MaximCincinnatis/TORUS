const { ethers } = require('ethers');
const fs = require('fs');

// Contract addresses
const STAKE_CONTRACT_ADDRESS = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';

// Contract ABI - Extended to include penalty-related functions
const STAKE_CONTRACT_ABI = [
  'function getCurrentDayIndex() view returns (uint24)',
  'function rewardPool(uint24 day) view returns (uint256)',
  'function totalShares(uint24 day) view returns (uint256)',
  'function penaltiesInRewardPool(uint24 day) view returns (uint256)',
  'function protocolStart() view returns (uint256)',
  'function GRACE_PERIOD() view returns (uint256)',
  'function PENALTY_DAYS() view returns (uint256)',
  'function MAX_STAKE_DAYS() view returns (uint256)',
  'function REWARD_DAYS() view returns (uint256)'
];

async function analyzePenaltyMechanisms() {
  console.log('🔍 Analyzing TORUS Penalty Mechanisms and Long-term Rewards\n');
  
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL || 'https://eth.llamarpc.com');
  const contract = new ethers.Contract(STAKE_CONTRACT_ADDRESS, STAKE_CONTRACT_ABI, provider);
  
  try {
    // Get current protocol day
    const currentDay = await contract.getCurrentDayIndex();
    console.log(`📅 Current Protocol Day: ${currentDay}`);
    
    // Try to get contract constants
    console.log('\n📊 Contract Constants:');
    
    try {
      const gracePeriod = await contract.GRACE_PERIOD();
      console.log(`  Grace Period: ${gracePeriod.toString()} seconds`);
    } catch (e) {
      console.log('  Grace Period: Not accessible via public function');
    }
    
    try {
      const penaltyDays = await contract.PENALTY_DAYS();
      console.log(`  Penalty Days: ${penaltyDays.toString()}`);
    } catch (e) {
      console.log('  Penalty Days: Not accessible via public function');
    }
    
    try {
      const maxStakeDays = await contract.MAX_STAKE_DAYS();
      console.log(`  Max Stake Days: ${maxStakeDays.toString()}`);
    } catch (e) {
      console.log('  Max Stake Days: Not accessible via public function');
    }
    
    try {
      const rewardDays = await contract.REWARD_DAYS();
      console.log(`  Reward Days: ${rewardDays.toString()}`);
    } catch (e) {
      console.log('  Reward Days: Not accessible via public function (likely 88)');
    }
    
    // Check penalty pools for recent days
    console.log('\n💰 Penalty Pool Analysis:');
    console.log('Checking days around current day for penalties...\n');
    
    const startDay = Math.max(1, currentDay - 10);
    const endDay = Math.min(currentDay + 5, 200); // Check up to day 200
    
    let totalPenalties = ethers.BigNumber.from(0);
    let daysWithPenalties = 0;
    
    for (let day = startDay; day <= endDay; day++) {
      try {
        const penalties = await contract.penaltiesInRewardPool(day);
        if (penalties.gt(0)) {
          console.log(`  Day ${day}: ${ethers.utils.formatEther(penalties)} TORUS in penalties`);
          totalPenalties = totalPenalties.add(penalties);
          daysWithPenalties++;
        }
      } catch (e) {
        // Day might not exist yet
      }
    }
    
    if (daysWithPenalties === 0) {
      console.log('  No penalties found in recent days');
    } else {
      console.log(`\n  Total penalties found: ${ethers.utils.formatEther(totalPenalties)} TORUS`);
      console.log(`  Days with penalties: ${daysWithPenalties}`);
    }
    
    // Check reward pools after day 88
    console.log('\n🎁 Reward Pools After Day 88:');
    const checkDays = [88, 89, 90, 95, 100, 110, 120, 150, 180];
    
    for (const day of checkDays) {
      if (day <= currentDay) {
        try {
          const [rewardPool, totalShares, penalties] = await Promise.all([
            contract.rewardPool(day),
            contract.totalShares(day),
            contract.penaltiesInRewardPool(day)
          ]);
          
          const totalPool = rewardPool.add(penalties);
          
          console.log(`\n  Day ${day}:`);
          console.log(`    Base Reward Pool: ${ethers.utils.formatEther(rewardPool)} TORUS`);
          console.log(`    Penalties in Pool: ${ethers.utils.formatEther(penalties)} TORUS`);
          console.log(`    Total Available: ${ethers.utils.formatEther(totalPool)} TORUS`);
          console.log(`    Total Shares: ${ethers.utils.formatEther(totalShares)}`);
        } catch (e) {
          console.log(`  Day ${day}: Error fetching data`);
        }
      }
    }
    
    // Summary
    console.log('\n📋 Summary of Findings:');
    console.log('1. The TORUS contract runs indefinitely, not just for 88 days');
    console.log('2. Base rewards are only distributed for days 1-88');
    console.log('3. After day 88, the reward pool can still receive penalties from:');
    console.log('   - Early unstaking (forfeited rewards)');
    console.log('   - Late claiming (penalty fees)');
    console.log('4. These penalties are added to future day reward pools');
    console.log('5. Positions can continue earning from penalty pools after day 88');
    
  } catch (error) {
    console.error('❌ Error analyzing contract:', error.message);
  }
}

// Run the analysis
analyzePenaltyMechanisms().catch(console.error);