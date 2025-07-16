const { ethers } = require('ethers');
const fs = require('fs');

async function auditContractCosts() {
  console.log('🔍 AUDITING CONTRACT COST DATA');
  console.log('================================');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  
  // Correct ABI based on contract analysis
  const CONTRACT_ABI = [
    'function getStakePositions(address user) view returns (tuple(uint256 principal, uint256 shares, uint256 endTime, uint256 costETH, uint256 costTitanX, bool isCreate)[])'
  ];
  
  const contract = new ethers.Contract(
    '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507',
    CONTRACT_ABI,
    provider
  );
  
  // Load cached data to get a few sample users
  const cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  // Test a few users from our data
  const testUsers = [
    '0x2A4Cdc9bBd937023A95E50185c0c027647f5a7b5',
    '0x79c640B83E95135c2578A1e1e0D48b637fC2EaD7',
    '0xfEAaA55b94b5cee8159244C49A44d0DE79659817'
  ];
  
  console.log('\n📊 ANALYZING CONTRACT POSITIONS:\n');
  
  for (const user of testUsers) {
    console.log(`User: ${user}`);
    console.log('=' .repeat(60));
    
    try {
      const positions = await contract.getStakePositions(user);
      
      // Separate creates and stakes
      const creates = positions.filter(p => p.isCreate);
      const stakes = positions.filter(p => !p.isCreate);
      
      console.log(`\n  CREATES (${creates.length} positions):`);
      creates.forEach((pos, i) => {
        if (pos.costETH.toString() !== '0' || pos.costTitanX.toString() !== '0') {
          console.log(`    Position ${i}:`);
          console.log(`      ETH Cost: ${ethers.utils.formatEther(pos.costETH)} ETH`);
          console.log(`      TitanX Cost: ${ethers.utils.formatEther(pos.costTitanX)} TitanX`);
          console.log(`      Principal: ${ethers.utils.formatEther(pos.principal)} TORUS`);
          console.log(`      Payment Type: ${pos.costETH.toString() !== '0' ? 'ETH' : 'TitanX'}`);
        }
      });
      
      console.log(`\n  STAKES (${stakes.length} positions):`);
      stakes.forEach((pos, i) => {
        if (pos.costETH.toString() !== '0' || pos.costTitanX.toString() !== '0') {
          console.log(`    Position ${i}:`);
          console.log(`      ETH Cost: ${ethers.utils.formatEther(pos.costETH)} ETH`);
          console.log(`      TitanX Cost: ${ethers.utils.formatEther(pos.costTitanX)} TitanX`);
          console.log(`      Principal: ${ethers.utils.formatEther(pos.principal)} TORUS`);
          console.log(`      Payment Type: ${pos.costETH.toString() !== '0' ? 'ETH' : 'TitanX'}`);
        }
      });
      
      // Find matching events in our cached data
      const userStakes = cachedData.stakingData.stakeEvents.filter(e => e.user === user);
      const userCreates = cachedData.stakingData.createEvents.filter(e => e.user === user);
      
      console.log(`\n  CACHED DATA:`);
      console.log(`    Stakes in cache: ${userStakes.length}`);
      console.log(`    Creates in cache: ${userCreates.length}`);
      
      console.log('\n');
      
    } catch (error) {
      console.error(`  Error: ${error.message}`);
    }
  }
  
  // Now let's check if the huge ETH values are consistent
  console.log('\n🔍 INVESTIGATING HIGH ETH VALUES:\n');
  
  // Find positions with extremely high ETH costs
  for (const user of testUsers) {
    const positions = await contract.getStakePositions(user);
    const highValuePositions = positions.filter(p => {
      const ethValue = parseFloat(ethers.utils.formatEther(p.costETH));
      return ethValue > 1000; // More than 1000 ETH
    });
    
    if (highValuePositions.length > 0) {
      console.log(`User ${user.substring(0, 10)}... has ${highValuePositions.length} high-value positions:`);
      highValuePositions.forEach(pos => {
        console.log(`  - ${ethers.utils.formatEther(pos.costETH)} ETH (${pos.isCreate ? 'CREATE' : 'STAKE'})`);
      });
    }
  }
  
  console.log('\n✅ AUDIT COMPLETE');
}

auditContractCosts().catch(console.error);