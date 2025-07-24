const fs = require('fs');
const { ethers } = require('ethers');

async function findCreatesNeedingFix() {
  const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  // Find creates where titanAmount has value but titanXAmount is 0 or vice versa
  const needsSync = [];
  const needsFetch = [];
  
  data.stakingData.createEvents.forEach(create => {
    const titanAmount = create.titanAmount || '0';
    const titanXAmount = create.titanXAmount || '0';
    const ethAmount = create.ethAmount || '0';
    
    // If they don't match, needs sync
    if (titanAmount !== titanXAmount) {
      needsSync.push({
        ...create,
        issue: 'field_mismatch',
        titanAmount,
        titanXAmount
      });
    }
    
    // If both are 0 and ethAmount is also 0, might need fetch
    if (titanAmount === '0' && titanXAmount === '0' && ethAmount === '0' && parseFloat(create.torusAmount) > 0) {
      needsFetch.push({
        ...create,
        issue: 'no_payment_data'
      });
    }
  });
  
  console.log('=== CREATES NEEDING FIXES ===\n');
  console.log(`Found ${needsSync.length} creates with field mismatches`);
  console.log(`Found ${needsFetch.length} creates with no payment data\n`);
  
  if (needsSync.length > 0) {
    console.log('=== FIELD MISMATCHES (titanAmount vs titanXAmount) ===');
    needsSync.forEach(c => {
      const date = new Date(parseInt(c.timestamp) * 1000);
      console.log(`${date.toISOString()} - User: ${c.user.substring(0, 10)}...`);
      console.log(`  titanAmount: ${c.titanAmount}`);
      console.log(`  titanXAmount: ${c.titanXAmount}`);
      console.log(`  Should sync to: ${c.titanAmount !== '0' ? c.titanAmount : c.titanXAmount}`);
    });
  }
  
  if (needsFetch.length > 0) {
    console.log('\n=== MISSING PAYMENT DATA ===');
    console.log('These creates have no payment data at all:');
    needsFetch.slice(0, 10).forEach(c => {
      const date = new Date(parseInt(c.timestamp) * 1000);
      console.log(`${date.toISOString()} - User: ${c.user.substring(0, 10)}... - TORUS: ${(parseFloat(c.torusAmount) / 1e18).toFixed(2)}`);
    });
    
    // Try to fetch data for one to see if it works
    if (needsFetch.length > 0) {
      console.log('\n=== TESTING FETCH FOR FIRST CREATE ===');
      const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
      const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
      const contractABI = [
        'function userCreates(address user, uint256 index) view returns (uint256 torusAmount, uint256 duration, uint256 timestamp, uint256 titanAmount, uint256 ethAmount, bool claimed)'
      ];
      const contract = new ethers.Contract(CREATE_STAKE_CONTRACT, contractABI, provider);
      
      const testCreate = needsFetch[0];
      try {
        const createData = await contract.userCreates(testCreate.user, testCreate.createId || testCreate.id);
        console.log('Fetched data for create:');
        console.log(`  TitanX: ${createData.titanAmount.toString()} (${(parseFloat(createData.titanAmount) / 1e18).toLocaleString()})`);
        console.log(`  ETH: ${createData.ethAmount.toString()} (${(parseFloat(createData.ethAmount) / 1e18).toFixed(4)})`);
      } catch (e) {
        console.log('Error fetching:', e.message);
      }
    }
  }
  
  return { needsSync, needsFetch };
}

findCreatesNeedingFix().catch(console.error);