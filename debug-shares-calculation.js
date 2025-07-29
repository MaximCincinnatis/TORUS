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
  },
  'function getCurrentDayIndex() view returns (uint24)',
  'function calculateShares(uint256 principal, uint24 stakingDays) view returns (uint256)',
  'function calculateBonusShares(uint256 principal, uint24 stakingDays) view returns (uint256)'
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
  console.log('DEBUG: SHARES CALCULATION FOR ZERO-SHARES POSITIONS');
  console.log('=================================================\n');

  try {
    // Get provider and contract
    const provider = await getWorkingProvider();
    const stakeContract = new ethers.Contract(CONTRACTS.CREATE_STAKE, STAKE_CONTRACT_ABI, provider);

    // Load cached data to find affected users
    const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
    const createData = cachedData.stakingData?.createEvents || [];

    // Find Day 106 positions with zero shares (created on Days 17-18)
    const day106Date = getDateFromProtocolDay(106);
    const zeroSharesPositions = createData.filter(create => {
      const maturityDate = create.maturityDate instanceof Date ? create.maturityDate : new Date(create.maturityDate);
      const dateKey = maturityDate.toISOString().split('T')[0];
      return dateKey === day106Date && (!create.shares || parseFloat(create.shares) === 0);
    });

    console.log(`Found ${zeroSharesPositions.length} zero-shares positions maturing on Day 106\n`);

    // Investigate a few sample users
    const sampleUsers = [...new Set(zeroSharesPositions.slice(0, 5).map(p => p.user))];

    for (const user of sampleUsers) {
      console.log(`\n=== INVESTIGATING USER: ${user} ===`);
      
      try {
        // Get all positions for this user directly from contract
        const positions = await stakeContract.getStakePositions(user);
        console.log(`Contract returned ${positions.length} positions for this user`);

        // Find the create positions from this user
        const createPositions = positions.filter(pos => pos.isCreate);
        console.log(`Create positions: ${createPositions.length}`);

        for (let idx = 0; idx < createPositions.length; idx++) {
          const pos = createPositions[idx];
          console.log(`\nCreate Position ${idx + 1}:`);
          console.log(`  Principal: ${ethers.utils.formatEther(pos.principal)} ETH`);
          console.log(`  Shares: ${ethers.utils.formatEther(pos.shares)} TORUS`);
          console.log(`  Staking Days: ${pos.stakingDays}`);
          console.log(`  Start Time: ${new Date(pos.startTime.toNumber() * 1000).toISOString()}`);
          console.log(`  End Time: ${new Date(pos.endTime.toNumber() * 1000).toISOString()}`);
          console.log(`  Start Day Index: ${pos.startDayIndex}`);
          console.log(`  Cost ETH: ${ethers.utils.formatEther(pos.costETH)} ETH`);
          console.log(`  Cost TitanX: ${ethers.utils.formatEther(pos.costTitanX)} TitanX`);
          console.log(`  Claimed Create: ${pos.claimedCreate}`);
          console.log(`  Claimed Stake: ${pos.claimedStake}`);

          // Check if this matches the zero-shares position
          const endDateContract = new Date(pos.endTime.toNumber() * 1000).toISOString().split('T')[0];
          if (endDateContract === day106Date) {
            console.log(`  🎯 THIS MATCHES THE ZERO-SHARES POSITION!`);
            
            // Let's see if we can calculate shares manually
            console.log(`\n  MANUAL SHARES CALCULATION ATTEMPT:`);
            if (pos.principal.gt(0) && pos.stakingDays > 0) {
              try {
                // Try to call the contract's shares calculation function if it exists
                const calculatedShares = await stakeContract.calculateShares(pos.principal, pos.stakingDays);
                console.log(`    Contract calculateShares(): ${ethers.utils.formatEther(calculatedShares)} TORUS`);
              } catch (err) {
                console.log(`    Contract calculateShares() not available: ${err.message}`);
              }

              // Manual calculation based on typical staking formulas
              const principalETH = parseFloat(ethers.utils.formatEther(pos.principal));
              const days = pos.stakingDays;
              
              // Common formulas for share calculation:
              // 1. Simple: shares = principal
              const simpleShares = principalETH;
              console.log(`    Simple (principal only): ${simpleShares.toFixed(4)} shares`);
              
              // 2. Time bonus: shares = principal * (1 + days/365)
              const timeBonusShares = principalETH * (1 + days / 365);
              console.log(`    Time bonus: ${timeBonusShares.toFixed(4)} shares`);
              
              // 3. Power function: shares = principal * sqrt(days)
              const powerShares = principalETH * Math.sqrt(days);
              console.log(`    Power function: ${powerShares.toFixed(4)} shares`);

              // 4. Check if there's a minimum principal threshold
              console.log(`    Principal check: ${principalETH} ETH`);
              if (principalETH < 0.001) {
                console.log(`    ⚠️  Principal below typical minimum threshold (0.001 ETH)`);
              }
            }
          }
        }

      } catch (error) {
        console.log(`❌ Error fetching positions for ${user}: ${error.message}`);
      }
    }

    // Check if there's a pattern with creation dates
    console.log(`\n\n=== CREATION DATE ANALYSIS ===`);
    console.log('Checking when these zero-shares positions were originally created...\n');

    const creationDays = zeroSharesPositions.map(pos => {
      if (pos.startDate) {
        const startDate = new Date(pos.startDate);
        const CONTRACT_START_DATE = new Date('2025-07-09T18:00:00.000Z');
        const diffTime = startDate.getTime() - CONTRACT_START_DATE.getTime();
        const protocolDay = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return protocolDay;
      }
      return null;
    }).filter(day => day !== null);

    const dayCount = {};
    creationDays.forEach(day => {
      dayCount[day] = (dayCount[day] || 0) + 1;
    });

    console.log('Creation day distribution for zero-shares positions:');
    Object.entries(dayCount)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([day, count]) => {
        const date = getDateFromProtocolDay(parseInt(day));
        console.log(`  Day ${day} (${date}): ${count} positions`);
      });

    // Check current protocol day
    const currentDay = await stakeContract.getCurrentDayIndex();
    console.log(`\nCurrent protocol day: ${currentDay}`);

    console.log(`\n=== CONCLUSIONS ===`);
    console.log('1. The shares values come directly from the smart contract');
    console.log('2. For positions created on Days 17-18, the contract returns 0 shares');
    console.log('3. This could be due to:');
    console.log('   - Contract bug in shares calculation for specific conditions');
    console.log('   - Minimum principal threshold not met');
    console.log('   - Time-based calculation error');
    console.log('   - State corruption in contract storage');
    console.log('4. The fix needs to either:');
    console.log('   - Recalculate shares manually using the correct formula');
    console.log('   - Or identify why the contract calculation failed');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();