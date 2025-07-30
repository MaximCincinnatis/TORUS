const { ethers } = require('ethers');
const fs = require('fs');

async function fixDay20TitanXCosts() {
  console.log('🔧 Checking and fixing TitanX costs for Protocol Day 20 creates...\n');

  const provider = new ethers.providers.JsonRpcProvider('https://1rpc.io/eth');
  const stakeContract = new ethers.Contract(
    '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507',
    [
      {
        "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
        "name": "getStakePositions",
        "outputs": [{
          "components": [
            {"internalType": "uint256", "name": "principal", "type": "uint256"},
            {"internalType": "uint256", "name": "power", "type": "uint256"},
            {"internalType": "uint24", "name": "stakingDays", "type": "uint24"},
            {"internalType": "uint256", "name": "startTime", "type": "uint256"},
            {"internalType": "uint24", "name": "startDayIndex", "type": "uint24"},
            {"internalType": "uint256", "name": "endTime", "type": "uint256"},
            {"internalType": "uint256", "name": "shares", "type": "uint256"},
            {"internalType": "bool", "name": "claimedCreate", "type": "bool"},
            {"internalType": "bool", "name": "claimedStake", "type": "bool"},
            {"internalType": "uint256", "name": "costTitanX", "type": "uint256"},
            {"internalType": "uint256", "name": "costETH", "type": "uint256"},
            {"internalType": "uint256", "name": "rewards", "type": "uint256"},
            {"internalType": "uint256", "name": "penalties", "type": "uint256"},
            {"internalType": "uint256", "name": "claimedAt", "type": "uint256"},
            {"internalType": "bool", "name": "isCreate", "type": "bool"}
          ],
          "internalType": "struct StakeTorus[]",
          "name": "",
          "type": "tuple[]"
        }],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    provider
  );

  try {
    // Load current data
    const data = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    const creates = data.stakingData.createEvents;
    
    // Find Day 20 creates
    const day20Creates = creates.filter(c => c.protocolDay === 20);
    console.log(`Found ${day20Creates.length} creates on Protocol Day 20:`);
    
    day20Creates.forEach(c => {
      console.log(`  - User ${c.user.substring(0,10)}... (Block ${c.blockNumber}) - TitanX: ${c.costTitanX || '0'}, ETH: ${c.costETH || '0'}`);
    });

    if (day20Creates.length === 0) {
      console.log('✅ No Day 20 creates found');
      return;
    }

    // Get unique users from Day 20
    const day20Users = [...new Set(day20Creates.map(c => c.user))];
    console.log(`\n🔍 Fetching on-chain positions for ${day20Users.length} Day 20 users...`);

    const userPositions = new Map();
    
    for (const user of day20Users) {
      try {
        console.log(`  Checking ${user.substring(0,10)}...`);
        const positions = await stakeContract.getStakePositions(user);
        userPositions.set(user, positions);
        
        // Log position details for debugging
        const createPositions = positions.filter(p => p.isCreate);
        console.log(`    Found ${createPositions.length} create positions`);
        createPositions.forEach(pos => {
          const titanXCost = ethers.utils.formatEther(pos.costTitanX);
          const ethCost = ethers.utils.formatEther(pos.costETH);
          console.log(`      Position: TitanX ${titanXCost}, ETH ${ethCost}, EndTime: ${pos.endTime}`);
        });
        
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.log(`    ❌ Error: ${error.message}`);
      }
    }

    console.log('\n🔧 Updating Day 20 create costs...');
    let fixed = 0;

    day20Creates.forEach(event => {
      const userPos = userPositions.get(event.user);
      if (userPos) {
        const eventMaturityTime = Math.floor(new Date(event.maturityDate).getTime() / 1000);
        
        // Find matching position with wider time window for Day 20
        const matchingPosition = userPos.find(pos => 
          Math.abs(Number(pos.endTime) - eventMaturityTime) < 259200 && pos.isCreate // 3 days window
        );
        
        if (matchingPosition) {
          const oldTitanX = event.costTitanX || '0';
          const oldETH = event.costETH || '0';
          
          if (matchingPosition.costETH.gt(0)) {
            event.costETH = ethers.utils.formatEther(matchingPosition.costETH);
            event.costTitanX = "0.0";
            event.rawCostETH = matchingPosition.costETH.toString();
            event.rawCostTitanX = "0";
          } else {
            event.costETH = "0.0";
            event.costTitanX = ethers.utils.formatEther(matchingPosition.costTitanX);
            event.rawCostETH = "0";
            event.rawCostTitanX = matchingPosition.costTitanX.toString();
          }
          
          console.log(`    ✅ Updated ${event.user.substring(0,10)}...:`);
          console.log(`       TitanX: ${oldTitanX} → ${event.costTitanX}`);
          console.log(`       ETH: ${oldETH} → ${event.costETH}`);
          fixed++;
        } else {
          console.log(`    ⚠️  No matching position for ${event.user.substring(0,10)}... (maturity: ${event.maturityDate})`);
        }
      }
    });

    console.log(`\n✅ Fixed ${fixed} Day 20 creates`);

    // Save updated data
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(data, null, 2));
    console.log('💾 Updated cached-data.json');

    // Final verification for Day 20
    console.log('\n📊 Day 20 Creates Final Status:');
    const updatedDay20 = data.stakingData.createEvents.filter(c => c.protocolDay === 20);
    let totalTitanX = 0;
    let totalETH = 0;
    
    updatedDay20.forEach(c => {
      const titanX = parseFloat(c.costTitanX || 0);
      const eth = parseFloat(c.costETH || 0);
      totalTitanX += titanX;
      totalETH += eth;
      
      if (titanX > 0 || eth > 0) {
        console.log(`  ${c.user.substring(0,10)}... - TitanX: ${titanX.toFixed(4)}, ETH: ${eth.toFixed(6)}`);
      }
    });
    
    console.log(`\nDay 20 Totals:`);
    console.log(`  Total TitanX used: ${totalTitanX.toFixed(2)}`);
    console.log(`  Total ETH used: ${totalETH.toFixed(6)}`);
    console.log(`  Creates with costs: ${updatedDay20.filter(c => parseFloat(c.costTitanX || 0) > 0 || parseFloat(c.costETH || 0) > 0).length}/${updatedDay20.length}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

fixDay20TitanXCosts().catch(console.error);