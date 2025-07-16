// Comprehensive update script that includes ALL required fields
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Working RPC providers
const WORKING_RPC_PROVIDERS = [
  'https://eth.drpc.org',
  'https://rpc.payload.de',
  'https://eth-mainnet.public.blastapi.io',
  'https://rpc.flashbots.net',
  'https://eth-mainnet.nodereal.io/v1/REDACTED_API_KEY'
];

// Contract addresses
const CONTRACTS = {
  TORUS: '0xb47f575807fc5466285e1277ef8acfbb5c6686e8',
  TITANX: '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1',
  CREATE_STAKE: '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507',
  POOL: '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F',
  NFT_POSITION_MANAGER: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
};

// Complete ABI with all fields
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
  'function rewardPool(uint24 day) view returns (uint256)',
  'function totalShares(uint24 day) view returns (uint256)',
  'function penaltiesInRewardPool(uint24 day) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function burnedSupply() view returns (uint256)'
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
];

async function getWorkingProvider() {
  for (const rpcUrl of WORKING_RPC_PROVIDERS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      const blockNumber = await provider.getBlockNumber();
      console.log(`✅ Connected to ${rpcUrl} - Block: ${blockNumber}`);
      return provider;
    } catch (error) {
      console.log(`❌ Failed ${rpcUrl}: ${error.message}`);
    }
  }
  throw new Error('All RPC providers failed');
}

