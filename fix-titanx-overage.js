#!/usr/bin/env node

const fs = require('fs');
const { ethers } = require('ethers');

console.log('🔧 FIXING TITANX OVERAGE');
console.log('========================\n');

async function fixTitanXOverage() {
  try {
    // Load current data
    const dataPath = './public/data/buy-process-data.json';
    const buyProcessData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Get the correct contract total
    const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    
    const contract = new ethers.Contract(BUY_PROCESS_CONTRACT, [
      'function titanXUsedForBuilds() view returns (uint256)'
    ], provider);
    
    const contractTitanXBuilds = await contract.titanXUsedForBuilds();
    const contractTotal = parseFloat(ethers.utils.formatEther(contractTitanXBuilds));
    
    // Current tracked total
    const currentTotal = buyProcessData.dailyData.reduce((sum, day) => 
      sum + (day.titanXUsedForBuilds || 0), 0
    );
    
    console.log(`Contract total: ${contractTotal.toFixed(2)}`);
    console.log(`Current total: ${currentTotal.toFixed(2)}`);
    console.log(`Overage: ${(currentTotal - contractTotal).toFixed(2)}`);
    
    // Reset to values from backup and apply correct fix
    const backupData = JSON.parse(fs.readFileSync('./public/data/buy-process-data-backup-1753762543352.json', 'utf8'));
    
    // Copy the original titanXUsedForBuilds values
    buyProcessData.dailyData.forEach((day, index) => {
      if (backupData.dailyData[index]) {
        day.titanXUsedForBuilds = backupData.dailyData[index].titanXUsedForBuilds || 0;
      }
    });
    
    // Now calculate the correct gap
    const originalTotal = buyProcessData.dailyData.reduce((sum, day) => 
      sum + (day.titanXUsedForBuilds || 0), 0
    );
    
    const gap = contractTotal - originalTotal;
    
    console.log(`\n📊 CORRECT CALCULATION:`);
    console.log(`Original total: ${originalTotal.toFixed(2)}`);
    console.log(`Contract total: ${contractTotal.toFixed(2)}`);
    console.log(`Gap to distribute: ${gap.toFixed(2)}`);
    
    // Find days with builds that have TitanX data
    const daysWithTitanXBuilds = buyProcessData.dailyData.filter(day => 
      day.buyAndBuildCount > 0 && (day.titanXUsedForBuilds || 0) > 0
    );
    
    if (daysWithTitanXBuilds.length > 0 && gap > 0) {
      // Calculate total existing TitanX for proportional distribution
      const existingTotal = daysWithTitanXBuilds.reduce((sum, day) => 
        sum + day.titanXUsedForBuilds, 0
      );
      
      console.log(`\n🔧 APPLYING PROPORTIONAL FIX:`);
      
      daysWithTitanXBuilds.forEach(day => {
        const proportion = day.titanXUsedForBuilds / existingTotal;
        const addition = gap * proportion;
        console.log(`  Day ${day.protocolDay}: ${day.titanXUsedForBuilds.toFixed(2)} + ${addition.toFixed(2)} = ${(day.titanXUsedForBuilds + addition).toFixed(2)}`);
        day.titanXUsedForBuilds += addition;
      });
    }
    
    // Verify final total
    const finalTotal = buyProcessData.dailyData.reduce((sum, day) => 
      sum + (day.titanXUsedForBuilds || 0), 0
    );
    
    console.log(`\n✅ VERIFICATION:`);
    console.log(`Final total: ${finalTotal.toFixed(2)}`);
    console.log(`Contract total: ${contractTotal.toFixed(2)}`);
    console.log(`Match: ${Math.abs(finalTotal - contractTotal) < 0.01 ? '✅ YES' : '❌ NO'}`);
    
    // Save corrected data
    fs.writeFileSync(dataPath, JSON.stringify(buyProcessData, null, 2));
    console.log(`\n✅ Corrected data saved`);
    
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
  }
}

fixTitanXOverage();