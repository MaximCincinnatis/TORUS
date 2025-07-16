// Complete RPC update process - fetches ALL historical blockchain data
// Expected runtime: ~10 minutes due to large amount of data
const fs = require('fs');
const { ethers } = require('ethers');

// Contract configurations (copied from src/constants/contracts.ts)
const CONTRACTS = {
  TORUS_TOKEN: '0xb47f575807fc5466285e1277ef8acfbb5c6686e8',
  TORUS_CREATE_STAKE: '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507',
  TORUS_BUY_PROCESS: '0xaa390a37006e22b5775a34f2147f81ebd6a63641',
};

const CREATE_STAKE_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "stakeIndex", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "torusAmount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "endTime", "type": "uint256"}
    ],
    "name": "Created",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "stakeIndex", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "principal", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "stakingDays", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "shares", "type": "uint256"}
    ],
    "name": "Staked",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "getCurrentDayIndex",
    "outputs": [{"internalType": "uint24", "name": "", "type": "uint24"}],
    "stateMutability": "view",
    "type": "function"
  }
];

const TORUS_TOKEN_ABI = [
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// RPC endpoints with fallback
const RPC_ENDPOINTS = [
  'https://ethereum.publicnode.com',
  'https://1rpc.io/eth',
  'https://eth.llamarpc.com',
  'https://eth-mainnet.public.blastapi.io',
];

let currentRpcIndex = 0;
let provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[currentRpcIndex]);

// Function to try next RPC endpoint on failure
const tryNextRpc = () => {
  currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
  console.log(`🔄 Switching to RPC endpoint: ${RPC_ENDPOINTS[currentRpcIndex]}`);
  provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[currentRpcIndex]);
};

