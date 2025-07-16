#!/usr/bin/env node

/**
 * TORUS Dashboard Data Update Script
 * 
 * This script is responsible for updating the dashboard's cached JSON data
 * with fresh blockchain data. It maintains clear separation from frontend code.
 * 
 * Frontend code should ONLY handle incremental updates from the cached JSON.
 * This script handles full data regeneration when needed.
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

// Configuration
const CONFIG = {
  outputPath: '../../public/data/cached-data.json',
  backupDir: '../../public/data/backups',
  contracts: {
    TORUS_TOKEN: '0xb47f575807fc5466285e1277ef8acfbb5c6686e8',
    TORUS_CREATE_STAKE: '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507',
    TORUS_BUY_PROCESS: '0xaa390a37006e22b5775a34f2147f81ebd6a63641',
    TITANX_TOKEN: '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1',
    UNISWAP_V3_FACTORY: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  },
  rpcProviders: [
    'https://eth.drpc.org',
    'https://rpc.payload.de',
    'https://eth-mainnet.public.blastapi.io',
    'https://rpc.flashbots.net',
    'https://eth-mainnet.nodereal.io/v1/REDACTED_API_KEY'
  ],
  startBlock: 22890272,
  chunkSize: 5000,
  batchSize: 5
};

// ABIs
const ABIS = {
  createStake: [
    "event Staked(address indexed user, uint256 indexed stakeIndex, uint256 principal, uint256 shares, uint256 stakingDays, uint256 startTime)",
    "event Created(address indexed user, uint256 indexed stakeIndex, uint256 torusAmount, uint256 endTime, uint256 startTime)",
    "function getStakePositions(address user) external view returns (tuple(uint256 principal, uint256 power, uint256 stakingDays, uint256 startTime, uint256 startDayIndex, uint256 endTime, uint256 shares, bool claimedCreate, bool claimedStake, uint256 costTitanX, uint256 costETH, uint256 rewards, uint256 penalties, uint256 claimedAt, bool isCreate)[] memory)"
  ],
  erc20: [
    "function totalSupply() external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)",
    "function name() external view returns (string)"
  ],
  uniswapV3Pool: [
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
    "function liquidity() external view returns (uint128)",
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function fee() external view returns (uint24)"
  ],
  uniswapV3Factory: [
    "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
  ]
};

class DataUpdater {
  constructor() {
    this.currentRpcIndex = 0;
    this.provider = null;
  }

  async getWorkingProvider() {
    const maxRetries = CONFIG.rpcProviders.length;
    
    for (let i = 0; i < maxRetries; i++) {
      const rpcUrl = CONFIG.rpcProviders[this.currentRpcIndex];
      
      try {
        console.log(`🔄 Testing RPC: ${rpcUrl}`);
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 5000);
        });
        
        const blockNumber = await Promise.race([
          provider.getBlockNumber(),
          timeoutPromise
        ]);
        
        console.log(`✅ Connected to RPC: ${rpcUrl} - Block: ${blockNumber}`);
        this.provider = provider;
        return provider;
        
      } catch (error) {
        console.log(`❌ RPC failed: ${rpcUrl} - ${error.message}`);
        this.currentRpcIndex = (this.currentRpcIndex + 1) % CONFIG.rpcProviders.length;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error('All RPC providers failed');
  }

  async fetchEvents() {
    console.log('📊 Fetching events from blockchain...');
    
    const createStakeContract = new ethers.Contract(
      CONFIG.contracts.TORUS_CREATE_STAKE,
      ABIS.createStake,
      this.provider
    );
    
    const currentBlock = await this.provider.getBlockNumber();
    let allStakeEvents = [];
    let allCreateEvents = [];
    
    for (let fromBlock = CONFIG.startBlock; fromBlock <= currentBlock; fromBlock += CONFIG.chunkSize) {
      const toBlock = Math.min(fromBlock + CONFIG.chunkSize - 1, currentBlock);
      
      try {
        const [stakeEvents, createEvents] = await Promise.all([
          createStakeContract.queryFilter(createStakeContract.filters.Staked(), fromBlock, toBlock),
          createStakeContract.queryFilter(createStakeContract.filters.Created(), fromBlock, toBlock)
        ]);
        
        allStakeEvents = allStakeEvents.concat(stakeEvents);
        allCreateEvents = allCreateEvents.concat(createEvents);
        
        console.log(`📊 Blocks ${fromBlock}-${toBlock}: ${stakeEvents.length} stakes, ${createEvents.length} creates`);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`⚠️ Error fetching chunk ${fromBlock}-${toBlock}: ${error.message}`);
      }
    }
    
    console.log(`✅ Total events: ${allStakeEvents.length} stakes, ${allCreateEvents.length} creates`);
    return { stakeEvents: allStakeEvents, createEvents: allCreateEvents, currentBlock };
  }

  async enrichEventsWithCosts(stakeEvents, createEvents) {
    console.log('💰 Enriching events with cost data...');
    
    const createStakeContract = new ethers.Contract(
      CONFIG.contracts.TORUS_CREATE_STAKE,
      ABIS.createStake,
      this.provider
    );
    
    // Get unique users
    const allUsers = new Set();
    stakeEvents.forEach(event => allUsers.add(event.args.user));
    createEvents.forEach(event => allUsers.add(event.args.user));
    
    const users = Array.from(allUsers);
    console.log(`👥 Processing ${users.length} unique users...`);
    
    // Fetch positions for all users
    const userPositions = new Map();
    
    for (let i = 0; i < users.length; i += CONFIG.batchSize) {
      const batch = users.slice(i, i + CONFIG.batchSize);
      
      try {
        const positions = await Promise.all(
          batch.map(user => createStakeContract.getStakePositions(user))
        );
        
        batch.forEach((user, index) => {
          userPositions.set(user, positions[index]);
        });
        
        console.log(`📊 Processed ${Math.min(i + CONFIG.batchSize, users.length)}/${users.length} users`);
        
      } catch (error) {
        console.log(`⚠️ Error fetching positions for batch: ${error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Process events
    const processedData = this.processEvents(stakeEvents, createEvents, userPositions);
    
    return processedData;
  }

  processEvents(stakeEvents, createEvents, userPositions) {
    let enrichedStakeEvents = [];
    let enrichedCreateEvents = [];
    let totalStakedETH = 0;
    let totalCreatedETH = 0;
    let totalStakedTitanX = 0;
    let totalCreatedTitanX = 0;
    
    // Process stakes
    for (const event of stakeEvents) {
      const user = event.args.user;
      const stakeIndex = event.args.stakeIndex.toString();
      const userPos = userPositions.get(user);
      
      let costETH = "0";
      let costTitanX = "0";
      
      if (userPos && userPos.length > parseInt(stakeIndex)) {
        const position = userPos[parseInt(stakeIndex)];
        if (!position.isCreate) {
          costETH = position.costETH.toString();
          costTitanX = position.costTitanX.toString();
          
          totalStakedETH += parseFloat(ethers.utils.formatEther(position.costETH));
          totalStakedTitanX += parseFloat(ethers.utils.formatEther(position.costTitanX));
        }
      }
      
      enrichedStakeEvents.push({
        user: user,
        id: stakeIndex,
        principal: ethers.utils.formatEther(event.args.principal),
        shares: ethers.utils.formatEther(event.args.shares),
        duration: event.args.stakingDays.toString(),
        timestamp: event.args.startTime.toString(),
        blockNumber: event.blockNumber,
        stakingDays: Number(event.args.stakingDays),
        maturityDate: new Date((Number(event.args.startTime) + Number(event.args.stakingDays) * 86400) * 1000).toISOString(),
        costETH: costETH,
        costTitanX: costTitanX
      });
    }
    
    // Process creates
    for (const event of createEvents) {
      const user = event.args.user;
      const stakeIndex = event.args.stakeIndex.toString();
      const userPos = userPositions.get(user);
      
      let costETH = "0";
      let costTitanX = "0";
      
      if (userPos && userPos.length > parseInt(stakeIndex)) {
        const position = userPos[parseInt(stakeIndex)];
        if (position.isCreate) {
          costETH = position.costETH.toString();
          costTitanX = position.costTitanX.toString();
          
          totalCreatedETH += parseFloat(ethers.utils.formatEther(position.costETH));
          totalCreatedTitanX += parseFloat(ethers.utils.formatEther(position.costTitanX));
        }
      }
      
      enrichedCreateEvents.push({
        user: user,
        id: stakeIndex,
        torusAmount: ethers.utils.formatEther(event.args.torusAmount),
        endTime: event.args.endTime.toString(),
        timestamp: event.args.startTime?.toString() || "0",
        blockNumber: event.blockNumber,
        stakingDays: Math.floor((Number(event.args.endTime) - Number(event.args.startTime || 0)) / 86400),
        maturityDate: new Date(Number(event.args.endTime) * 1000).toISOString(),
        costETH: costETH,
        costTitanX: costTitanX
      });
    }
    
    const totalETH = totalStakedETH + totalCreatedETH;
    const totalTitanX = totalStakedTitanX + totalCreatedTitanX;
    
    console.log(`✅ Processed events with costs:
      Total ETH: ${totalETH.toFixed(6)}
      Total TitanX: ${totalTitanX.toFixed(2)}
      Staked ETH: ${totalStakedETH.toFixed(6)}
      Created ETH: ${totalCreatedETH.toFixed(6)}
      Staked TitanX: ${totalStakedTitanX.toFixed(2)}
      Created TitanX: ${totalCreatedTitanX.toFixed(2)}`);
    
    return {
      stakeEvents: enrichedStakeEvents,
      createEvents: enrichedCreateEvents,
      totals: {
        totalETH: totalETH.toFixed(6),
        totalTitanX: totalTitanX.toFixed(2),
        totalStakedETH: totalStakedETH.toFixed(6),
        totalCreatedETH: totalCreatedETH.toFixed(6),
        totalStakedTitanX: totalStakedTitanX.toFixed(2),
        totalCreatedTitanX: totalCreatedTitanX.toFixed(2)
      }
    };
  }

  async fetchTokenData() {
    console.log('🪙 Fetching token data...');
    
    try {
      const torusToken = new ethers.Contract(CONFIG.contracts.TORUS_TOKEN, ABIS.erc20, this.provider);
      
      const [totalSupply, decimals, symbol, name] = await Promise.all([
        torusToken.totalSupply(),
        torusToken.decimals(),
        torusToken.symbol(),
        torusToken.name()
      ]);
      
      return {
        address: CONFIG.contracts.TORUS_TOKEN,
        name: name,
        symbol: symbol,
        decimals: decimals,
        totalSupply: ethers.utils.formatUnits(totalSupply, decimals)
      };
      
    } catch (error) {
      console.log('⚠️ Error fetching token data:', error.message);
      return null;
    }
  }

  generateRewardPoolData() {
    console.log('🎁 Generating reward pool data...');
    
    const currentProtocolDay = Math.floor((Date.now() - new Date('2025-07-11').getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const rewardPoolData = [];
    const totalRewards = 93000; // 93K TORUS
    const rewardPerDay = totalRewards / 89;
    
    for (let day = 1; day <= 89; day++) {
      rewardPoolData.push({
        day: day,
        rewardPool: rewardPerDay.toFixed(2),
        timestamp: new Date(Date.now() + (day - currentProtocolDay) * 24 * 60 * 60 * 1000).toISOString()
      });
    }
    
    return { rewardPoolData, currentProtocolDay };
  }

  createBackup() {
    const backupDir = path.resolve(__dirname, CONFIG.backupDir);
    const outputPath = path.resolve(__dirname, CONFIG.outputPath);
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    if (fs.existsSync(outputPath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `cached-data-${timestamp}.json`);
      fs.copyFileSync(outputPath, backupPath);
      console.log(`📦 Backup created: ${backupPath}`);
    }
  }

  async buildCompleteJSON(enrichedData, tokenData, rewardData, currentBlock) {
    const completeJSON = {
      lastUpdated: new Date().toISOString(),
      version: "4.0.0",
      metadata: {
        dataSource: "Complete blockchain extraction with proper separation of concerns",
        fallbackToRPC: false,
        cacheExpiryMinutes: 60,
        description: "TORUS dashboard data with world-class architecture"
      },
      stakingData: {
        stakeEvents: enrichedData.stakeEvents,
        createEvents: enrichedData.createEvents,
        rewardPoolData: rewardData.rewardPoolData,
        currentProtocolDay: rewardData.currentProtocolDay,
        totalSupply: tokenData ? parseFloat(tokenData.totalSupply) : 0,
        burnedSupply: 0,
        lastUpdated: new Date().toISOString(),
        metadata: {
          currentBlock: currentBlock,
          lastIncrementalUpdate: new Date().toISOString(),
          incrementalUpdatesApplied: false
        }
      },
      poolData: {
        address: ethers.constants.AddressZero,
        token0: CONFIG.contracts.WETH,
        token1: CONFIG.contracts.TORUS_TOKEN,
        fee: 3000,
        liquidity: "0",
        sqrtPriceX96: "0",
        tick: 0,
        lastUpdated: new Date().toISOString()
      },
      contractData: {
        torusToken: tokenData || {
          address: CONFIG.contracts.TORUS_TOKEN,
          name: "TORUS",
          symbol: "TORUS",
          decimals: 18,
          totalSupply: "0"
        },
        titanxToken: {
          address: CONFIG.contracts.TITANX_TOKEN,
          name: "TitanX",
          symbol: "TITANX",
          decimals: 18,
          totalSupply: "0"
        },
        createStakeContract: {
          address: CONFIG.contracts.TORUS_CREATE_STAKE
        },
        buyProcessContract: {
          address: CONFIG.contracts.TORUS_BUY_PROCESS
        }
      },
      totals: enrichedData.totals,
      lpPositions: [],
      historicalData: {
        sevenDay: [],
        thirtyDay: []
      },
      tokenPrices: {
        torus: {
          usd: 0,
          lastUpdated: new Date().toISOString()
        },
        titanx: {
          usd: 0,
          lastUpdated: new Date().toISOString()
        }
      }
    };
    
    return completeJSON;
  }

  async run() {
    console.log('🚀 TORUS Dashboard Data Update');
    console.log('==============================');
    
    try {
      // Create backup
      this.createBackup();
      
      // Get working provider
      await this.getWorkingProvider();
      
      // Fetch events
      const { stakeEvents, createEvents, currentBlock } = await this.fetchEvents();
      
      // Enrich with costs
      const enrichedData = await this.enrichEventsWithCosts(stakeEvents, createEvents);
      
      // Fetch additional data
      const tokenData = await this.fetchTokenData();
      const rewardData = this.generateRewardPoolData();
      
      // Build complete JSON
      const completeJSON = await this.buildCompleteJSON(enrichedData, tokenData, rewardData, currentBlock);
      
      // Save to file
      const outputPath = path.resolve(__dirname, CONFIG.outputPath);
      fs.writeFileSync(outputPath, JSON.stringify(completeJSON, null, 2));
      
      console.log('✅ Dashboard data update completed successfully!');
      console.log(`📄 Saved to: ${outputPath}`);
      console.log(`📊 Summary:
        - Version: ${completeJSON.version}
        - Stake events: ${enrichedData.stakeEvents.length}
        - Create events: ${enrichedData.createEvents.length}
        - Total ETH: ${enrichedData.totals.totalETH}
        - Total TitanX: ${enrichedData.totals.totalTitanX}
        - Current block: ${currentBlock}
        - Protocol day: ${rewardData.currentProtocolDay}`);
      
    } catch (error) {
      console.error('❌ Error updating dashboard data:', error);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const updater = new DataUpdater();
  updater.run();
}

module.exports = DataUpdater;