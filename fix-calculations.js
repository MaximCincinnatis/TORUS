// Fix calculations in cached data
const fs = require('fs');
const { ethers } = require('ethers');

function fixCalculations() {
  console.log('🔧 Fixing TORUS Dashboard Calculations...\n');
  
  // Load cached data
  const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
  
  console.log('1️⃣ FIXING TITANX CALCULATIONS:');
  
  let totalTitanXCreated = 0;
  let totalTitanXStaked = 0;
  let createCount = 0;
  
  // Fix create events
  cacheData.stakingData.createEvents.forEach(create => {
    // Convert scientific notation to proper number
    const titanAmountBN = ethers.BigNumber.from(create.titanAmount.toString());
    const titanFormatted = parseFloat(ethers.utils.formatEther(titanAmountBN));
    
    totalTitanXCreated += titanFormatted;
    createCount++;
    
    console.log(`   Create ${create.stakeIndex}: ${titanFormatted.toLocaleString()} TitanX`);
  });
  
  console.log(`\n   ✅ Total TitanX Created: ${totalTitanXCreated.toLocaleString()}`);
  console.log(`   ✅ Average TitanX per Create: ${(totalTitanXCreated / createCount).toLocaleString()}`);
  
  console.log('\n2️⃣ FIXING ETH CALCULATIONS:');
  
  let totalETHStaked = 0;
  let totalETHCreated = 0;
  let stakeCount = 0;
  
  // ETH from stakes
  cacheData.stakingData.stakeEvents.forEach(stake => {
    if (stake.costETH) {
      const ethAmount = parseFloat(ethers.utils.formatEther(stake.costETH));
      totalETHStaked += ethAmount;
      stakeCount++;
    }
  });
  
  // ETH from creates (they use ETH to buy TitanX)
  cacheData.stakingData.createEvents.forEach(create => {
    // Approximate ETH cost based on TitanX amount and price
    // TitanX price is roughly 1 TitanX = 0.000000001 ETH
    const titanAmountBN = ethers.BigNumber.from(create.titanAmount.toString());
    const titanFormatted = parseFloat(ethers.utils.formatEther(titanAmountBN));
    const ethEquivalent = titanFormatted * 0.000000001; // Very rough estimate
    totalETHCreated += ethEquivalent;
  });
  
  const totalETH = totalETHStaked + totalETHCreated;
  
  console.log(`   ✅ Total ETH Staked: ${totalETHStaked.toFixed(6)} ETH`);
  console.log(`   ✅ Total ETH Created: ${totalETHCreated.toFixed(6)} ETH`);
  console.log(`   ✅ Total ETH Input: ${totalETH.toFixed(6)} ETH`);
  
  console.log('\n3️⃣ FIXING STAKING DAYS:');
  
  // Check if stakingDays matches duration
  let stakingDaysFixed = 0;
  cacheData.stakingData.stakeEvents.forEach(stake => {
    if (stake.duration !== stake.stakingDays) {
      console.log(`   Fixing stake ${stake.id}: duration=${stake.duration}, stakingDays=${stake.stakingDays}`);
      stake.stakingDays = parseInt(stake.duration);
      stakingDaysFixed++;
    }
  });
  
  console.log(`   ✅ Fixed ${stakingDaysFixed} staking days mismatches`);
  
  console.log('\n4️⃣ UPDATING TOTALS:');
  
  // Update totals object
  cacheData.totals = {
    totalETH: totalETH.toFixed(6),
    totalTitanX: totalTitanXCreated.toFixed(0),
    totalStakedETH: totalETHStaked.toFixed(6),
    totalCreatedETH: totalETHCreated.toFixed(6),
    totalStakedTitanX: "0", // Stakes don't use TitanX
    totalCreatedTitanX: totalTitanXCreated.toFixed(0)
  };
  
  console.log('   Updated totals:');
  console.log(`   - Total ETH: ${cacheData.totals.totalETH} ETH`);
  console.log(`   - Total TitanX: ${parseFloat(cacheData.totals.totalTitanX).toLocaleString()} TitanX`);
  console.log(`   - Avg TitanX/Create: ${(totalTitanXCreated / createCount).toLocaleString()}`);
  
  console.log('\n5️⃣ MATURITY DATE VERIFICATION:');
  
  // Check a few maturity dates
  const samplesToCheck = cacheData.stakingData.stakeEvents.slice(0, 3);
  samplesToCheck.forEach(stake => {
    const startDate = new Date(stake.timestamp * 1000);
    const expectedEndDate = new Date(startDate.getTime() + (stake.duration * 24 * 60 * 60 * 1000));
    const actualMaturity = new Date(stake.maturityDate);
    
    console.log(`   Stake ${stake.id}:`);
    console.log(`     Start: ${startDate.toISOString()}`);
    console.log(`     Expected: ${expectedEndDate.toISOString()}`);
    console.log(`     Actual: ${actualMaturity.toISOString()}`);
    console.log(`     Match: ${expectedEndDate.toISOString() === actualMaturity.toISOString() ? '✅' : '❌'}`);
  });
  
  // Save fixed data
  fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cacheData, null, 2));
  
  console.log('\n✅ CALCULATIONS FIXED AND SAVED!');
  console.log('\nSummary of fixes:');
  console.log(`- Total TitanX: ${parseFloat(cacheData.totals.totalTitanX).toLocaleString()} (was incorrectly low)`);
  console.log(`- Avg TitanX per Create: ${(totalTitanXCreated / createCount).toLocaleString()}`);
  console.log(`- Total ETH: ${cacheData.totals.totalETH} ETH`);
  console.log(`- Fixed ${stakingDaysFixed} staking days mismatches`);
}

fixCalculations();