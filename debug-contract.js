const { ethers } = require('ethers');

async function checkContractStruct() {
  console.log('🔍 CHECKING CONTRACT STRUCT');
  console.log('============================');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  
  // Let's check if the contract ABI is correct
  const CONTRACT_ABI = [
    'function getStakePositions(address user) view returns (tuple(uint256 principal, uint256 shares, uint256 endTime, uint256 costETH, uint256 costTitanX, bool isCreate)[])'
  ];
  
  const contract = new ethers.Contract(
    '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507',
    CONTRACT_ABI,
    provider
  );
  
  // Test different users to see if all have similar issues
  const users = [
    '0x2A4Cdc9bBd937023A95E50185c0c027647f5a7b5',
    '0x79c640B83E95135c2578A1e1e0D48b637fC2EaD7',
    '0xfEAaA55b94b5cee8159244C49A44d0DE79659817'
  ];
  
  for (const user of users) {
    console.log(`\nUser: ${user}`);
    const positions = await contract.getStakePositions(user);
    
    positions.forEach((pos, i) => {
      console.log(`  Position ${i}: costETH=${pos.costETH.toString()}, isCreate=${pos.isCreate}`);
      if (pos.costETH.toString() !== '0') {
        console.log(`    In ETH: ${ethers.utils.formatEther(pos.costETH)}`);
      }
    });
  }
}

checkContractStruct().catch(console.error);