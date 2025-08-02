/**
 * Incremental update script for creates and stakes
 * Updates only new events since last update
 * Can be run every 5 minutes via cron
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { 
  CONTRACT_ADDRESSES, 
  EVENT_ABIS,
  EVENT_TOPICS,
  getProtocolDay 
} = require('./shared/contractConstants');
const { getActualTitanXFromStake } = require('./shared/titanXHelpers');
const { calculateTotalSharesForDay } = require('./shared/totalSharesCalculator');
const { generateFutureSupplyProjection, shouldUpdateProjection } = require('./generate-future-supply-projection-fixed');

// Constants for reward pool
const INITIAL_REWARD_POOL = 100000;
const DAILY_REDUCTION_RATE = 0.0008;

// Calculate base reward pool for a given day
function calculateRewardPoolForDay(day) {
  if (day < 1) return 0;
  
  let rewardPool = INITIAL_REWARD_POOL;
  for (let i = 1; i < day; i++) {
    rewardPool = rewardPool * (1 - DAILY_REDUCTION_RATE);
  }
  
  return rewardPool;
}

// Working RPC providers
const WORKING_RPC_PROVIDERS = [
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.payload.de',
  'https://eth-mainnet.public.blastapi.io',
  'https://rpc.flashbots.net',
  'https://eth.drpc.org'
];

// Rate limiting
const RATE_LIMIT_DELAY = 150; // ms between requests
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Contract addresses
const CONTRACTS = {
  CREATE_STAKE: CONTRACT_ADDRESSES.CREATE_STAKE,
  TITANX: CONTRACT_ADDRESSES.TITANX
};

// Simplified ABI for stake contract
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

// Get working provider
async function getProvider() {
  for (const rpc of WORKING_RPC_PROVIDERS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpc);
      await provider.getBlockNumber();
      console.log(`✅ Connected to ${rpc}`);
      return provider;
    } catch (e) {
      console.log(`❌ Failed to connect to ${rpc}`);
    }
  }
  throw new Error('No working RPC provider found');
}

// Process a single create event
async function processCreateEvent(event, provider, timestamp) {
  try {
    const createData = {
      user: event.args.user.toLowerCase(),
      stakeIndex: event.args.stakeIndex.toString(),
      torusAmount: event.args.torusAmount.toString(),
      endTime: event.args.endTime.toString(),
      maturityDate: new Date(Number(event.args.endTime) * 1000).toISOString(),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      timestamp: timestamp.toString(),
      protocolDay: getProtocolDay(timestamp)
    };
    
    // Get transaction to check if ETH or TitanX
    const tx = await provider.getTransaction(event.transactionHash);
    
    if (tx.value && !tx.value.isZero()) {
      // ETH create
      createData.costETH = ethers.utils.formatEther(tx.value);
      createData.rawCostETH = tx.value.toString();
      createData.costTitanX = "0.0";
      createData.rawCostTitanX = "0";
      createData.titanAmount = "0";
    } else {
      // TitanX create
      createData.costETH = "0.0";
      createData.rawCostETH = "0";
      
      const receipt = await provider.getTransactionReceipt(event.transactionHash);
      const titanXTransfer = receipt.logs.find(log => 
        log.address.toLowerCase() === CONTRACTS.TITANX.toLowerCase() &&
        log.topics[0] === EVENT_TOPICS.TRANSFER &&
        log.topics.length >= 3
      );
      
      if (titanXTransfer && titanXTransfer.data !== '0x') {
        const titanXAmount = BigInt(titanXTransfer.data).toString();
        createData.rawCostTitanX = titanXAmount;
        createData.costTitanX = ethers.utils.formatEther(titanXTransfer.data);
        createData.titanAmount = titanXAmount;
      } else {
        createData.costTitanX = "0.0";
        createData.rawCostTitanX = "0";
        createData.titanAmount = "0";
      }
    }
    
    return createData;
  } catch (error) {
    console.error(`Error processing create event: ${error.message}`);
    return null;
  }
}

// Process a single stake event  
async function processStakeEvent(event, provider, timestamp) {
  try {
    const stakingDays = parseInt(event.args.stakingDays);
    const maturityTimestamp = timestamp + (stakingDays * 24 * 60 * 60);
    
    const stakeData = {
      user: event.args.user.toLowerCase(),
      stakeIndex: event.args.stakeIndex.toString(),
      principal: event.args.principal.toString(),
      stakingDays: stakingDays.toString(),
      shares: event.args.shares.toString(),
      maturityDate: new Date(maturityTimestamp * 1000).toISOString(),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      timestamp: timestamp.toString(),
      protocolDay: getProtocolDay(timestamp)
    };
    
    // Get transaction to check if ETH or TitanX
    const tx = await provider.getTransaction(event.transactionHash);
    
    if (tx.value && !tx.value.isZero()) {
      // ETH stake - need to get actual TitanX amount from Transfer events
      stakeData.costETH = ethers.utils.formatEther(tx.value);
      stakeData.rawCostETH = tx.value.toString();
      
      // Get actual TitanX amount from Transfer events
      const actualTitanX = await getActualTitanXFromStake(event.transactionHash, provider);
      stakeData.rawCostTitanX = actualTitanX;
      stakeData.costTitanX = ethers.utils.formatEther(actualTitanX);
      stakeData.titanAmount = actualTitanX;
    } else {
      // TitanX stake - still need to get actual TitanX amount from Transfer events
      stakeData.costETH = "0.0";
      stakeData.rawCostETH = "0";
      
      // Get actual TitanX amount from Transfer events
      const actualTitanX = await getActualTitanXFromStake(event.transactionHash, provider);
      stakeData.rawCostTitanX = actualTitanX;
      stakeData.costTitanX = ethers.utils.formatEther(actualTitanX);
      stakeData.titanAmount = actualTitanX;
    }
    
    return stakeData;
  } catch (error) {
    console.error(`Error processing stake event: ${error.message}`);
    return null;
  }
}

// Get shares data for events
async function getSharesData(events, stakeContract, provider) {
  console.log('  📊 Fetching shares data...');
  
  // Get unique users
  const uniqueUsers = new Set();
  events.creates.forEach(event => uniqueUsers.add(event.user));
  events.stakes.forEach(event => uniqueUsers.add(event.user));
  
  console.log(`  📊 Found ${uniqueUsers.size} unique users to query`);
  
  // Map to store user positions
  const userPositions = new Map();
  
  // Fetch positions for each user
  let userCount = 0;
  for (const user of uniqueUsers) {
    userCount++;
    if (userCount % 20 === 0) {
      console.log(`  📊 Progress: ${userCount}/${uniqueUsers.size} users`);
    }
    
    try {
      await sleep(RATE_LIMIT_DELAY);
      const positions = await stakeContract.getStakePositions(user);
      
      if (positions.length > 0) {
        userPositions.set(user, positions);
      }
    } catch (error) {
      console.warn(`  ⚠️  Error fetching positions for ${user}: ${error.message}`);
    }
  }
  
  console.log(`  ✅ Fetched positions for ${userPositions.size} users`);
  
  // Match creates with positions
  let createsWithShares = 0;
  events.creates.forEach(event => {
    const userPos = userPositions.get(event.user);
    if (userPos) {
      const eventTime = parseInt(event.timestamp);
      const matchingPosition = userPos.find(pos => 
        Math.abs(Number(pos.startTime) - eventTime) < 300 && pos.isCreate
      );
      
      if (matchingPosition) {
        event.shares = matchingPosition.shares.toString();
        createsWithShares++;
      }
    }
  });
  
  // Match stakes with positions
  let stakesWithShares = 0;
  events.stakes.forEach(event => {
    const userPos = userPositions.get(event.user);
    if (userPos) {
      const eventTime = parseInt(event.timestamp);
      const matchingPosition = userPos.find(pos => 
        Math.abs(Number(pos.startTime) - eventTime) < 300 && !pos.isCreate
      );
      
      if (matchingPosition) {
        event.shares = matchingPosition.shares.toString();
        stakesWithShares++;
      }
    }
  });
  
  console.log(`  ✅ Creates with shares: ${createsWithShares}/${events.creates.length}`);
  console.log(`  ✅ Stakes with shares: ${stakesWithShares}/${events.stakes.length}`);
}

// Main update function
async function updateCreatesStakes() {
  console.log('\n🔄 Starting incremental create/stake update...');
  
  try {
    // Load current data
    const dataPath = path.join(__dirname, '../public/data/cached-data.json');
    const cachedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Create backup before any modifications
    const backupPath = path.join(__dirname, '../public/data', `cached-data.backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(cachedData, null, 2));
    console.log(`  💾 Created backup at: ${path.basename(backupPath)}`);
    
    // Get last processed block
    let lastBlock = 22890272; // Deployment block
    if (cachedData.stakingData?.createEvents?.length > 0) {
      const lastCreate = cachedData.stakingData.createEvents[cachedData.stakingData.createEvents.length - 1];
      lastBlock = Math.max(lastBlock, lastCreate.blockNumber || lastBlock);
    }
    if (cachedData.stakingData?.stakeEvents?.length > 0) {
      const lastStake = cachedData.stakingData.stakeEvents[cachedData.stakingData.stakeEvents.length - 1];
      lastBlock = Math.max(lastBlock, lastStake.blockNumber || lastBlock);
    }
    
    console.log(`  📊 Last processed block: ${lastBlock}`);
    
    // Get provider and current block
    const provider = await getProvider();
    let currentBlock = await provider.getBlockNumber();
    
    // For testing, allow override of end block
    if (process.env.TEST_END_BLOCK) {
      currentBlock = Math.min(currentBlock, parseInt(process.env.TEST_END_BLOCK));
    }
    
    // Check if update needed
    const blockDiff = currentBlock - lastBlock;
    if (blockDiff < 10) {
      console.log(`  ✅ Only ${blockDiff} new blocks, no update needed`);
      return;
    }
    
    // Check for existing data
    const hasExistingData = (cachedData.stakingData?.createEvents?.length > 0) || 
                           (cachedData.stakingData?.stakeEvents?.length > 0);
    
    // Just warn if gap is large, but continue - we have chunking
    if (blockDiff > 50000) {
      console.log(`  ⚠️  Large block gap detected (${blockDiff} blocks)`);
      console.log(`  ⚠️  This may take several minutes due to chunking...`);
    }
    
    console.log(`  📊 Fetching events from block ${lastBlock + 1} to ${currentBlock} (${blockDiff} blocks)`);
    
    // Get contract instance
    const stakeContract = new ethers.Contract(CONTRACTS.CREATE_STAKE, STAKE_CONTRACT_ABI, provider);
    
    // Handle large block ranges by chunking
    const MAX_BLOCK_RANGE = 10000;
    let fromBlock = lastBlock + 1;
    const toBlock = currentBlock;
    
    // Collect all events in chunks
    const allCreates = [];
    const allStakes = [];
    
    while (fromBlock <= toBlock) {
      const chunkEnd = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, toBlock);
      console.log(`  📊 Fetching chunk: blocks ${fromBlock} to ${chunkEnd}`);
      
      try {
        // Fetch events for this chunk
        const [creates, stakes] = await Promise.all([
          provider.getLogs({
            address: CONTRACTS.CREATE_STAKE,
            topics: [EVENT_TOPICS.CREATED],
            fromBlock: fromBlock,
            toBlock: chunkEnd
          }),
          provider.getLogs({
            address: CONTRACTS.CREATE_STAKE,
            topics: [EVENT_TOPICS.STAKED],
            fromBlock: fromBlock,
            toBlock: chunkEnd
          })
        ]);
        
        allCreates.push(...creates);
        allStakes.push(...stakes);
        
        fromBlock = chunkEnd + 1;
        await sleep(RATE_LIMIT_DELAY);
      } catch (error) {
        console.error(`  ❌ Error fetching events for chunk ${fromBlock}-${chunkEnd}:`, error.message);
        
        // If we have existing data and encounter an error, preserve it
        if (hasExistingData) {
          console.log('  ⚠️  Preserving existing data due to fetch error');
          console.log('  ⚠️  Restoring from backup...');
          
          // Restore the backup we created
          const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
          fs.writeFileSync(dataPath, JSON.stringify(backupData, null, 2));
          
          console.log('  ✅ Data restored from backup');
          return;
        } else {
          // If no existing data, we can throw the error
          throw error;
        }
      }
    }
    
    const creates = allCreates;
    const stakes = allStakes;
    
    console.log(`  📊 Found ${creates.length} new creates and ${stakes.length} new stakes`);
    
    if (creates.length === 0 && stakes.length === 0) {
      console.log('  ✅ No new events, updating timestamp only');
      cachedData.lastUpdated = new Date().toISOString();
      fs.writeFileSync(dataPath, JSON.stringify(cachedData, null, 2));
      return;
    }
    
    // Get block timestamps
    const blockNumbers = new Set();
    creates.forEach(e => blockNumbers.add(e.blockNumber));
    stakes.forEach(e => blockNumbers.add(e.blockNumber));
    
    const blockTimestamps = new Map();
    for (const blockNum of blockNumbers) {
      await sleep(RATE_LIMIT_DELAY);
      const block = await provider.getBlock(blockNum);
      blockTimestamps.set(blockNum, block.timestamp);
    }
    
    // Process new events
    const newCreates = [];
    const newStakes = [];
    
    // Create interfaces for decoding
    const createInterface = new ethers.utils.Interface([EVENT_ABIS.CREATED]);
    const stakeInterface = new ethers.utils.Interface([EVENT_ABIS.STAKED]);
    
    for (const log of creates) {
      const timestamp = blockTimestamps.get(log.blockNumber);
      // Decode the log
      const decodedEvent = createInterface.parseLog(log);
      // Create event object matching expected format
      const event = {
        args: decodedEvent.args,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash
      };
      const createData = await processCreateEvent(event, provider, timestamp);
      if (createData) {
        newCreates.push(createData);
      }
      await sleep(RATE_LIMIT_DELAY);
    }
    
    for (const log of stakes) {
      const timestamp = blockTimestamps.get(log.blockNumber);
      // Decode the log
      const decodedEvent = stakeInterface.parseLog(log);
      // Create event object matching expected format
      const event = {
        args: decodedEvent.args,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash
      };
      const stakeData = await processStakeEvent(event, provider, timestamp);
      if (stakeData) {
        newStakes.push(stakeData);
      }
      await sleep(RATE_LIMIT_DELAY);
    }
    
    // Get shares data for new events
    await getSharesData({ creates: newCreates, stakes: newStakes }, stakeContract, provider);
    
    // Merge with existing data
    if (!cachedData.stakingData) cachedData.stakingData = {};
    if (!cachedData.stakingData.createEvents) cachedData.stakingData.createEvents = [];
    if (!cachedData.stakingData.stakeEvents) cachedData.stakingData.stakeEvents = [];
    
    cachedData.stakingData.createEvents.push(...newCreates);
    cachedData.stakingData.stakeEvents.push(...newStakes);
    
    // Validate before writing
    const finalCreateCount = cachedData.stakingData.createEvents.length;
    const finalStakeCount = cachedData.stakingData.stakeEvents.length;
    
    // Don't write empty data if we had data before
    if (hasExistingData && finalCreateCount === 0 && finalStakeCount === 0) {
      console.error('  ❌ ERROR: About to write empty data over existing data!');
      console.log('  ⚠️  Restoring from backup...');
      
      const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      fs.writeFileSync(dataPath, JSON.stringify(backupData, null, 2));
      
      console.log('  ✅ Data restored from backup');
      throw new Error('Prevented data loss - would have written empty arrays');
    }
    
    // Update reward pool data if needed
    const currentProtocolDay = getProtocolDay();
    const latestRewardDay = cachedData.stakingData?.rewardPoolData?.slice(-1)[0]?.day || 0;
    
    // Check if we added new positions
    const addedNewPositions = creates.length > 0 || stakes.length > 0;
    
    if (currentProtocolDay > latestRewardDay || addedNewPositions) {
      console.log(`  📊 Updating reward pool data...`);
      
      // Initialize rewardPoolData if it doesn't exist
      if (!cachedData.stakingData.rewardPoolData) {
        cachedData.stakingData.rewardPoolData = [];
      }
      
      // If we added new positions, we need to recalculate totalShares for ALL days
      // because a new position affects totalShares for every day it's active
      if (addedNewPositions) {
        console.log(`  🔄 Recalculating totalShares for all days (new positions added)...`);
        
        // Update totalShares for all existing days
        cachedData.stakingData.rewardPoolData.forEach(dayData => {
          const newTotalShares = calculateTotalSharesForDay(
            cachedData.stakingData.createEvents,
            cachedData.stakingData.stakeEvents,
            dayData.day
          );
          
          if (Math.abs(dayData.totalShares - newTotalShares) > 0.01) {
            console.log(`    Day ${dayData.day}: ${dayData.totalShares.toFixed(2)} → ${newTotalShares.toFixed(2)}`);
            dayData.totalShares = newTotalShares;
            dayData.lastUpdated = new Date().toISOString();
          }
        });
      }
      
      // Add missing days
      for (let day = latestRewardDay + 1; day <= currentProtocolDay; day++) {
        const rewardPool = calculateRewardPoolForDay(day);
        const date = new Date('2025-07-10T18:00:00Z');
        date.setDate(date.getDate() + day - 1);
        
        // Use shared utility to calculate totalShares
        const totalShares = calculateTotalSharesForDay(
          cachedData.stakingData.createEvents,
          cachedData.stakingData.stakeEvents,
          day
        );
        
        cachedData.stakingData.rewardPoolData.push({
          day,
          date: date.toISOString(),
          rewardPool,
          totalShares,
          penaltiesInPool: 0, // Would need blockchain call for actual value
          calculated: true,
          lastUpdated: new Date().toISOString()
        });
      }
      
      // Also add future projections up to current day + 88
      const maxDay = Math.min(currentProtocolDay + 88, 365);
      for (let day = currentProtocolDay + 1; day <= maxDay; day++) {
        // Check if we already have this day
        const existingDay = cachedData.stakingData.rewardPoolData.find(d => d.day === day);
        
        if (!existingDay) {
          const rewardPool = calculateRewardPoolForDay(day);
          const date = new Date('2025-07-10T18:00:00Z');
          date.setDate(date.getDate() + day - 1);
          
          // Use shared utility to calculate totalShares
          const totalShares = calculateTotalSharesForDay(
            cachedData.stakingData.createEvents,
            cachedData.stakingData.stakeEvents,
            day
          );
          
          cachedData.stakingData.rewardPoolData.push({
            day,
            date: date.toISOString(),
            rewardPool,
            totalShares,
            penaltiesInPool: 0,
            calculated: true,
            lastUpdated: new Date().toISOString()
          });
        } else if (addedNewPositions) {
          // Update totalShares for existing future days if we added new positions
          const newTotalShares = calculateTotalSharesForDay(
            cachedData.stakingData.createEvents,
            cachedData.stakingData.stakeEvents,
            day
          );
          
          if (Math.abs(existingDay.totalShares - newTotalShares) > 0.01) {
            console.log(`    Day ${day}: ${existingDay.totalShares.toFixed(2)} → ${newTotalShares.toFixed(2)}`);
            existingDay.totalShares = newTotalShares;
            existingDay.lastUpdated = new Date().toISOString();
          }
        }
      }
      
      console.log(`  ✅ Updated reward pool data through day ${maxDay}`);
    }
    
    // Update metadata
    cachedData.lastUpdated = new Date().toISOString();
    cachedData.lastProcessedBlock = currentBlock;
    
    // Update future supply projection if we added new positions or if the day changed
    if (addedNewPositions || shouldUpdateProjection(cachedData)) {
      console.log('  🔄 Updating future supply projection...');
      try {
        generateFutureSupplyProjection();
        console.log('  ✅ Future supply projection updated');
      } catch (projectionError) {
        console.warn('  ⚠️ Failed to update future supply projection:', projectionError.message);
        // Don't fail the entire update for projection issues
      }
    }
    
    // Save updated data
    fs.writeFileSync(dataPath, JSON.stringify(cachedData, null, 2));
    
    console.log('  ✅ Incremental update completed!');
    console.log(`  📊 Added ${newCreates.length} creates and ${newStakes.length} stakes`);
    console.log(`  📊 Total: ${cachedData.stakingData.createEvents.length} creates, ${cachedData.stakingData.stakeEvents.length} stakes`);
    
    // Clean up old backups (keep last 5)
    const backupDir = path.dirname(backupPath);
    const backupFiles = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('cached-data.backup-'))
      .sort()
      .reverse();
    
    if (backupFiles.length > 5) {
      backupFiles.slice(5).forEach(f => {
        fs.unlinkSync(path.join(backupDir, f));
      });
      console.log(`  🧹 Cleaned up ${backupFiles.length - 5} old backups`);
    }
    
  } catch (error) {
    console.error('❌ Update failed:', error.message);
    
    // If we preserved data due to error, that's actually a success
    if (error.message.includes('Preserved existing data') || 
        error.message.includes('Prevented data loss')) {
      console.log('  ✅ Data integrity maintained');
      process.exit(0);
    }
    
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  updateCreatesStakes();
}

module.exports = { updateCreatesStakes };