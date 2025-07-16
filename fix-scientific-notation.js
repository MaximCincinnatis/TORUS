// Fix scientific notation in cached data
const fs = require('fs');
const { ethers } = require('ethers');

function convertScientificToNumber(scientificStr) {
  // Convert scientific notation string to proper number
  const num = parseFloat(scientificStr);
  return num.toFixed(0); // Return as integer string
}

function fixScientificNotation() {
  console.log('🔧 Fixing scientific notation in cached data...\n');
  
  // Load cached data
  const cacheData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
  
  console.log('1️⃣ CONVERTING TITANX AMOUNTS:');
  
  let totalTitanXWei = 0;
  let createCount = 0;
  
  // Fix create events
  cacheData.stakingData.createEvents.forEach((create, index) => {
    const originalAmount = create.titanAmount;
    
    // Convert scientific notation to normal number
    const normalizedAmount = convertScientificToNumber(originalAmount);
    create.titanAmount = normalizedAmount;
    
    // Calculate actual TitanX amount
    const titanFormatted = parseFloat(ethers.utils.formatEther(normalizedAmount));
    totalTitanXWei += parseFloat(normalizedAmount);
    createCount++;
    
    console.log(`   Create ${create.stakeIndex}: ${originalAmount} → ${normalizedAmount}`);
    console.log(`     = ${titanFormatted.toLocaleString()} TitanX`);
  });
  
  const totalTitanX = totalTitanXWei / 1e18; // Convert from wei to TitanX
  
  console.log(`\n✅ Total TitanX Created: ${totalTitanX.toLocaleString()}`);
  console.log(`✅ Average TitanX per Create: ${(totalTitanX / createCount).toLocaleString()}`);
  
  console.log('\n2️⃣ FIXING SHARES AMOUNTS:');
  
  // Fix stake events shares that might be in scientific notation
  cacheData.stakingData.stakeEvents.forEach((stake, index) => {
    const originalShares = stake.shares;
    
    if (typeof originalShares === 'string' && originalShares.includes('e')) {
      const normalizedShares = convertScientificToNumber(originalShares);
      stake.shares = normalizedShares;
      console.log(`   Stake ${stake.id}: ${originalShares} → ${normalizedShares}`);
    }
  });
  
  console.log('\n3️⃣ CALCULATING TOTALS:');
  
  // Calculate ETH totals
  let totalETHStaked = 0;
  cacheData.stakingData.stakeEvents.forEach(stake => {
    if (stake.costETH) {
      const ethAmount = parseFloat(ethers.utils.formatEther(stake.costETH));
      totalETHStaked += ethAmount;
    }
  });
  
  // Update totals
  cacheData.totals = {
    totalETH: totalETHStaked.toFixed(6),
    totalTitanX: totalTitanX.toFixed(0),
    totalStakedETH: totalETHStaked.toFixed(6),
    totalCreatedETH: "0", // Creates don't directly use ETH
    totalStakedTitanX: "0", // Stakes don't use TitanX
    totalCreatedTitanX: totalTitanX.toFixed(0)
  };
  
  console.log(`   Total ETH: ${cacheData.totals.totalETH} ETH`);
  console.log(`   Total TitanX: ${parseFloat(cacheData.totals.totalTitanX).toLocaleString()} TitanX`);
  console.log(`   Avg TitanX per Create: ${(totalTitanX / createCount).toLocaleString()}`);
  
  // Save fixed data
  fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cacheData, null, 2));
  
  console.log('\n✅ SCIENTIFIC NOTATION FIXED AND SAVED!');
  
  return {
    totalTitanX,
    avgTitanX: totalTitanX / createCount,
    totalETH: totalETHStaked,
    createCount,
    stakeCount: cacheData.stakingData.stakeEvents.length
  };
}

const results = fixScientificNotation();

console.log('\n📊 FINAL SUMMARY:');
console.log(`Creates: ${results.createCount}`);
console.log(`Stakes: ${results.stakeCount}`);
console.log(`Total TitanX: ${results.totalTitanX.toLocaleString()}`);
console.log(`Avg TitanX/Create: ${results.avgTitanX.toLocaleString()}`);
console.log(`Total ETH: ${results.totalETH.toFixed(6)} ETH`);