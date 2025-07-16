const { ethers } = require('ethers');

async function debugMatching() {
  console.log('🔍 DEBUGGING MATCHING LOGIC');
  console.log('============================');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const contract = new ethers.Contract(
    '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507',
    ['function getStakePositions(address user) view returns (tuple(uint256 principal, uint256 shares, uint256 endTime, uint256 costETH, uint256 costTitanX, bool isCreate)[])'],
    provider
  );
  
  // Test matching for the user with the problematic data
  const user = '0x2A4Cdc9bBd937023A95E50185c0c027647f5a7b5';
  const positions = await contract.getStakePositions(user);
  
  console.log('\nUser positions:');
  positions.forEach((pos, i) => {
    console.log(`Position ${i}:`);
    console.log(`  EndTime: ${pos.endTime.toString()}`);
    console.log(`  CostETH: ${pos.costETH.toString()}`);
    console.log(`  IsCreate: ${pos.isCreate}`);
    console.log(`  EndTime as Date: ${new Date(pos.endTime * 1000).toISOString()}`);
  });
  
  // This is from our JSON data
  const eventMaturityDate = '2025-08-09T21:08:35.000Z';
  const eventMaturityTime = Math.floor(new Date(eventMaturityDate).getTime() / 1000);
  console.log('\nEvent maturity time:', eventMaturityTime);
  console.log('Event maturity date:', new Date(eventMaturityTime * 1000).toISOString());
  
  // Check matching for stakes (isCreate = false)
  const stakePosition = positions.find(pos => 
    Math.abs(Number(pos.endTime) - eventMaturityTime) < 86400 && 
    !pos.isCreate 
  );
  
  console.log('\nStake matching result:', stakePosition ? 'FOUND' : 'NOT FOUND');
  if (stakePosition) {
    console.log('Matched stake costETH:', stakePosition.costETH.toString());
  }
  
  // Check matching for creates (isCreate = true)
  const createPosition = positions.find(pos => 
    Math.abs(Number(pos.endTime) - eventMaturityTime) < 86400 && 
    pos.isCreate 
  );
  
  console.log('\nCreate matching result:', createPosition ? 'FOUND' : 'NOT FOUND');
  if (createPosition) {
    console.log('Matched create costETH:', createPosition.costETH.toString());
  }
}

debugMatching().catch(console.error);