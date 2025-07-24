const { ethers } = require('ethers');
const fs = require('fs');

async function fixAllMissingStakeData() {
  console.log('🔄 Fixing ALL stakes with missing payment data...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  // Find ALL stakes with missing payment data
  const stakesWithMissingData = data.stakingData.stakeEvents.filter(s => 
    (!s.rawCostTitanX || s.rawCostTitanX === '0') && 
    (!s.rawCostETH || s.rawCostETH === '0')
  );
  
  console.log(`Found ${stakesWithMissingData.length} stakes with missing payment data\n`);
  
  // For stakes, we need to look at the transaction to get payment data
  // since the contract call is reverting
  let fixed = 0;
  let errors = 0;
  
  for (const stake of stakesWithMissingData) {
    try {
      // Get the transaction receipt
      const tx = await provider.getTransaction(stake.transactionHash);
      if (!tx) {
        console.log(`No transaction found for stake ${stake.id}`);
        errors++;
        continue;
      }
      
      // Decode the transaction input to get payment info
      const iface = new ethers.utils.Interface([
        'function stake(uint256 amount, uint256 numDays, uint256 titanAmount, uint256 ethAmount)'
      ]);
      
      let titanAmount = '0';
      let ethAmount = '0';
      
      try {
        const decoded = iface.parseTransaction({ data: tx.data });
        if (decoded && decoded.args) {
          titanAmount = decoded.args.titanAmount.toString();
          ethAmount = decoded.args.ethAmount.toString();
        }
      } catch (e) {
        // Try alternative function signature
        const ifaceAlt = new ethers.utils.Interface([
          'function stakeFor(address user, uint256 amount, uint256 numDays, uint256 titanAmount, uint256 ethAmount)'
        ]);
        try {
          const decoded = ifaceAlt.parseTransaction({ data: tx.data });
          if (decoded && decoded.args) {
            titanAmount = decoded.args.titanAmount.toString();
            ethAmount = decoded.args.ethAmount.toString();
          }
        } catch (e2) {
          console.log(`Could not decode tx for stake ${stake.id}`);
        }
      }
      
      // Update the stake data
      if (titanAmount !== '0' || ethAmount !== '0') {
        stake.rawCostTitanX = titanAmount;
        stake.rawCostETH = ethAmount;
        stake.costTitanX = titanAmount;
        stake.costETH = ethAmount;
        
        fixed++;
        const titanX = parseFloat(ethers.utils.formatEther(titanAmount));
        const eth = parseFloat(ethers.utils.formatEther(ethAmount));
        console.log(`Fixed stake ${stake.id} by ${stake.user.substring(0, 10)}...`);
        console.log(`  TitanX: ${titanX.toLocaleString()}`);
        console.log(`  ETH: ${eth}`);
        console.log(`  Tx: ${stake.transactionHash}`);
      } else {
        console.log(`No payment data found in tx for stake ${stake.id}`);
        errors++;
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      errors++;
      console.log(`Error processing stake ${stake.id}: ${error.message}`);
    }
  }
  
  // Save updated data
  fs.writeFileSync('public/data/cached-data.json', JSON.stringify(data, null, 2));
  
  console.log(`\n✅ Fixed ${fixed} stakes, ${errors} errors/skipped`);
  
  // Verify the fix
  console.log('\n=== VERIFICATION ===');
  const afterJuly18 = new Date('2025-07-18T00:00:00Z').getTime();
  const recentStakes = data.stakingData.stakeEvents
    .filter(s => parseInt(s.timestamp) * 1000 >= afterJuly18)
    .sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp));
    
  console.log('Stakes after July 18:');
  recentStakes.forEach(s => {
    const date = new Date(parseInt(s.timestamp) * 1000);
    const titanX = s.rawCostTitanX ? (parseFloat(s.rawCostTitanX) / 1e18).toLocaleString() : '0';
    const eth = s.rawCostETH ? (parseFloat(s.rawCostETH) / 1e18).toFixed(4) : '0';
    console.log(`  ${date.toISOString().split('T')[0]} - TitanX: ${titanX}, ETH: ${eth}`);
  });
}

fixAllMissingStakeData().catch(console.error);