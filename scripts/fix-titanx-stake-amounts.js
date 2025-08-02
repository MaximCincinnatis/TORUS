const { ethers } = require('ethers');
const fs = require('fs');

async function fixTitanXStakeAmounts() {
  console.log('🔧 Fixing TitanX stake amounts...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://ethereum.publicnode.com');
  const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  // Create backup
  const backupPath = `public/data/cached-data.backup-${Date.now()}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
  console.log(`✅ Created backup: ${backupPath}\n`);
  
  const TITANX = '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1';
  const STAKE_CONTRACT = '0xc7Cc775B21f9Df85E043C7FDd9dAC60af0B69507';
  const TRANSFER_TOPIC = ethers.utils.id('Transfer(address,address,uint256)');
  
  let fixed = 0;
  let errors = 0;
  let totalBefore = 0;
  let totalAfter = 0;
  
  // Calculate total before
  data.stakingData.stakeEvents.forEach(stake => {
    totalBefore += parseFloat(stake.costTitanX || '0');
  });
  
  // Process each stake event
  for (let i = 0; i < data.stakingData.stakeEvents.length; i++) {
    const stake = data.stakingData.stakeEvents[i];
    
    try {
      process.stdout.write(`\rProcessing stake ${i + 1}/${data.stakingData.stakeEvents.length}...`);
      
      const receipt = await provider.getTransactionReceipt(stake.transactionHash);
      const tx = await provider.getTransaction(stake.transactionHash);
      
      // Find TitanX transfer to stake contract
      let actualTitanX = '0';
      let actualTitanXFormatted = '0';
      let isETHStake = parseFloat(ethers.utils.formatEther(tx.value)) > 0;
      
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === TITANX.toLowerCase() && 
            log.topics[0] === TRANSFER_TOPIC) {
          
          const from = ethers.utils.defaultAbiCoder.decode(['address'], log.topics[1])[0];
          const to = ethers.utils.defaultAbiCoder.decode(['address'], log.topics[2])[0];
          const amount = log.data;
          
          // Check if this is a transfer to the stake contract
          if (to.toLowerCase() === STAKE_CONTRACT.toLowerCase()) {
            actualTitanX = amount;
            actualTitanXFormatted = ethers.utils.formatEther(amount);
            
            // Update the stake data
            const oldAmount = stake.costTitanX;
            stake.costTitanX = actualTitanXFormatted;
            stake.rawCostTitanX = amount;
            stake.titanAmount = amount;
            
            // Mark if this was an ETH stake vs direct TitanX stake
            stake.stakeType = isETHStake ? 'ETH' : 'TitanX';
            
            if (parseFloat(oldAmount) !== parseFloat(actualTitanXFormatted)) {
              fixed++;
            }
            break;
          }
        }
      }
      
      totalAfter += parseFloat(actualTitanXFormatted);
      
      // Small delay to avoid rate limits
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      errors++;
      console.log(`\n⚠️  Error processing stake ${stake.transactionHash}: ${error.message}`);
    }
  }
  
  console.log(`\n\n✅ Fixed ${fixed} stake amounts`);
  if (errors > 0) {
    console.log(`⚠️  ${errors} errors occurred`);
  }
  
  // Show the dramatic difference
  console.log(`\n📊 Total TitanX in stakes:`);
  console.log(`   Before: ${totalBefore.toLocaleString()} TitanX`);
  console.log(`   After:  ${totalAfter.toLocaleString()} TitanX`);
  console.log(`   Increase: ${(totalAfter/totalBefore).toFixed(0)}x`);
  
  // Show some examples
  console.log(`\n📈 Example corrections:`);
  const examples = data.stakingData.stakeEvents.slice(-5);
  examples.forEach(stake => {
    const oldValue = parseFloat(stake.rawCostTitanX) / 1e18;
    if (oldValue < 100) { // These are the ones that were wrong
      console.log(`   Stake ${stake.stakeIndex}: ${oldValue.toFixed(1)} → ${stake.costTitanX} TitanX`);
    }
  });
  
  // Save updated data
  fs.writeFileSync('public/data/cached-data.json', JSON.stringify(data, null, 2));
  console.log('\n✅ Updated cached-data.json with correct TitanX amounts');
  console.log('\n🎯 The TitanX stakes chart should now show proper values!');
}

fixTitanXStakeAmounts().catch(console.error);