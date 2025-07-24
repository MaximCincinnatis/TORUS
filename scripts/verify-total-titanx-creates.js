const fs = require('fs');
const { ethers } = require('ethers');

function verifyTotalTitanXInCreates() {
  const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  console.log('=== VERIFYING TOTAL TITANX USED IN CREATES ===\n');
  
  // Calculate total from all creates
  let totalTitanXFromCreates = ethers.BigNumber.from(0);
  let createsWithTitanX = 0;
  let createsTotal = 0;
  
  data.stakingData.createEvents.forEach(create => {
    createsTotal++;
    
    // Check both titanAmount and titanXAmount fields
    const titanAmount = create.titanAmount || '0';
    const titanXAmount = create.titanXAmount || '0';
    
    // Use the non-zero value (they should be the same after our fixes)
    const amount = titanAmount !== '0' ? titanAmount : titanXAmount;
    
    if (amount !== '0') {
      createsWithTitanX++;
      totalTitanXFromCreates = totalTitanXFromCreates.add(ethers.BigNumber.from(amount));
    }
  });
  
  // Convert to human readable
  const totalInTokens = parseFloat(ethers.utils.formatEther(totalTitanXFromCreates));
  const totalInBillions = totalInTokens / 1e9;
  
  console.log('Calculated from individual creates:');
  console.log(`  Total creates: ${createsTotal}`);
  console.log(`  Creates with TitanX: ${createsWithTitanX}`);
  console.log(`  Total TitanX used: ${totalInTokens.toLocaleString()} TITANX`);
  console.log(`  In billions: ${totalInBillions.toFixed(3)}B TITANX\n`);
  
  // Check if there's a stored total somewhere
  if (data.stakingData.totals) {
    console.log('Stored totals in stakingData:');
    Object.entries(data.stakingData.totals).forEach(([key, value]) => {
      if (key.toLowerCase().includes('titan')) {
        console.log(`  ${key}: ${value}`);
      }
    });
  }
  
  // Check metadata
  if (data.stakingData.metadata) {
    console.log('\nMetadata values:');
    Object.entries(data.stakingData.metadata).forEach(([key, value]) => {
      if (key.toLowerCase().includes('titan') || key.toLowerCase().includes('create')) {
        console.log(`  ${key}: ${value}`);
      }
    });
  }
  
  // Calculate daily breakdown
  console.log('\n=== DAILY TITANX USAGE IN CREATES ===');
  const dailyUsage = {};
  
  data.stakingData.createEvents.forEach(create => {
    const date = new Date(parseInt(create.timestamp) * 1000).toISOString().split('T')[0];
    const amount = create.titanAmount !== '0' ? create.titanAmount : (create.titanXAmount || '0');
    
    if (!dailyUsage[date]) {
      dailyUsage[date] = {
        count: 0,
        withTitanX: 0,
        totalTitanX: ethers.BigNumber.from(0)
      };
    }
    
    dailyUsage[date].count++;
    if (amount !== '0') {
      dailyUsage[date].withTitanX++;
      dailyUsage[date].totalTitanX = dailyUsage[date].totalTitanX.add(ethers.BigNumber.from(amount));
    }
  });
  
  console.log('Date       | Creates | w/TitanX | Total TitanX Used');
  console.log('-----------|---------|----------|-------------------');
  
  let runningTotal = ethers.BigNumber.from(0);
  Object.entries(dailyUsage).sort().forEach(([date, stats]) => {
    const dailyTotal = parseFloat(ethers.utils.formatEther(stats.totalTitanX));
    runningTotal = runningTotal.add(stats.totalTitanX);
    
    console.log(
      `${date} |    ${stats.count.toString().padStart(4)} |     ${stats.withTitanX.toString().padStart(4)} | ${dailyTotal.toLocaleString().padStart(17)}`
    );
  });
  
  console.log('\n=== VERIFICATION SUMMARY ===');
  console.log(`Total TitanX from all creates: ${totalInTokens.toLocaleString()}`);
  console.log(`Running total from daily: ${parseFloat(ethers.utils.formatEther(runningTotal)).toLocaleString()}`);
  
  const difference = totalTitanXFromCreates.sub(runningTotal);
  if (difference.eq(0)) {
    console.log('✅ Daily totals match overall total - DATA IS CONSISTENT');
  } else {
    console.log(`❌ Mismatch: ${ethers.utils.formatEther(difference)} TITANX difference`);
  }
  
  // Check against any frontend display values
  if (data.totals?.totalTitanXUsedInCreates) {
    console.log(`\nFrontend total: ${data.totals.totalTitanXUsedInCreates}`);
    console.log(`Calculated total: ${totalInBillions.toFixed(3)}B`);
  }
  
  return {
    total: totalInTokens,
    billions: totalInBillions,
    createsWithTitanX: createsWithTitanX,
    totalCreates: createsTotal
  };
}

verifyTotalTitanXInCreates();