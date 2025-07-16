const { ethers } = require('ethers');

async function verifyStructOrder() {
  console.log('🔍 VERIFYING STRUCT FIELD ORDER');
  console.log('=================================');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  
  // Let's test with a simple position to understand the field order
  const CONTRACT_ABI = [
    'function getStakePositions(address user) view returns (tuple(uint256 principal, uint256 shares, uint256 endTime, uint256 costETH, uint256 costTitanX, bool isCreate)[])'
  ];
  
  const contract = new ethers.Contract(
    '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507',
    CONTRACT_ABI,
    provider
  );
  
  // Test with a user that should have simple data
  const testUser = '0x8A91055c4A7FD852194BB5FfB87Adc2233C40f48';
  console.log(`\nTesting with user: ${testUser}`);
  
  try {
    const positions = await contract.getStakePositions(testUser);
    console.log(`Found ${positions.length} positions\n`);
    
    if (positions.length > 0) {
      const pos = positions[0];
      console.log('RAW POSITION DATA:');
      console.log(`  pos[0] (principal): ${pos[0].toString()}`);
      console.log(`  pos[1] (shares): ${pos[1].toString()}`);
      console.log(`  pos[2] (endTime): ${pos[2].toString()}`);
      console.log(`  pos[3] (costETH): ${pos[3].toString()}`);
      console.log(`  pos[4] (costTitanX): ${pos[4].toString()}`);
      console.log(`  pos[5] (isCreate): ${pos[5]}`);
      
      console.log('\nNAMED FIELDS:');
      console.log(`  principal: ${pos.principal.toString()}`);
      console.log(`  shares: ${pos.shares.toString()}`);
      console.log(`  endTime: ${pos.endTime.toString()}`);
      console.log(`  costETH: ${pos.costETH.toString()}`);
      console.log(`  costTitanX: ${pos.costTitanX.toString()}`);
      console.log(`  isCreate: ${pos.isCreate}`);
      
      console.log('\nCONVERTED VALUES:');
      console.log(`  principal: ${ethers.utils.formatEther(pos.principal)} TORUS`);
      console.log(`  shares: ${ethers.utils.formatEther(pos.shares)}`);
      console.log(`  costETH: ${ethers.utils.formatEther(pos.costETH)} ETH`);
      console.log(`  costTitanX: ${ethers.utils.formatEther(pos.costTitanX)} TitanX`);
      
      // Check if costETH looks like TitanX (very large number)
      const ethValue = parseFloat(ethers.utils.formatEther(pos.costETH));
      const titanXValue = parseFloat(ethers.utils.formatEther(pos.costTitanX));
      
      console.log('\nVALUE ANALYSIS:');
      console.log(`  ETH value: ${ethValue}`);
      console.log(`  TitanX value: ${titanXValue}`);
      
      if (ethValue > 1000000) {
        console.log('  ⚠️  WARNING: costETH looks unusually high (might be TitanX?)');
      }
      if (titanXValue < 0.001 && titanXValue > 0) {
        console.log('  ⚠️  WARNING: costTitanX looks unusually low (might be ETH?)');
      }
    }
    
    // Let's also check the contract directly on Etherscan to verify
    console.log('\n📝 ETHERSCAN VERIFICATION:');
    console.log('Check the StakeTorus struct at:');
    console.log('https://etherscan.io/address/0xc7cc775b21f9df85e043c7fdd9dac60af0b69507#code');
    console.log('Look for the struct definition to confirm field order');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

verifyStructOrder().catch(console.error);