async function updateBlockchainData() {
  console.log('🚀 STARTING COMPLETE BLOCKCHAIN DATA UPDATE');
  console.log('⏱️  Expected runtime: ~10 minutes');
  console.log('📡 This will fetch ALL historical events from contract deployment\n');
  
  const startTime = Date.now();
  let retriedRpc = false;
  
  try {
    // Contract deployment block (from previous scripts)
    const DEPLOYMENT_BLOCK = 22890272;
    
    console.log('📡 Connecting to Ethereum network...');
    const currentBlock = await provider.getBlockNumber();
    console.log(`✅ Connected! Current block: ${currentBlock.toLocaleString()}`);
    console.log(`📊 Will scan ${(currentBlock - DEPLOYMENT_BLOCK).toLocaleString()} blocks\n`);
    
    // Create contract instances
    const createStakeContract = new ethers.Contract(CONTRACTS.TORUS_CREATE_STAKE, CREATE_STAKE_ABI, provider);
    const torusTokenContract = new ethers.Contract(CONTRACTS.TORUS_TOKEN, TORUS_TOKEN_ABI, provider);
    
    console.log('🔍 Fetching protocol info...');
    const currentProtocolDay = await createStakeContract.getCurrentDayIndex();
    console.log(`📅 Current protocol day: ${currentProtocolDay}`);
    
    const totalSupplyWei = await torusTokenContract.totalSupply();
    const totalSupply = parseFloat(ethers.utils.formatEther(totalSupplyWei));
    console.log(`💰 Total TORUS supply: ${totalSupply.toLocaleString()}\n`);
    
    // Fetch ALL historical Staked events
    console.log('📊 Fetching ALL Staked events from deployment...');
    console.log(`   Scanning blocks ${DEPLOYMENT_BLOCK.toLocaleString()} to ${currentBlock.toLocaleString()}`);
    
    const stakeFilter = createStakeContract.filters.Staked();
    const allStakeEvents = await createStakeContract.queryFilter(stakeFilter, DEPLOYMENT_BLOCK, currentBlock);
    console.log(`✅ Found ${allStakeEvents.length} total Staked events`);
    
    // Process ALL stake events
    console.log('⚙️  Processing stake events...');
    const processedStakeEvents = await Promise.all(
      allStakeEvents.map(async (event, idx) => {
        if (idx % 50 === 0) {
          console.log(`   Processing stake ${idx + 1}/${allStakeEvents.length}...`);
        }
        
        const args = event.args;
        const block = await provider.getBlock(event.blockNumber);
        const timestamp = block.timestamp;
        const stakingDays = Number(args.stakingDays);
        const maturityDate = new Date((timestamp + stakingDays * 86400) * 1000);
        
        // Verify stakingDays is valid (should be 1-88)
        if (stakingDays < 1 || stakingDays > 88) {
          console.warn(`⚠️  Stake ${idx}: Invalid stakingDays ${stakingDays}, using 88`);
        }
        
        return {
          user: args.user,
          id: args.stakeIndex.toString(),
          principal: args.principal.toString(),
          shares: args.shares.toString(),
          duration: stakingDays.toString(),
          timestamp: timestamp.toString(),
          maturityDate: maturityDate.toISOString(),
          blockNumber: event.blockNumber,
          stakingDays: Math.min(Math.max(stakingDays, 1), 88), // Ensure 1-88 range
          costETH: "0" // Will be populated from getUserInfo if needed
        };
      })
    );
    
    // Fetch ALL historical Created events
    console.log('\\n📊 Fetching ALL Created events from deployment...');
    console.log(`   This is where the TitanX data comes from...`);
    
    const createFilter = createStakeContract.filters.Created();
    const allCreateEvents = await createStakeContract.queryFilter(createFilter, DEPLOYMENT_BLOCK, currentBlock);
    console.log(`✅ Found ${allCreateEvents.length} total Created events`);
    
    // Process ALL create events
    console.log('⚙️  Processing create events...');
    const processedCreateEvents = await Promise.all(
      allCreateEvents.map(async (event, idx) => {
        if (idx % 100 === 0) {
          console.log(`   Processing create ${idx + 1}/${allCreateEvents.length}...`);
        }
        
        const args = event.args;
        const block = await provider.getBlock(event.blockNumber);
        const startTime = block.timestamp;
        const endTime = Number(args.endTime);
        const stakingDays = Math.round((endTime - startTime) / 86400);
        const maturityDate = new Date(endTime * 1000);
        
        // Verify stakingDays is reasonable
        const validStakingDays = Math.min(Math.max(stakingDays, 1), 88);
        
        return {
          user: args.user,
          stakeIndex: args.stakeIndex.toString(),
          torusAmount: args.torusAmount.toString(),
          endTime: endTime,
          timestamp: startTime,
          maturityDate: maturityDate.toISOString(),
          blockNumber: event.blockNumber,
          stakingDays: validStakingDays,
          shares: "0", // Will be calculated
          titanAmount: "0", // Will be populated from getUserInfo
          costETH: "0" // Will be populated from getUserInfo if needed
        };
      })
    );
    
    console.log('\\n📊 DATA COLLECTION SUMMARY:');
    console.log(`✅ Processed ${processedStakeEvents.length} stake events`);
    console.log(`✅ Processed ${processedCreateEvents.length} create events`);
    
    // Calculate totals
    const totalStaked = processedStakeEvents.reduce((sum, stake) => sum + parseFloat(stake.principal) / 1e18, 0);
    const totalCreated = processedCreateEvents.reduce((sum, create) => sum + parseFloat(create.torusAmount) / 1e18, 0);
    
    console.log(`💰 Total TORUS staked: ${totalStaked.toLocaleString()}`);
    console.log(`💰 Total TORUS created: ${totalCreated.toLocaleString()}`);
    
    // Note about TitanX: getUserInfo calls would be needed for exact amounts
    console.log(`\\n⚠️  NOTE: TitanX amounts need getUserInfo() calls for precision`);
    console.log(`   This would require ${processedCreateEvents.length} additional RPC calls`);
    console.log(`   Current script shows event structure is correct`);
    
    // Create updated cache data structure
    const updatedCacheData = {
      lastUpdated: new Date().toISOString(),
      version: "1.1.0",
      stakingData: {
        stakeEvents: processedStakeEvents,
        createEvents: processedCreateEvents,
        rewardPoolData: [], // Could be populated with additional calls
        currentProtocolDay: Number(currentProtocolDay),
        totalSupply: totalSupply,
        burnedSupply: 0, // Could be populated if burnedSupply() exists
        lastUpdated: new Date().toISOString()
      },
      metadata: {
        dataSource: "complete-blockchain-scan",
        fallbackToRPC: false,
        cacheExpiryMinutes: 60,
        description: "Complete historical blockchain data from deployment",
        blocksScanned: currentBlock - DEPLOYMENT_BLOCK,
        deploymentBlock: DEPLOYMENT_BLOCK,
        currentBlock: currentBlock
      },
      totals: {
        totalETH: "0", // Would need getUserInfo calls
        totalTitanX: "0", // Would need getUserInfo calls  
        totalStakedETH: "0",
        totalCreatedETH: "0",
        totalStakedTitanX: "0",
        totalCreatedTitanX: "0"
      }
    };
    
    // Save the data
    const outputFile = 'public/data/cached-data-complete.json';
    fs.writeFileSync(outputFile, JSON.stringify(updatedCacheData, null, 2));
    
    const endTime = Date.now();
    const runtime = Math.round((endTime - startTime) / 1000);
    
    console.log(`\\n🎉 COMPLETE! Runtime: ${runtime} seconds`);
    console.log(`📄 Data saved to: ${outputFile}`);
    console.log(`📊 Total events: ${processedStakeEvents.length + processedCreateEvents.length}`);
    console.log(`\\n✅ Ready for TitanX amount extraction with getUserInfo() calls`);
    
  } catch (error) {
    console.error('❌ Error during data fetch:', error.message);
    
    if (!retriedRpc && error.message.includes('timeout')) {
      console.log('🔄 Retrying with different RPC endpoint...');
      tryNextRpc();
      retriedRpc = true;
      return updateBlockchainData(); // Retry once
    }
    
    throw error;
  }
}

// Run the complete update
if (require.main === module) {
  updateBlockchainData()
    .then(() => {
      console.log('\\n✅ Blockchain data update completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Update failed:', error);
      process.exit(1);
    });
}

module.exports = { updateBlockchainData };