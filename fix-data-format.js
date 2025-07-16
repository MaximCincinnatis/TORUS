// Fix data format issues step by step
const fs = require('fs');

function fixDataFormat() {
  console.log('🔧 Fixing data format issues...\n');
  
  // Load cached data
  const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
  
  console.log('1️⃣ ANALYZING TITANX AMOUNTS:');
  
  let totalTitanXFixed = 0;
  let createCount = 0;
  
  // Fix create events
  cacheData.stakingData.createEvents.forEach((create, index) => {
    const originalAmount = create.titanAmount;
    console.log(`   Create ${create.stakeIndex}: ${originalAmount}`);
    
    // Convert scientific notation to normal decimal
    let normalizedAmount;
    if (typeof originalAmount === 'string' && originalAmount.includes('e')) {
      // Parse scientific notation
      const num = parseFloat(originalAmount);
      normalizedAmount = num.toString();
    } else {
      normalizedAmount = originalAmount.toString();
    }
    
    // Update the create event
    create.titanAmount = normalizedAmount;
    
    // Calculate TitanX amount (divide by 1e18)
    const titanXAmount = parseFloat(normalizedAmount) / 1e18;
    totalTitanXFixed += titanXAmount;
    createCount++;
    
    console.log(`     → ${normalizedAmount} wei = ${titanXAmount.toLocaleString()} TitanX`);
  });
  
  console.log(`\n✅ Total TitanX from creates: ${totalTitanXFixed.toLocaleString()}`);
  console.log(`✅ Average TitanX per create: ${(totalTitanXFixed / createCount).toLocaleString()}`);
  
  console.log('\n2️⃣ FIXING SHARES FORMAT:');
  
  // Fix stake events shares
  cacheData.stakingData.stakeEvents.forEach((stake, index) => {
    const originalShares = stake.shares;
    
    if (typeof originalShares === 'string' && originalShares.includes('e')) {
      const num = parseFloat(originalShares);
      stake.shares = num.toString();
      console.log(`   Stake ${stake.id}: ${originalShares} → ${stake.shares}`);
    }
  });
  
  console.log('\n3️⃣ CALCULATING ETH TOTALS:');
  
  let totalETHStaked = 0;
  let stakeCount = 0;
  
  cacheData.stakingData.stakeEvents.forEach(stake => {
    if (stake.costETH) {
      // ETH amounts are already in wei format
      const ethAmount = parseFloat(stake.costETH) / 1e18;
      totalETHStaked += ethAmount;
      stakeCount++;
    }
  });
  
  console.log(`   Total ETH staked: ${totalETHStaked.toFixed(6)} ETH`);
  console.log(`   Number of stakes: ${stakeCount}`);
  
  console.log('\n4️⃣ UPDATING TOTALS:');
  
  // Update totals with correct values
  cacheData.totals = {
    totalETH: totalETHStaked.toFixed(6),
    totalTitanX: totalTitanXFixed.toFixed(0),
    totalStakedETH: totalETHStaked.toFixed(6),
    totalCreatedETH: "0", // Creates don't directly use ETH input
    totalStakedTitanX: "0", // Stakes don't use TitanX
    totalCreatedTitanX: totalTitanXFixed.toFixed(0)
  };
  
  console.log('   Updated totals:');
  console.log(`   - Total ETH: ${cacheData.totals.totalETH} ETH`);
  console.log(`   - Total TitanX: ${parseFloat(cacheData.totals.totalTitanX).toLocaleString()} TitanX`);
  console.log(`   - Avg TitanX per Create: ${(totalTitanXFixed / createCount).toLocaleString()}`);
  
  // Save fixed data
  fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cacheData, null, 2));
  
  console.log('\n✅ DATA FORMAT FIXED AND SAVED!');
  
  return {
    totalTitanX: totalTitanXFixed,
    avgTitanX: totalTitanXFixed / createCount,
    totalETH: totalETHStaked,
    createCount,
    stakeCount
  };
}

const results = fixDataFormat();

console.log('\n📊 VERIFICATION:');
console.log(`Creates: ${results.createCount}`);
console.log(`Stakes: ${results.stakeCount}`);
console.log(`Total TitanX: ${results.totalTitanX.toLocaleString()}`);
console.log(`Avg TitanX/Create: ${results.avgTitanX.toLocaleString()}`);
console.log(`Total ETH: ${results.totalETH.toFixed(6)} ETH`);