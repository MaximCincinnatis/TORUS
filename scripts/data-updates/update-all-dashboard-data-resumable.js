/**
 * RESUMABLE Full Dashboard Update Script
 * - Saves checkpoint after each major step
 * - Auto-resumes on rate limits/timeouts
 * - Can be stopped and restarted without losing progress
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { 
  calculatePositionAmounts,
  calculateClaimableFees,
  mapFieldNames,
  mergeLPPositions 
} = require('../../shared/lpCalculations');
const { 
  CONTRACT_ADDRESSES, 
  EVENT_ABIS,
  EVENT_TOPICS,
  getProtocolDay
} = require('../shared/contractConstants');
const { getActualTitanXFromStake } = require('../shared/titanXHelpers');
const { generateFutureSupplyProjection } = require('../generate-future-supply-projection-fixed');

// Stake Contract ABI with getStakePositions function
const STAKE_CONTRACT_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
    "name": "getStakePositions",
    "outputs": [{
      "components": [
        {"internalType": "uint256", "name": "stakeIndex", "type": "uint256"},
        {"internalType": "uint256", "name": "torusAmount", "type": "uint256"},
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
  'function totalTitanXBurnt() view returns (uint256)',
  EVENT_ABIS.CREATED,
  EVENT_ABIS.STAKED
];

// Working RPC providers (tested and verified)
const WORKING_RPC_PROVIDERS = [
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.payload.de',
  'https://eth-mainnet.public.blastapi.io',
  'https://rpc.flashbots.net',
  'https://eth.drpc.org'
];

// Rate limiting configuration
const RATE_LIMIT_DELAY = 200; // ms between requests
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

// Contract addresses from shared constants
const CONTRACTS = {
  TORUS: CONTRACT_ADDRESSES.TORUS,
  TITANX: CONTRACT_ADDRESSES.TITANX,
  CREATE_STAKE: CONTRACT_ADDRESSES.CREATE_STAKE,
  POOL: CONTRACT_ADDRESSES.TORUS_TITANX_POOL,
  NFT_POSITION_MANAGER: CONTRACT_ADDRESSES.POSITION_MANAGER
};

// Checkpoint management
const CHECKPOINT_FILE = 'checkpoint-full-update.json';
let checkpoint = {};

function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
    console.log('📍 Loaded checkpoint:', {
      stage: checkpoint.stage,
      progress: checkpoint.progress,
      lastUpdate: checkpoint.lastUpdate
    });
    return true;
  }
  return false;
}

function saveCheckpoint(updates) {
  checkpoint = {
    ...checkpoint,
    ...updates,
    lastUpdate: new Date().toISOString()
  };
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

// Rate limiting helper
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry wrapper for RPC calls
async function retryRPC(fn, context = '') {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await sleep(RATE_LIMIT_DELAY); // Rate limit
      return await fn();
    } catch (error) {
      console.log(`\n  ⚠️  RPC Error (attempt ${attempt}/${MAX_RETRIES}) ${context}: ${error.message}`);
      
      if (attempt < MAX_RETRIES) {
        console.log(`  ⏳ Retrying in ${RETRY_DELAY/1000} seconds...`);
        await sleep(RETRY_DELAY);
      } else {
        throw error;
      }
    }
  }
}

// Get working provider with rotation
let currentProviderIndex = 0;
async function getWorkingProvider() {
  for (let i = 0; i < WORKING_RPC_PROVIDERS.length; i++) {
    const index = (currentProviderIndex + i) % WORKING_RPC_PROVIDERS.length;
    const rpcUrl = WORKING_RPC_PROVIDERS[index];
    
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      await provider.getBlockNumber();
      console.log(`✅ Connected to ${rpcUrl}`);
      currentProviderIndex = (index + 1) % WORKING_RPC_PROVIDERS.length; // Rotate for next call
      return provider;
    } catch (error) {
      console.log(`❌ Failed ${rpcUrl}: ${error.message}`);
    }
  }
  throw new Error('No working RPC providers available');
}

const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)'
];

const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function liquidity() view returns (uint128)',
  'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)'
];

const POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function ownerOf(uint256 tokenId) view returns (address)'
];

async function updateAllDashboardData() {
  console.log('🚀 RESUMABLE FULL DASHBOARD UPDATE');
  console.log('================================================');
  console.log('✨ Features:');
  console.log('   - Auto-saves progress at checkpoints');
  console.log('   - Resumes from last checkpoint on restart');
  console.log('   - Handles rate limits and timeouts gracefully');
  console.log('   - Rotates between multiple RPC providers');
  console.log('================================================');
  
  const hasCheckpoint = loadCheckpoint();
  
  try {
    // Load cached data
    let cachedData;
    if (checkpoint.cachedData) {
      cachedData = checkpoint.cachedData;
      console.log('📄 Loaded cached data from checkpoint');
    } else {
      cachedData = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
      saveCheckpoint({ cachedData });
    }
    
    // Initialize provider
    const provider = await getWorkingProvider();
    
    // STAGE 1: Contract Data
    if (!checkpoint.stage || checkpoint.stage === 'start') {
      console.log('\n📊 STAGE 1: FETCHING CONTRACT DATA...');
      
      const torusContract = new ethers.Contract(CONTRACTS.TORUS, ERC20_ABI, provider);
      const titanxContract = new ethers.Contract(CONTRACTS.TITANX, ERC20_ABI, provider);
      
      const contractData = await retryRPC(async () => {
        const [torusData, titanxData] = await Promise.all([
          Promise.all([
            torusContract.decimals(),
            torusContract.symbol(),
            torusContract.name(),
            torusContract.totalSupply()
          ]),
          Promise.all([
            titanxContract.decimals(),
            titanxContract.symbol(),
            titanxContract.name(),
            titanxContract.totalSupply()
          ])
        ]);
        
        return {
          torusToken: {
            address: CONTRACTS.TORUS,
            decimals: torusData[0],
            symbol: torusData[1],
            name: torusData[2],
            totalSupply: torusData[3].toString()
          },
          titanxToken: {
            address: CONTRACTS.TITANX,
            decimals: titanxData[0],
            symbol: titanxData[1],
            name: titanxData[2],
            totalSupply: titanxData[3].toString()
          }
        };
      }, 'fetching contract data');
      
      cachedData.contractData = contractData;
      cachedData.stakingData = cachedData.stakingData || {};
      cachedData.stakingData.totalSupply = parseFloat(ethers.utils.formatEther(contractData.torusToken.totalSupply));
      
      console.log('  ✅ Contract data fetched');
      saveCheckpoint({ 
        stage: 'events',
        cachedData
      });
    }
    
    // STAGE 2: Create/Stake Events
    if (!checkpoint.stage || checkpoint.stage === 'events') {
      console.log('\n📊 STAGE 2: FETCHING CREATE/STAKE EVENTS...');
      
      const stakeContract = new ethers.Contract(CONTRACTS.CREATE_STAKE, STAKE_CONTRACT_ABI, provider);
      const currentBlock = process.env.TEST_END_BLOCK ? parseInt(process.env.TEST_END_BLOCK) : await provider.getBlockNumber();
      const DEPLOYMENT_BLOCK = 22890272;
      
      // Initialize or load progress
      let startBlock = checkpoint.eventsProgress?.lastBlock || DEPLOYMENT_BLOCK;
      let allCreates = checkpoint.eventsProgress?.creates || [];
      let allStakes = checkpoint.eventsProgress?.stakes || [];
      
      if (startBlock === DEPLOYMENT_BLOCK) {
        cachedData.stakingData.stakeEvents = [];
        cachedData.stakingData.createEvents = [];
      }
      
      // Fetch events in chunks
      const CHUNK_SIZE = 2000; // Smaller chunks for better reliability
      
      while (startBlock <= currentBlock) {
        const endBlock = Math.min(startBlock + CHUNK_SIZE - 1, currentBlock);
        const progress = ((startBlock - DEPLOYMENT_BLOCK) / (currentBlock - DEPLOYMENT_BLOCK) * 100).toFixed(1);
        
        console.log(`  📊 Scanning blocks ${startBlock} to ${endBlock} (${progress}%)`);
        
        try {
          const [createLogs, stakeLogs] = await retryRPC(async () => {
            return await Promise.all([
              provider.getLogs({
                address: CONTRACTS.CREATE_STAKE,
                topics: [EVENT_TOPICS.CREATED],
                fromBlock: startBlock,
                toBlock: endBlock
              }),
              provider.getLogs({
                address: CONTRACTS.CREATE_STAKE,
                topics: [EVENT_TOPICS.STAKED],
                fromBlock: startBlock,
                toBlock: endBlock
              })
            ]);
          }, `blocks ${startBlock}-${endBlock}`);
          
          allCreates.push(...createLogs);
          allStakes.push(...stakeLogs);
          
          // Save progress after each successful chunk
          saveCheckpoint({
            eventsProgress: {
              lastBlock: endBlock + 1,
              creates: allCreates,
              stakes: allStakes
            }
          });
          
          startBlock = endBlock + 1;
        } catch (error) {
          console.error(`  ❌ Failed to fetch events for blocks ${startBlock}-${endBlock}`);
          throw error; // Will be caught by outer try-catch and script can be rerun
        }
      }
      
      console.log(`  ✅ Found ${allCreates.length} creates and ${allStakes.length} stakes`);
      
      // Process events
      console.log('  🔄 Processing events...');
      
      // Get block timestamps
      const blockNumbers = new Set();
      allCreates.forEach(e => blockNumbers.add(e.blockNumber));
      allStakes.forEach(e => blockNumbers.add(e.blockNumber));
      
      const blockTimestamps = checkpoint.blockTimestamps || new Map();
      const blocksToFetch = Array.from(blockNumbers).filter(bn => !blockTimestamps.has(bn));
      
      console.log(`  🕐 Fetching timestamps for ${blocksToFetch.length} blocks...`);
      for (let i = 0; i < blocksToFetch.length; i += 10) {
        const batch = blocksToFetch.slice(i, i + 10);
        
        const blocks = await retryRPC(async () => {
          return await Promise.all(batch.map(bn => provider.getBlock(bn)));
        }, `block timestamps ${i}-${i+10}`);
        
        blocks.forEach(block => {
          blockTimestamps.set(block.number, block.timestamp);
        });
        
        console.log(`  📅 Progress: ${Math.min(i + 10, blocksToFetch.length)}/${blocksToFetch.length}`);
      }
      
      // Process create events
      console.log(`  💎 Processing ${allCreates.length} create events...`);
      let createCount = 0;
      for (const event of allCreates) {
        createCount++;
        if (createCount % 50 === 0) {
          console.log(`  📊 Processed ${createCount}/${allCreates.length} creates`);
        }
        try {
          // Handle events with decoding errors
          if (!event.args) {
            // Manually decode the event - only user is indexed
            const iface = new ethers.utils.Interface([EVENT_ABIS.CREATED]);
            try {
              const decoded = iface.parseLog({ data: event.data, topics: event.topics });
              event.args = decoded.args;
            } catch (decodeErr) {
              console.log(`  ⚠️  Skipping event that couldn't be decoded: ${event.transactionHash}`);
              continue;
            }
          }
          
          const timestamp = blockTimestamps.get(event.blockNumber);
          const tx = await retryRPC(async () => {
            return await provider.getTransaction(event.transactionHash);
          }, `tx ${event.transactionHash}`);
          
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
          
          // Check if ETH or TitanX create
          if (tx.value && !tx.value.isZero()) {
            createData.costETH = ethers.utils.formatEther(tx.value);
            createData.rawCostETH = tx.value.toString();
            createData.costTitanX = "0.0";
            createData.rawCostTitanX = "0";
            createData.titanAmount = "0";
          } else {
            // Get TitanX amount from Transfer events
            createData.costETH = "0.0";
            createData.rawCostETH = "0";
            
            const receipt = await retryRPC(async () => {
              return await provider.getTransactionReceipt(event.transactionHash);
            }, `receipt ${event.transactionHash}`);
            
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
          
          cachedData.stakingData.createEvents.push(createData);
        } catch (error) {
          console.log(`  ⚠️  Error processing create event: ${error.message}`);
        }
      }
      
      // Process stake events
      console.log(`  🔥 Processing ${allStakes.length} stake events...`);
      let stakeCount = 0;
      for (const event of allStakes) {
        stakeCount++;
        if (stakeCount % 20 === 0) {
          console.log(`  📊 Processed ${stakeCount}/${allStakes.length} stakes`);
        }
        try {
          // Handle events with decoding errors
          if (!event.args) {
            // Manually decode the event - user and stakeIndex are indexed
            const iface = new ethers.utils.Interface([EVENT_ABIS.STAKED]);
            try {
              const decoded = iface.parseLog({ data: event.data, topics: event.topics });
              event.args = decoded.args;
            } catch (decodeErr) {
              console.log(`  ⚠️  Skipping stake event that couldn't be decoded: ${event.transactionHash}`);
              continue;
            }
          }
          
          const timestamp = blockTimestamps.get(event.blockNumber);
          
          // Calculate maturityDate for stake
          const stakingDays = parseInt(event.args.stakingDays.toString());
          const endTimestamp = timestamp + (stakingDays * 24 * 60 * 60);
          const maturityDate = new Date(endTimestamp * 1000).toISOString();
          
          // Get transaction to check if ETH was used
          const tx = await retryRPC(async () => {
            return await provider.getTransaction(event.transactionHash);
          }, `tx ${event.transactionHash}`);
          
          const stakeData = {
            user: event.args.user.toLowerCase(),
            stakeIndex: event.args.stakeIndex.toString(),
            principal: event.args.principal.toString(),
            stakingDays: event.args.stakingDays.toString(),
            shares: event.args.shares.toString(),
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            timestamp: timestamp.toString(),
            protocolDay: getProtocolDay(timestamp),
            maturityDate: maturityDate,
            endTime: endTimestamp.toString()
          };
          
          // Check if ETH was sent with the transaction
          if (tx.value && !tx.value.isZero()) {
            // ETH was used for the fee
            stakeData.costETH = ethers.utils.formatEther(tx.value);
            stakeData.rawCostETH = tx.value.toString();
          } else {
            // No ETH sent, fee was paid in TitanX
            stakeData.costETH = "0.0";
            stakeData.rawCostETH = "0";
          }
          
          // Always get actual TitanX from Transfer events
          try {
            const actualTitanX = await getActualTitanXFromStake(event.transactionHash, provider);
            stakeData.costTitanX = ethers.utils.formatEther(actualTitanX);
            stakeData.rawCostTitanX = actualTitanX;
            stakeData.titanAmount = actualTitanX;
          } catch (error) {
            console.warn(`  ⚠️  Failed to get actual TitanX for stake ${event.transactionHash}: ${error.message}`);
            // Set to 0 if we can't get the actual amount
            stakeData.costTitanX = "0.0";
            stakeData.rawCostTitanX = "0";
            stakeData.titanAmount = "0";
          }
          
          cachedData.stakingData.stakeEvents.push(stakeData);
        } catch (error) {
          console.log(`  ⚠️  Error processing stake event: ${error.message}`);
        }
      }
      
      console.log(`  ✅ Processed ${cachedData.stakingData.createEvents.length} creates and ${cachedData.stakingData.stakeEvents.length} stakes`);
      
      // Get shares data for all positions
      console.log('\n  🔄 Fetching shares data for all positions...');
      
      // Get unique users from both creates and stakes
      const uniqueUsers = new Set();
      cachedData.stakingData.createEvents.forEach(event => uniqueUsers.add(event.user));
      cachedData.stakingData.stakeEvents.forEach(event => uniqueUsers.add(event.user));
      
      console.log(`  📊 Found ${uniqueUsers.size} unique users to query`);
      
      // Map to store user positions
      const userPositions = new Map();
      
      // Fetch positions for each user
      let userCount = 0;
      for (const user of uniqueUsers) {
        userCount++;
        if (userCount % 50 === 0) {
          console.log(`  📊 Progress: ${userCount}/${uniqueUsers.size} users`);
        }
        
        try {
          const rawPositions = await retryRPC(async () => {
            return await stakeContract.getStakePositions(user);
          }, `positions for ${user}`);
          
          if (rawPositions.length > 0) {
            // Map the raw positions to a structured format
            const mappedPositions = rawPositions.map(pos => ({
              stakeIndex: pos.stakeIndex,
              torusAmount: pos.torusAmount,
              startTime: pos.startTime,
              startDayIndex: pos.startDayIndex,
              endTime: pos.endTime,
              shares: pos.shares,
              claimedCreate: pos.claimedCreate,
              claimedStake: pos.claimedStake,
              costTitanX: pos.costTitanX,
              costETH: pos.costETH,
              rewards: pos.rewards,
              penalties: pos.penalties,
              claimedAt: pos.claimedAt,
              isCreate: pos.isCreate
            }));
            userPositions.set(user, mappedPositions);
          }
        } catch (error) {
          console.warn(`  ⚠️  Error fetching positions for ${user}: ${error.message}`);
        }
      }
      
      console.log(`  ✅ Fetched positions for ${userPositions.size} users`);
      
      // Match stake events with positions for shares
      console.log('  📊 Matching stake events with positions for shares...');
      let stakesWithShares = 0;
      let stakesWithoutShares = 0;
      
      cachedData.stakingData.stakeEvents.forEach(event => {
        const userPos = userPositions.get(event.user);
        if (userPos) {
          // Find matching position by start time (within 5 minutes of event timestamp)
          const eventTime = parseInt(event.timestamp);
          const matchingPosition = userPos.find(pos => 
            Math.abs(Number(pos.startTime) - eventTime) < 300 && !pos.isCreate
          );
          
          if (matchingPosition) {
            // Add shares from the matched position
            event.shares = matchingPosition.shares.toString();
            stakesWithShares++;
            
            // Also ensure we have the actual TitanX amount
            if (event.rawCostETH && event.rawCostETH !== "0") {
              // This is an ETH stake, TitanX should already be correct from getActualTitanXFromStake
            }
          } else {
            console.warn(`  ⚠️  No matching stake position found for user ${event.user} at time ${eventTime}`);
            stakesWithoutShares++;
          }
        } else {
          stakesWithoutShares++;
        }
      });
      
      console.log(`  ✅ Stakes with shares: ${stakesWithShares}/${cachedData.stakingData.stakeEvents.length}`);
      if (stakesWithoutShares > 0) {
        console.warn(`  ⚠️  Stakes without shares: ${stakesWithoutShares}`);
      }
      
      // Match create events with positions for shares
      console.log('  📊 Matching create events with positions for shares...');
      let createsWithShares = 0;
      let createsWithoutShares = 0;
      
      cachedData.stakingData.createEvents.forEach(event => {
        const userPos = userPositions.get(event.user);
        if (userPos) {
          // Find matching position by start time (within 5 minutes of event timestamp)
          const eventTime = parseInt(event.timestamp);
          const matchingPosition = userPos.find(pos => 
            Math.abs(Number(pos.startTime) - eventTime) < 300 && pos.isCreate
          );
          
          if (matchingPosition) {
            // Add shares from the matched position
            event.shares = matchingPosition.shares.toString();
            createsWithShares++;
            
            // Also ensure maturity date and endTime are set
            if (!event.maturityDate) {
              event.maturityDate = new Date(Number(matchingPosition.endTime) * 1000).toISOString();
            }
            if (!event.endTime) {
              event.endTime = matchingPosition.endTime.toString();
            }
          } else {
            console.warn(`  ⚠️  No matching create position found for user ${event.user} at time ${eventTime}`);
            createsWithoutShares++;
          }
        } else {
          createsWithoutShares++;
        }
      });
      
      console.log(`  ✅ Creates with shares: ${createsWithShares}/${cachedData.stakingData.createEvents.length}`);
      if (createsWithoutShares > 0) {
        console.warn(`  ⚠️  Creates without shares: ${createsWithoutShares}`);
      }
      
      saveCheckpoint({ 
        stage: 'lp_positions',
        cachedData,
        eventsProgress: null // Clear this data to save space
      });
    }
    
    // STAGE 3: LP Positions
    if (!checkpoint.stage || checkpoint.stage === 'lp_positions') {
      console.log('\n📊 STAGE 3: FETCHING LP POSITIONS...');
      
      const poolContract = new ethers.Contract(CONTRACTS.POOL, POOL_ABI, provider);
      const positionManager = new ethers.Contract(CONTRACTS.NFT_POSITION_MANAGER, POSITION_MANAGER_ABI, provider);
      
      // Get pool state
      const slot0 = await retryRPC(async () => {
        return await poolContract.slot0();
      }, 'pool slot0');
      
      // Find all Mint events to get position IDs
      const currentBlock = await provider.getBlockNumber();
      const POOL_DEPLOYMENT_BLOCK = 22890272; // Exact pool initialization block
      
      let startBlock = checkpoint.lpProgress?.lastBlock || POOL_DEPLOYMENT_BLOCK;
      let tokenIds = new Set(checkpoint.lpProgress?.tokenIds || []);
      
      const CHUNK_SIZE = 5000;
      
      while (startBlock <= currentBlock) {
        const endBlock = Math.min(startBlock + CHUNK_SIZE - 1, currentBlock);
        const progress = ((startBlock - POOL_DEPLOYMENT_BLOCK) / (currentBlock - POOL_DEPLOYMENT_BLOCK) * 100).toFixed(1);
        
        console.log(`  🔍 Scanning for LP positions: blocks ${startBlock}-${endBlock} (${progress}%)`);
        
        try {
          const mintEvents = await retryRPC(async () => {
            return await poolContract.queryFilter(
              poolContract.filters.Mint(),
              startBlock,
              endBlock
            );
          }, `LP mint events ${startBlock}-${endBlock}`);
          
          // Extract token IDs from IncreaseLiquidity events in same blocks
          for (const mintEvent of mintEvents) {
            const receipt = await retryRPC(async () => {
              return await provider.getTransactionReceipt(mintEvent.transactionHash);
            }, `mint receipt ${mintEvent.transactionHash}`);
            
            // Look for IncreaseLiquidity event
            const increaseLiquidityTopic = ethers.utils.id('IncreaseLiquidity(uint256,uint128,uint256,uint256)');
            const increaseLiquidityLog = receipt.logs.find(log => 
              log.topics[0] === increaseLiquidityTopic
            );
            
            if (increaseLiquidityLog) {
              const tokenId = ethers.BigNumber.from(increaseLiquidityLog.topics[1]).toString();
              tokenIds.add(tokenId);
            }
          }
          
          saveCheckpoint({
            lpProgress: {
              lastBlock: endBlock + 1,
              tokenIds: Array.from(tokenIds)
            }
          });
          
          startBlock = endBlock + 1;
        } catch (error) {
          console.error(`  ❌ Failed to fetch LP events for blocks ${startBlock}-${endBlock}`);
          throw error;
        }
      }
      
      console.log(`  ✅ Found ${tokenIds.size} unique LP positions`);
      
      // Fetch position details
      const lpPositions = [];
      const tokenIdArray = Array.from(tokenIds);
      
      for (let i = 0; i < tokenIdArray.length; i++) {
        const tokenId = tokenIdArray[i];
        console.log(`  📍 Processing position ${i + 1}/${tokenIdArray.length}`);
        
        try {
          const [position, owner] = await retryRPC(async () => {
            return await Promise.all([
              positionManager.positions(tokenId),
              positionManager.ownerOf(tokenId)
            ]);
          }, `position ${tokenId}`);
          
          if (position.liquidity.gt(0)) {
            // Calculate amounts and fees
            const amounts = calculatePositionAmounts(
              position,
              slot0.sqrtPriceX96,
              Math.floor(Math.log(Math.pow(Number(slot0.sqrtPriceX96) / Math.pow(2, 96), 2)) / Math.log(1.0001))
            );
            
            const claimableFees = await calculateClaimableFees(
              tokenId,
              owner,
              position,
              provider
            );
            
            const positionData = {
              tokenId: tokenId,
              owner: owner.toLowerCase(),
              liquidity: position.liquidity.toString(),
              tickLower: position.tickLower,
              tickUpper: position.tickUpper,
              fee: position.fee,
              tokensOwed0: position.tokensOwed0.toString(),
              tokensOwed1: position.tokensOwed1.toString(),
              torusAmount: amounts.amount0,
              titanxAmount: amounts.amount1,
              claimableTorus: claimableFees.claimableTorus,
              claimableTitanX: claimableFees.claimableTitanX,
              claimableYield: claimableFees.claimableTorus + claimableFees.claimableTitanX
            };
            
            lpPositions.push(positionData);
          }
        } catch (error) {
          console.log(`  ⚠️  Error processing position ${tokenId}: ${error.message}`);
        }
      }
      
      cachedData.lpPositions = lpPositions;
      console.log(`  ✅ Processed ${lpPositions.length} active LP positions`);
      
      saveCheckpoint({ 
        stage: 'finalize',
        cachedData,
        lpProgress: null
      });
    }
    
    // STAGE 4: Finalize
    if (!checkpoint.stage || checkpoint.stage === 'finalize') {
      console.log('\n📊 STAGE 4: FINALIZING DATA...');
      
      // Update metadata
      cachedData.lastUpdated = new Date().toISOString();
      cachedData.metadata = cachedData.metadata || {};
      cachedData.metadata.lastCompleteUpdate = new Date().toISOString();
      cachedData.metadata.dataComplete = true;
      cachedData.metadata.dataSource = 'Blockchain RPC';
      
      // Generate future supply projection
      console.log('\n🔄 Generating future supply projection...');
      try {
        generateFutureSupplyProjection();
        console.log('✅ Future supply projection updated');
      } catch (projectionError) {
        console.warn('⚠️ Failed to generate future supply projection:', projectionError.message);
        // Don't fail the entire update for projection issues
      }
      
      // Save final data
      fs.writeFileSync('public/data/cached-data.json', JSON.stringify(cachedData, null, 2));
      
      // Clean up checkpoint
      if (fs.existsSync(CHECKPOINT_FILE)) {
        fs.unlinkSync(CHECKPOINT_FILE);
      }
      
      console.log('\n✅ FULL UPDATE COMPLETED SUCCESSFULLY!');
      console.log('📊 Summary:');
      console.log(`  - Creates: ${cachedData.stakingData.createEvents.length}`);
      console.log(`  - Stakes: ${cachedData.stakingData.stakeEvents.length}`);
      console.log(`  - LP Positions: ${cachedData.lpPositions.length}`);
    }
    
  } catch (error) {
    console.error('\n❌ Update failed:', error.message);
    console.log('💡 Run this script again to resume from checkpoint');
    process.exit(1);
  }
}

// Run the update
updateAllDashboardData();