const { ethers } = require('ethers');
const fs = require('fs');

async function fixStakePaymentData() {
  console.log('🔄 Fixing stake payment data...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  // Contract setup
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  const contractABI = [
    'function userStakes(address user, uint256 index) view returns (uint256 principal, uint256 shares, uint256 duration, uint256 timestamp, uint256 titanAmount, uint256 ethAmount, uint256 status, uint256 payout)'
  ];
  
  const contract = new ethers.Contract(CREATE_STAKE_CONTRACT, contractABI, provider);
  
  let fixed = 0;
  let errors = 0;
  
  // Find stakes with missing payment data
  const stakesWithMissingData = data.stakingData.stakeEvents.filter(s => 
    (!s.rawCostTitanX || s.rawCostTitanX === '0') && 
    (!s.rawCostETH || s.rawCostETH === '0')
  );
  
  console.log(`Found ${stakesWithMissingData.length} stakes with missing payment data\n`);
  
  // Process stakes with missing data
  for (const stake of stakesWithMissingData) {
    try {
      // Get the actual data from the contract
      const stakeData = await contract.userStakes(stake.user, stake.id);
      
      // Update payment data
      stake.rawCostTitanX = stakeData.titanAmount.toString();
      stake.rawCostETH = stakeData.ethAmount.toString();
      stake.costTitanX = stakeData.titanAmount.toString();
      stake.costETH = stakeData.ethAmount.toString();
      
      fixed++;
      const titanX = parseFloat(ethers.utils.formatEther(stakeData.titanAmount));
      const eth = parseFloat(ethers.utils.formatEther(stakeData.ethAmount));
      console.log(`Fixed stake ${stake.id} by ${stake.user.substring(0, 10)}...`);
      console.log(`  TitanX: ${titanX.toLocaleString()}`);
      console.log(`  ETH: ${eth}`);
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      errors++;
      console.log(`Error updating stake ${stake.id}: ${error.message}`);
    }
  }
  
  // Save updated data
  fs.writeFileSync('public/data/cached-data.json', JSON.stringify(data, null, 2));
  
  console.log(`\n✅ Fixed ${fixed} stakes, ${errors} errors`);
  
  // Verify the fix
  console.log('\n=== VERIFICATION ===');
  const recentStakes = data.stakingData.stakeEvents
    .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp))
    .slice(0, 10);
    
  console.log('Recent stakes (last 10):');
  recentStakes.forEach(s => {
    const date = new Date(parseInt(s.timestamp) * 1000);
    const titanX = s.rawCostTitanX ? (parseFloat(s.rawCostTitanX) / 1e18).toLocaleString() : '0';
    const eth = s.rawCostETH ? (parseFloat(s.rawCostETH) / 1e18).toFixed(4) : '0';
    console.log(`  ${date.toISOString().split('T')[0]} - TitanX: ${titanX}, ETH: ${eth}`);
  });
}

fixStakePaymentData().catch(console.error);