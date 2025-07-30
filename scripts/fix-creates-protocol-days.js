const { ethers } = require('ethers');
const fs = require('fs');

// Protocol day calculation
function getProtocolDay(timestamp) {
  const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
  const msPerDay = 24 * 60 * 60 * 1000;
  const dateObj = new Date(timestamp * 1000);
  const daysDiff = Math.floor((dateObj.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1;
  return Math.max(1, daysDiff);
}

async function fixCreatesData() {
  console.log('🔧 Fixing creates with protocol day and TitanX cost issues...\n');

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
    
    console.log(`Found ${creates.length} creates to check`);

    // Find creates with issues
    const problematicCreates = creates.filter(c => 
      !c.protocolDay || 
      c.protocolDay === undefined || 
      !c.costTitanX || 
      c.costTitanX === "0.0" || 
      parseFloat(c.costTitanX || 0) === 0
    );

    console.log(`Found ${problematicCreates.length} creates with issues:`);
    problematicCreates.forEach(c => {
      console.log(`  - User ${c.user.substring(0,10)}... (Block ${c.blockNumber}) - Day: ${c.protocolDay}, TitanX: ${c.costTitanX}`);
    });

    if (problematicCreates.length === 0) {
      console.log('✅ No issues found!');
      return;
    }

    console.log('\n🔍 Fetching on-chain data for problematic users...');

    // Get unique users with issues
    const usersToFix = [...new Set(problematicCreates.map(c => c.user))];
    console.log(`Checking ${usersToFix.length} unique users...`);

    const userPositions = new Map();
    
    for (const user of usersToFix) {
      try {
        console.log(`  Fetching positions for ${user.substring(0,10)}...`);
        const positions = await stakeContract.getStakePositions(user);
        userPositions.set(user, positions);
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.log(`  ❌ Error fetching ${user}: ${error.message}`);
      }
    }

    console.log('\n🔧 Fixing creates data...');
    let fixed = 0;

    creates.forEach(event => {
      let needsFix = false;

      // Fix protocol day if missing/undefined
      if (!event.protocolDay || event.protocolDay === undefined) {
        event.protocolDay = getProtocolDay(parseInt(event.timestamp));
        console.log(`  Fixed protocol day for ${event.user.substring(0,10)}... -> Day ${event.protocolDay}`);
        needsFix = true;
      }

      // Fix TitanX cost if missing or zero
      if (!event.costTitanX || event.costTitanX === "0.0" || parseFloat(event.costTitanX || 0) === 0) {
        const userPos = userPositions.get(event.user);
        if (userPos) {
          const eventMaturityTime = Math.floor(new Date(event.maturityDate).getTime() / 1000);
          const matchingPosition = userPos.find(pos => 
            Math.abs(Number(pos.endTime) - eventMaturityTime) < 172800 && pos.isCreate
          );
          
          if (matchingPosition) {
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
            console.log(`  Fixed TitanX cost for ${event.user.substring(0,10)}... -> ${event.costTitanX} TitanX`);
            needsFix = true;
          }
        }
      }

      if (needsFix) fixed++;
    });

    console.log(`\n✅ Fixed ${fixed} creates`);

    // Save updated data
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(data, null, 2));
    console.log('💾 Updated cached-data.json');

    // Final verification
    const remainingIssues = creates.filter(c => 
      !c.protocolDay || 
      c.protocolDay === undefined ||
      c.protocolDay > 20
    );

    if (remainingIssues.length > 0) {
      console.log(`\n⚠️  ${remainingIssues.length} creates still have protocol day issues`);
    } else {
      console.log('\n🎉 All creates now have valid protocol days!');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

fixCreatesData().catch(console.error);