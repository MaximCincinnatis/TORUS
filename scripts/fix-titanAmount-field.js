const fs = require('fs');

function fixTitanAmountField() {
  console.log('🔧 Fixing titanAmount field for frontend compatibility...\n');

  try {
    // Load current data
    const data = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    
    let fixed = 0;

    // Fix creates - set titanAmount from rawCostTitanX
    data.stakingData.createEvents.forEach(create => {
      if (create.rawCostTitanX && create.rawCostTitanX !== '0') {
        // Frontend uses titanAmount field - set it to rawCostTitanX
        create.titanAmount = create.rawCostTitanX;
        fixed++;
      } else {
        // Ensure titanAmount is set to "0" for ETH-paid creates
        create.titanAmount = "0";
      }
    });

    console.log(`✅ Fixed ${fixed} creates with titanAmount field`);

    // Check Day 20 specifically
    const day20Creates = data.stakingData.createEvents.filter(c => c.protocolDay === 20);
    const day20WithTitanX = day20Creates.filter(c => c.titanAmount && c.titanAmount !== '0');
    
    console.log('\n📊 Day 20 Results:');
    console.log(`Total Day 20 creates: ${day20Creates.length}`);
    console.log(`Day 20 creates with TitanX: ${day20WithTitanX.length}`);
    
    day20WithTitanX.forEach(c => {
      const titanXAmount = parseFloat(c.titanAmount) / 1e18;
      console.log(`  ${c.user.substring(0,10)}... - ${titanXAmount.toFixed(0)} TitanX`);
    });

    // Save updated data
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(data, null, 2));
    console.log('\n💾 Updated cached-data.json');
    console.log('🎉 Frontend should now show Day 20 TitanX usage!');

  } catch (error) {
    console.error('Error:', error);
  }
}

fixTitanAmountField();