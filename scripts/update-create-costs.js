const { ethers } = require('ethers');
const fs = require('fs');

async function updateCreateCosts() {
  console.log('🔄 Updating create costs from blockchain...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  // Contract setup
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  const contractABI = [
    'function userCreates(address user, uint256 index) view returns (uint256 torusAmount, uint256 duration, uint256 timestamp, uint256 titanAmount, uint256 ethAmount, bool claimed)',
    'function userCreateCount(address user) view returns (uint256)'
  ];
  
  const contract = new ethers.Contract(CREATE_STAKE_CONTRACT, contractABI, provider);
  
  let updated = 0;
  let errors = 0;
  
  // Process all creates
  for (let i = 0; i < data.stakingData.createEvents.length; i++) {
    const event = data.stakingData.createEvents[i];
    
    try {
      // Get the actual data from the contract
      const createData = await contract.userCreates(event.user, event.createId || event.id);
      
      // Update payment data
      const oldTitanAmount = event.titanAmount || '0';
      const oldEthAmount = event.ethAmount || '0';
      
      event.titanAmount = createData.titanAmount.toString();
      event.ethAmount = createData.ethAmount.toString();
      
      // Also update the duplicate field
      if (event.titanXAmount !== undefined) {
        event.titanXAmount = createData.titanAmount.toString();
      }
      
      if (oldTitanAmount !== event.titanAmount || oldEthAmount !== event.ethAmount) {
        updated++;
        const titanX = parseFloat(ethers.utils.formatEther(createData.titanAmount));
        const eth = parseFloat(ethers.utils.formatEther(createData.ethAmount));
        console.log(`Updated create ${event.createId} by ${event.user.substring(0, 10)}...`);
        console.log(`  TitanX: ${titanX.toLocaleString()} (was ${parseFloat(ethers.utils.formatEther(oldTitanAmount)).toLocaleString()})`);
        console.log(`  ETH: ${eth} (was ${parseFloat(ethers.utils.formatEther(oldEthAmount))})`);
      }
      
      // Rate limit to avoid overwhelming RPC
      if (i % 10 === 0) {
        console.log(`Progress: ${i}/${data.stakingData.createEvents.length}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      errors++;
      console.log(`Error updating create ${event.createId}: ${error.message}`);
    }
  }
  
  // Save updated data
  fs.writeFileSync('public/data/cached-data.json', JSON.stringify(data, null, 2));
  
  console.log(`\n✅ Completed! Updated ${updated} creates, ${errors} errors`);
  console.log('📁 Saved to cached-data.json');
  
  // Show summary of TitanX usage by day
  console.log('\n=== TITANX USAGE BY DAY ===');
  const usageByDay = {};
  
  data.stakingData.createEvents.forEach(c => {
    const date = new Date(parseInt(c.timestamp) * 1000).toISOString().split('T')[0];
    if (!usageByDay[date]) {
      usageByDay[date] = { count: 0, titanX: 0, eth: 0 };
    }
    usageByDay[date].count++;
    if (c.titanAmount && c.titanAmount !== '0') {
      usageByDay[date].titanX += parseFloat(ethers.utils.formatEther(c.titanAmount));
    }
    if (c.ethAmount && c.ethAmount !== '0') {
      usageByDay[date].eth += parseFloat(ethers.utils.formatEther(c.ethAmount));
    }
  });
  
  Object.entries(usageByDay).sort().slice(-10).forEach(([date, usage]) => {
    console.log(`${date}: ${usage.count} creates, ${usage.titanX.toFixed(0)} TitanX, ${usage.eth.toFixed(4)} ETH`);
  });
}

updateCreateCosts().catch(console.error);