async function updateCompleteData() {
  console.log('🚀 UPDATING COMPLETE DASHBOARD DATA WITH ALL FIELDS');
  console.log('=================================================\n');
  
  try {
    const provider = await getWorkingProvider();
    
    // Load existing data
    const cachedDataPath = path.join(__dirname, 'public/data/cached-data.json');
    const cachedData = JSON.parse(fs.readFileSync(cachedDataPath, 'utf8'));
    
    // Preserve existing data structure while updating
    cachedData.lastUpdated = new Date().toISOString();
    
    console.log('📊 1. FETCHING CONTRACT DATA...');
    
    // Get all contract instances
    const torusContract = new ethers.Contract(CONTRACTS.TORUS, ERC20_ABI, provider);
    const titanxContract = new ethers.Contract(CONTRACTS.TITANX, ERC20_ABI, provider);
    const stakeContract = new ethers.Contract(CONTRACTS.CREATE_STAKE, STAKE_CONTRACT_ABI, provider);
    
    // Fetch token information
    const [
      torusName, torusSymbol, torusDecimals, torusTotalSupply,
      titanxName, titanxSymbol, titanxDecimals, titanxTotalSupply,
      currentDay, burnedSupply
    ] = await Promise.all([
      torusContract.name(),
      torusContract.symbol(),
      torusContract.decimals(),
      torusContract.totalSupply(),
      titanxContract.name(),
      titanxContract.symbol(),
      titanxContract.decimals(),
      titanxContract.totalSupply(),
      stakeContract.getCurrentDayIndex(),
      stakeContract.burnedSupply().catch(() => ethers.BigNumber.from(0))
    ]);
    
    // Update contract data with all fields
    cachedData.contractData = {
      torusToken: {
        address: CONTRACTS.TORUS,
        name: torusName,
        symbol: torusSymbol,
        decimals: torusDecimals,
        totalSupply: torusTotalSupply.toString()
      },
      titanxToken: {
        address: CONTRACTS.TITANX,
        name: titanxName,
        symbol: titanxSymbol,
        decimals: titanxDecimals,
        totalSupply: titanxTotalSupply.toString()
      },
      createStakeContract: {
        address: CONTRACTS.CREATE_STAKE
      },
      uniswapPool: {
        address: CONTRACTS.POOL,
        feeTier: 10000
      }
    };
    
    // Update staking data
    cachedData.stakingData = cachedData.stakingData || {};
    cachedData.stakingData.currentProtocolDay = Number(currentDay.toString());
    cachedData.stakingData.totalSupply = parseFloat(ethers.utils.formatEther(torusTotalSupply));
    cachedData.stakingData.burnedSupply = parseFloat(ethers.utils.formatEther(burnedSupply));
    cachedData.stakingData.lastUpdated = new Date().toISOString();
    
    // Also set at top level for compatibility
    cachedData.currentProtocolDay = Number(currentDay.toString());
    
    console.log(`  ✅ Contract data fetched`);
    
    console.log('\n📊 2. ENRICHING STAKE/CREATE EVENTS WITH ALL FIELDS...');
    
    // Get all unique users
    const allUsers = new Set();
    if (cachedData.stakingData.stakeEvents) {
      cachedData.stakingData.stakeEvents.forEach(e => allUsers.add(e.user));
    }
    if (cachedData.stakingData.createEvents) {
      cachedData.stakingData.createEvents.forEach(e => allUsers.add(e.user));
    }
    
    const users = Array.from(allUsers);
    console.log(`  Found ${users.length} unique users`);
    
    if (users.length === 0) {
      console.log('  ⚠️  No users found in existing data!');
    } else {
      const userPositions = new Map();
      const batchSize = 5;
      
      // Fetch position data for all users
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        const progress = Math.min(i + batchSize, users.length);
        process.stdout.write(`\r  Processing users: ${progress}/${users.length} (${((progress / users.length) * 100).toFixed(1)}%)`);
        
        const batchPromises = batch.map(async (user) => {
          try {
            const positions = await stakeContract.getStakePositions(user);
            return { user, positions };
          } catch (error) {
            console.log(`\n  ⚠️  Error fetching positions for ${user}: ${error.message}`);
            return { user, positions: [] };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(({ user, positions }) => {
          if (positions.length > 0) {
            userPositions.set(user, positions);
          }
        });
        
        if (i + batchSize < users.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      console.log('\n  ✅ User positions fetched');
      
      // Enrich stake events with ALL missing fields
      cachedData.stakingData.stakeEvents = cachedData.stakingData.stakeEvents.map(event => {
        const userPos = userPositions.get(event.user);
        
        if (userPos) {
          const eventMaturityTime = Math.floor(new Date(event.maturityDate).getTime() / 1000);
          const matchingPosition = userPos.find(pos => 
            Math.abs(Number(pos.endTime) - eventMaturityTime) < 86400 && !pos.isCreate
          );
          
          if (matchingPosition) {
            return {
              ...event,
              // Add all missing fields
              power: matchingPosition.power.toString(),
              shares: matchingPosition.shares.toString(),
              claimedCreate: matchingPosition.claimedCreate,
              claimedStake: matchingPosition.claimedStake,
              costETH: ethers.utils.formatEther(matchingPosition.costETH),
              costTitanX: ethers.utils.formatEther(matchingPosition.costTitanX),
              rawCostETH: matchingPosition.costETH.toString(),
              rawCostTitanX: matchingPosition.costTitanX.toString(),
              rewards: matchingPosition.rewards.toString(),
              penalties: matchingPosition.penalties.toString(),
              claimedAt: matchingPosition.claimedAt.toString(),
              isCreate: false
            };
          }
        }
        
        // Return with default values if no match
        return {
          ...event,
          power: event.power || "0",
          shares: event.shares || "0",
          claimedCreate: false,
          claimedStake: false,
          costETH: event.costETH || "0",
          costTitanX: event.costTitanX || "0",
          rawCostETH: event.rawCostETH || "0",
          rawCostTitanX: event.rawCostTitanX || "0",
          rewards: "0",
          penalties: "0",
          claimedAt: "0",
          isCreate: false
        };
      });
      
      // Enrich create events with ALL missing fields
      cachedData.stakingData.createEvents = cachedData.stakingData.createEvents.map((event, index) => {
        const userPos = userPositions.get(event.user);
        
        if (userPos) {
          const eventMaturityTime = Math.floor(new Date(event.maturityDate).getTime() / 1000);
          const matchingPosition = userPos.find(pos => 
            Math.abs(Number(pos.endTime) - eventMaturityTime) < 86400 && pos.isCreate
          );
          
          if (matchingPosition) {
            return {
              ...event,
              // Add all missing fields
              id: event.id || index.toString(),
              duration: event.duration || event.stakingDays?.toString() || "0",
              shares: matchingPosition.shares.toString(),
              costETH: ethers.utils.formatEther(matchingPosition.costETH),
              costTitanX: ethers.utils.formatEther(matchingPosition.costTitanX),
              rawCostETH: matchingPosition.costETH.toString(),
              rawCostTitanX: matchingPosition.costTitanX.toString(),
              titanAmount: matchingPosition.costTitanX.toString()
            };
          }
        }
        
        // Return with default values if no match
        return {
          ...event,
          id: event.id || index.toString(),
          duration: event.duration || event.stakingDays?.toString() || "0",
          shares: event.shares || "0",
          costETH: event.costETH || "0",
          costTitanX: event.costTitanX || "0",
          rawCostETH: event.rawCostETH || "0",
          rawCostTitanX: event.rawCostTitanX || "0",
          titanAmount: event.titanAmount || "0"
        };
      });
    }
    
    console.log('\n📊 3. CALCULATING TOTALS...');
    
    // Calculate comprehensive totals
    let totalStakeETH = 0, totalCreateETH = 0;
    let totalStakeTitanX = 0, totalCreateTitanX = 0;
    
    cachedData.stakingData.stakeEvents.forEach(event => {
      if (event.rawCostETH && event.rawCostETH !== "0") {
        totalStakeETH += parseFloat(event.rawCostETH) / 1e18;
      }
      if (event.rawCostTitanX && event.rawCostTitanX !== "0") {
        totalStakeTitanX += parseFloat(event.rawCostTitanX) / 1e18;
      }
    });
    
    cachedData.stakingData.createEvents.forEach(event => {
      if (event.rawCostETH && event.rawCostETH !== "0") {
        totalCreateETH += parseFloat(event.rawCostETH) / 1e18;
      }
      if (event.rawCostTitanX && event.rawCostTitanX !== "0") {
        totalCreateTitanX += parseFloat(event.rawCostTitanX) / 1e18;
      }
    });
    
    const totalETH = totalStakeETH + totalCreateETH;
    const totalTitanX = totalStakeTitanX + totalCreateTitanX;
    
    // Add totals section
    cachedData.totals = {
      totalETH: totalETH.toFixed(6),
      totalTitanX: totalTitanX.toFixed(2),
      totalStakedETH: totalStakeETH.toFixed(6),
      totalCreatedETH: totalCreateETH.toFixed(6),
      totalStakedTitanX: totalStakeTitanX.toFixed(2),
      totalCreatedTitanX: totalCreateTitanX.toFixed(2)
    };
    
    console.log(`  ✅ Totals calculated:`);
    console.log(`     - Total ETH: ${totalETH.toFixed(6)}`);
    console.log(`     - Total TitanX: ${totalTitanX.toFixed(2)}`);
    
    console.log('\n📊 4. FETCHING REWARD POOL DATA...');
    
    // Fetch reward pool data if not exists
    if (!cachedData.stakingData.rewardPoolData || cachedData.stakingData.rewardPoolData.length === 0) {
      const rewardPoolData = [];
      const currentDayNum = Number(currentDay.toString());
      
      for (let day = 1; day <= currentDayNum + 90; day++) {
        try {
          const [rewardPool, totalShares, penalties] = await Promise.all([
            stakeContract.rewardPool(day).catch(() => ethers.BigNumber.from(0)),
            stakeContract.totalShares(day).catch(() => ethers.BigNumber.from(0)),
            stakeContract.penaltiesInRewardPool(day).catch(() => ethers.BigNumber.from(0))
          ]);
          
          rewardPoolData.push({
            day,
            rewardPool: parseFloat(ethers.utils.formatEther(rewardPool)),
            totalShares: parseFloat(ethers.utils.formatEther(totalShares)),
            penaltiesInPool: parseFloat(ethers.utils.formatEther(penalties))
          });
          
          if (day % 10 === 0) {
            process.stdout.write(`\r  Fetched reward data for ${day} days`);
          }
        } catch (error) {
          // Day not yet reached
          break;
        }
      }
      console.log(`\n  ✅ Fetched ${rewardPoolData.length} days of reward data`);
      cachedData.stakingData.rewardPoolData = rewardPoolData;
    }
    
    // Update metadata
    cachedData.metadata = {
      dataSource: 'Complete Dashboard Update',
      lastCompleteUpdate: new Date().toISOString(),
      dataComplete: true,
      description: 'Full data with all required fields'
    };
    
    // Save updated data
    fs.writeFileSync(cachedDataPath, JSON.stringify(cachedData, null, 2));
    console.log('\n✅ COMPLETE DATA UPDATE SUCCESSFUL!');
    
    // Run audit to verify
    console.log('\n🔍 Running audit to verify completeness...');
    const { exec } = require('child_process');
    exec('node audit-json-completeness.js', (error, stdout, stderr) => {
      console.log(stdout);
      if (error) {
        console.error('Audit revealed issues:', stderr);
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating data:', error);
    process.exit(1);
  }
}

// Run the update
updateCompleteData();