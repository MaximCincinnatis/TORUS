const { ethers } = require('ethers');
const fs = require('fs');

async function updateCurrentDay() {
  console.log('Updating current protocol day from contract...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  const ABI = ['function getCurrentDayIndex() view returns (uint24)'];
  
  const contract = new ethers.Contract(CONTRACT, ABI, provider);
  
  try {
    // Get current day from contract
    const currentDay = await contract.getCurrentDayIndex();
    const currentDayNumber = Number(currentDay);
    console.log(`✅ Current protocol day from contract: ${currentDayNumber}`);
    
    // Update cached data
    const cachedDataPath = 'public/data/cached-data.json';
    const cachedData = JSON.parse(fs.readFileSync(cachedDataPath, 'utf8'));
    
    const oldDay = cachedData.currentProtocolDay;
    console.log(`📊 Old protocol day in cache: ${oldDay}`);
    
    if (oldDay !== currentDayNumber) {
      cachedData.currentProtocolDay = currentDayNumber;
      cachedData.stakingData.currentProtocolDay = currentDayNumber;
      
      // Update last updated timestamp
      cachedData.lastUpdated = new Date().toISOString();
      
      fs.writeFileSync(cachedDataPath, JSON.stringify(cachedData, null, 2));
      console.log(`\n✅ Updated cached data: ${oldDay} → ${currentDayNumber}`);
    } else {
      console.log('\n✅ Protocol day already up to date');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

updateCurrentDay();