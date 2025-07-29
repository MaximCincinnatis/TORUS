const { ethers } = require('ethers');
const fs = require('fs');

// RPC providers
const WORKING_RPC_PROVIDERS = [
  'https://eth.drpc.org',
  'https://rpc.payload.de',
  'https://eth-mainnet.public.blastapi.io',
  'https://rpc.flashbots.net',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth'
];

const CONTRACTS = {
  CREATE_STAKE: '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507'
};

const STAKE_CONTRACT_ABI = [
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
];

async function getWorkingProvider() {
  for (const rpcUrl of WORKING_RPC_PROVIDERS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 3000);
      });
      const blockNumber = await Promise.race([provider.getBlockNumber(), timeoutPromise]);
      console.log(`✅ Connected to ${rpcUrl} - Block: ${blockNumber}`);
      return provider;
    } catch (error) {
      console.log(`❌ Failed ${rpcUrl}: ${error.message}`);
    }
  }
  throw new Error('All RPC providers failed');
}

function getDateFromProtocolDay(protocolDay) {
  const CONTRACT_START_DATE = new Date('2025-07-09T18:00:00.000Z');
  const targetDate = new Date(CONTRACT_START_DATE);
  targetDate.setUTCDate(targetDate.getUTCDate() + protocolDay);
  return targetDate.toISOString().split('T')[0];
}

async function main() {
  console.log('FIX ZERO SHARES: CORRECTING CACHED DATA WITH CONTRACT VALUES');
  console.log('=============================================================\n');

  try {
    // Get provider and contract
    const provider = await getWorkingProvider();
    const stakeContract = new ethers.Contract(CONTRACTS.CREATE_STAKE, STAKE_CONTRACT_ABI, provider);

    // Load cached data
    const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    const createData = cachedData.stakingData?.createEvents || [];

    console.log(`Loaded ${createData.length} create events from cached data\n`);

    // Find positions with zero shares from Days 17-18
    const zeroSharesPositions = createData.filter(event => {
      return !event.shares || parseFloat(event.shares) === 0;
    });

    console.log(`Found ${zeroSharesPositions.length} positions with zero shares\n`);

    // Group by creation day to understand the pattern
    const dayGroups = {};
    zeroSharesPositions.forEach(pos => {
      if (pos.startDate) {
        const startDate = new Date(pos.startDate);
        const CONTRACT_START_DATE = new Date('2025-07-09T18:00:00.000Z');
        const diffTime = startDate.getTime() - CONTRACT_START_DATE.getTime();
        const protocolDay = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (!dayGroups[protocolDay]) {
          dayGroups[protocolDay] = [];
        }
        dayGroups[protocolDay].push(pos);
      }
    });

    console.log('Zero-shares positions by creation day:');
    Object.entries(dayGroups)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([day, positions]) => {
        const date = getDateFromProtocolDay(parseInt(day));
        console.log(`  Day ${day} (${date}): ${positions.length} positions`);
      });

    // Get unique users with zero shares
    const affectedUsers = [...new Set(zeroSharesPositions.map(p => p.user))];
    console.log(`\nAffected users: ${affectedUsers.length}`);

    let fixedCount = 0;
    let totalProcessed = 0;

    // Process each affected user
    for (const user of affectedUsers) {
      console.log(`\nProcessing user: ${user}`);
      totalProcessed++;

      try {
        // Get positions from contract
        const contractPositions = await stakeContract.getStakePositions(user);
        const createPositions = contractPositions.filter(pos => pos.isCreate);
        
        console.log(`  Contract has ${createPositions.length} create positions`);

        // Find cached events for this user with zero shares
        const userZeroShares = zeroSharesPositions.filter(event => event.user === user);
        console.log(`  Cached data has ${userZeroShares.length} zero-shares events`);

        // Try to match each zero-shares cached event with a contract position
        for (const cachedEvent of userZeroShares) {
          const eventMaturityTime = Math.floor(new Date(cachedEvent.maturityDate).getTime() / 1000);
          
          // Find matching contract position (within 2 days for better matching)
          const matchingPosition = createPositions.find(pos => 
            Math.abs(Number(pos.endTime) - eventMaturityTime) < 172800 // 48 hours
          );

          if (matchingPosition && matchingPosition.shares.gt(0)) {
            const contractShares = matchingPosition.shares.toString();
            const contractSharesFormatted = ethers.utils.formatEther(matchingPosition.shares);
            
            console.log(`  ✅ MATCH FOUND:`);
            console.log(`     Cached shares: ${cachedEvent.shares || '0'}`);
            console.log(`     Contract shares: ${contractSharesFormatted} TORUS`);
            console.log(`     Principal: ${ethers.utils.formatEther(matchingPosition.principal)} ETH`);
            console.log(`     Days: ${matchingPosition.stakingDays}`);

            // Update the cached event with correct shares
            cachedEvent.shares = contractShares;
            
            // Also add missing term field
            cachedEvent.term = matchingPosition.stakingDays.toString();
            
            fixedCount++;
          } else {
            console.log(`  ❌ No matching contract position found`);
          }
        }

        // Small delay to be nice to RPC
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.log(`  ❌ Error processing ${user}: ${error.message}`);
      }
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total users processed: ${totalProcessed}`);
    console.log(`Positions fixed: ${fixedCount}`);
    console.log(`Zero-shares positions remaining: ${zeroSharesPositions.filter(p => !p.shares || parseFloat(p.shares) === 0).length}`);

    if (fixedCount > 0) {
      console.log(`\n💾 Saving updated cached data...`);
      
      // Create backup
      const backupPath = `./public/data/cached-data-backup-${Date.now()}.json`;
      fs.writeFileSync(backupPath, JSON.stringify(cachedData, null, 2));
      console.log(`   Backup saved to: ${backupPath}`);
      
      // Save updated data
      fs.writeFileSync('./public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
      console.log(`   ✅ Updated cached-data.json with ${fixedCount} fixes`);

      // Verify the fix worked
      const verifyData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
      const verifyCreateData = verifyData.stakingData?.createEvents || [];
      const stillZeroShares = verifyCreateData.filter(event => !event.shares || parseFloat(event.shares) === 0);
      
      console.log(`\n📊 Verification:`);
      console.log(`   Total create events: ${verifyCreateData.length}`);
      console.log(`   Zero-shares events remaining: ${stillZeroShares.length}`);
      
      if (stillZeroShares.length === 0) {
        console.log(`   🎉 ALL ZERO-SHARES ISSUES FIXED!`);
      } else {
        console.log(`   ⚠️  Some zero-shares positions still remain (may be legitimate)`);
      }
    } else {
      console.log(`\n❌ No fixes applied - all positions may already be correct`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();