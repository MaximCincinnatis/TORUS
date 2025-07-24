const { ethers } = require('ethers');
const fs = require('fs');

async function fixCreatePaymentFields() {
  console.log('🔄 Fixing create payment fields...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  // Contract setup
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  const contractABI = [
    'function userCreates(address user, uint256 index) view returns (uint256 torusAmount, uint256 duration, uint256 timestamp, uint256 titanAmount, uint256 ethAmount, bool claimed)'
  ];
  
  const contract = new ethers.Contract(CREATE_STAKE_CONTRACT, contractABI, provider);
  
  let fixed = 0;
  let errors = 0;
  
  // Process creates that have titanAmount but titanXAmount is 0
  for (let i = 0; i < data.stakingData.createEvents.length; i++) {
    const event = data.stakingData.createEvents[i];
    
    // If titanAmount has data but titanXAmount is 0, copy it over
    if (event.titanAmount && event.titanAmount !== '0' && event.titanXAmount === '0') {
      event.titanXAmount = event.titanAmount;
      fixed++;
      console.log(`Fixed create ${event.createId}: titanXAmount = ${event.titanAmount}`);
    }
    
    // If both are 0 but we're missing payment data, fetch from blockchain
    if ((!event.titanAmount || event.titanAmount === '0') && 
        (!event.titanXAmount || event.titanXAmount === '0') && 
        (!event.ethAmount || event.ethAmount === '0')) {
      
      try {
        const createData = await contract.userCreates(event.user, event.createId || event.id);
        
        event.titanAmount = createData.titanAmount.toString();
        event.titanXAmount = createData.titanAmount.toString();
        event.ethAmount = createData.ethAmount.toString();
        
        if (createData.titanAmount.toString() !== '0' || createData.ethAmount.toString() !== '0') {
          fixed++;
          console.log(`Fetched payment data for create ${event.createId}`);
        }
        
        // Rate limit
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        errors++;
        console.log(`Error fetching create ${event.createId}: ${error.message}`);
      }
    }
  }
  
  // Save updated data
  fs.writeFileSync('public/data/cached-data.json', JSON.stringify(data, null, 2));
  
  console.log(`\n✅ Fixed ${fixed} creates, ${errors} errors`);
  
  // Verify the fix
  console.log('\n=== VERIFICATION ===');
  const day13Creates = data.stakingData.createEvents.filter(e => {
    const ts = parseInt(e.timestamp);
    return ts >= 1753142400 && ts < 1753228800;
  });
  
  const day14Creates = data.stakingData.createEvents.filter(e => {
    const ts = parseInt(e.timestamp);
    return ts >= 1753228800 && ts < 1753315200;
  });
  
  const day13WithTitanX = day13Creates.filter(c => c.titanXAmount && c.titanXAmount !== '0').length;
  const day14WithTitanX = day14Creates.filter(c => c.titanXAmount && c.titanXAmount !== '0').length;
  
  console.log(`Day 13: ${day13WithTitanX}/${day13Creates.length} creates with TitanX`);
  console.log(`Day 14: ${day14WithTitanX}/${day14Creates.length} creates with TitanX`);
}

fixCreatePaymentFields().catch(console.error);