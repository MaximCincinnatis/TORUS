// Incremental updater - updates blockchain data from where JSON left off
import { ethers } from 'ethers';
import { CONTRACTS, CREATE_STAKE_ABI } from '../constants/contracts';
import { RpcRateLimit } from './rpcRateLimit';

// Working RPC endpoints (all public, no API keys)
const WORKING_RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://rpc.payload.de',
  'https://eth-mainnet.public.blastapi.io',
  'https://rpc.flashbots.net',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth'
];

let currentRpcIndex = 0;

async function getWorkingProviderWithRotation(): Promise<ethers.providers.JsonRpcProvider> {
  const maxRetries = WORKING_RPC_ENDPOINTS.length;
  
  for (let i = 0; i < maxRetries; i++) {
    const rpcUrl = WORKING_RPC_ENDPOINTS[currentRpcIndex];
    
    try {
      console.log(`🔄 Incremental updater trying RPC: ${rpcUrl}`);
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      
      // Quick test with timeout to avoid 429 errors
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 3000);
      });
      
      await RpcRateLimit.execute(async () => {
        return Promise.race([
          provider.getBlockNumber(),
          timeoutPromise
        ]);
      }, `Incremental updater RPC test for ${rpcUrl}`);
      
      console.log(`✅ Incremental updater connected to: ${rpcUrl}`);
      return provider;
      
    } catch (error) {
      console.log(`❌ Incremental updater RPC ${rpcUrl} failed:`, error instanceof Error ? error.message : 'Unknown error');
      
      // Auto-rotate to next provider
      currentRpcIndex = (currentRpcIndex + 1) % WORKING_RPC_ENDPOINTS.length;
      
      // Add delay before trying next provider to avoid rapid requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error('All RPC providers failed for incremental updates');
}

export interface IncrementalUpdate {
  newStakeEvents: any[];
  newCreateEvents: any[];
  fromBlock: number;
  toBlock: number;
  updated: boolean;
}

/**
 * Get incremental updates from the last cached block
 */
export async function getIncrementalUpdates(
  cachedData: any,
  provider: ethers.providers.JsonRpcProvider
): Promise<IncrementalUpdate> {
  console.log('🔄 Getting incremental updates from cached data...');
  
  // Get the last block from cached data
  const lastBlock = cachedData.stakingData?.metadata?.currentBlock || 
                   cachedData.stakingData?.lastBlock || 
                   22890272; // Fallback to deployment block
  
  const currentBlock = await RpcRateLimit.execute(async () => {
    return provider.getBlockNumber();
  }, 'Get current block number for incremental updates');
  
  console.log(`📊 Last cached block: ${lastBlock}`);
  console.log(`📊 Current block: ${currentBlock}`);
  
  // If we're up to date, return empty
  if (currentBlock <= lastBlock) {
    console.log('✅ Cache is up to date, no incremental updates needed');
    return {
      newStakeEvents: [],
      newCreateEvents: [],
      fromBlock: lastBlock,
      toBlock: currentBlock,
      updated: false
    };
  }
  
  const blocksToUpdate = currentBlock - lastBlock;
  console.log(`📊 Blocks to update: ${blocksToUpdate}`);
  
  // Only update if there are enough new blocks (avoid constant small updates)
  if (blocksToUpdate < 10) {
    console.log('⏳ Not enough new blocks, skipping incremental update');
    return {
      newStakeEvents: [],
      newCreateEvents: [],
      fromBlock: lastBlock,
      toBlock: currentBlock,
      updated: false
    };
  }
  
  try {
    console.log(`🔄 Fetching new events from block ${lastBlock + 1} to ${currentBlock}...`);
    
    // Get working provider with auto-rotation
    const workingProvider = await getWorkingProviderWithRotation();
    
    // Create contract instance
    const contract = new ethers.Contract(CONTRACTS.TORUS_CREATE_STAKE, CREATE_STAKE_ABI, workingProvider);
    
    // If block range is too large, fetch in chunks
    const MAX_BLOCK_RANGE = 9999; // Stay under 10k limit
    let allStakeEvents: any[] = [];
    let allCreateEvents: any[] = [];
    
    if (blocksToUpdate > MAX_BLOCK_RANGE) {
      console.log(`📦 Block range too large (${blocksToUpdate}), fetching in chunks...`);
      
      for (let fromBlock = lastBlock + 1; fromBlock <= currentBlock; fromBlock += MAX_BLOCK_RANGE) {
        const toBlock = Math.min(fromBlock + MAX_BLOCK_RANGE - 1, currentBlock);
        console.log(`  Fetching blocks ${fromBlock} to ${toBlock}...`);
        
        // Fetch stake events for this chunk
        const stakeFilter = contract.filters.Staked();
        const stakeChunk = await RpcRateLimit.execute(async () => {
          return contract.queryFilter(stakeFilter, fromBlock, toBlock);
        }, `Fetch stake events from block ${fromBlock} to ${toBlock}`);
        allStakeEvents.push(...stakeChunk);
        
        // Fetch create events for this chunk
        const createFilter = contract.filters.Created();
        const createChunk = await RpcRateLimit.execute(async () => {
          return contract.queryFilter(createFilter, fromBlock, toBlock);
        }, `Fetch create events from block ${fromBlock} to ${toBlock}`);
        allCreateEvents.push(...createChunk);
      }
    } else {
      // Fetch all at once if within limit
      const stakeFilter = contract.filters.Staked();
      allStakeEvents = await RpcRateLimit.execute(async () => {
        return contract.queryFilter(stakeFilter, lastBlock + 1, currentBlock);
      }, `Fetch stake events from block ${lastBlock + 1} to ${currentBlock}`);
      
      const createFilter = contract.filters.Created();
      allCreateEvents = await RpcRateLimit.execute(async () => {
        return contract.queryFilter(createFilter, lastBlock + 1, currentBlock);
      }, `Fetch create events from block ${lastBlock + 1} to ${currentBlock}`);
    }
    
    const stakeEvents = allStakeEvents;
    const createEvents = allCreateEvents;
    
    // Process events to match expected format
    const processedStakeEvents = stakeEvents.map(event => {
      if (!event.args) return null;
      const startTime = Number(event.args.startTime);
      const stakingDays = Number(event.args.stakingDays);
      const maturityTimestamp = (startTime + stakingDays * 86400) * 1000;
      
      // Calculate protocol day from timestamp
      const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z'); // July 10, 2025 6:00 PM UTC
      const eventDate = new Date(startTime * 1000);
      const msPerDay = 24 * 60 * 60 * 1000;
      const protocolDay = Math.floor((eventDate.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1;
      
      return {
        user: event.args.user,
        id: event.args.stakeIndex.toString(),
        principal: event.args.principal.toString(),
        shares: event.args.shares.toString(),
        duration: event.args.stakingDays.toString(),
        timestamp: event.args.startTime.toString(),
        blockNumber: event.blockNumber,
        stakingDays: stakingDays,
        maturityDate: new Date(maturityTimestamp).toISOString(),
        protocolDay: Math.max(1, protocolDay), // Ensure minimum of day 1
        costETH: "0", // Will be populated by RPC update
        costTitanX: "0"
      };
    }).filter(event => event !== null);
    
    const processedCreateEvents = createEvents.map(event => {
      if (!event.args) return null;
      const startTime = Number(event.args.startTime) || 0;
      const endTime = Number(event.args.endTime);
      const stakingDays = Math.floor((endTime - startTime) / 86400);
      
      // Calculate protocol day from timestamp
      const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z'); // July 10, 2025 6:00 PM UTC
      const eventDate = new Date(startTime * 1000);
      const msPerDay = 24 * 60 * 60 * 1000;
      const protocolDay = Math.floor((eventDate.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1;
      
      return {
        user: event.args.user,
        id: event.args.stakeIndex.toString(),
        torusAmount: event.args.torusAmount.toString(),
        endTime: event.args.endTime.toString(),
        timestamp: event.args.startTime?.toString() || "0",
        blockNumber: event.blockNumber,
        stakingDays: stakingDays,
        maturityDate: new Date(endTime * 1000).toISOString(),
        protocolDay: Math.max(1, protocolDay), // Ensure minimum of day 1
        costETH: "0", // Will be populated by RPC update
        costTitanX: "0"
      };
    }).filter(event => event !== null);
    
    console.log(`✅ Found ${processedStakeEvents.length} new stake events`);
    console.log(`✅ Found ${processedCreateEvents.length} new create events`);
    
    return {
      newStakeEvents: processedStakeEvents,
      newCreateEvents: processedCreateEvents,
      fromBlock: lastBlock + 1,
      toBlock: currentBlock,
      updated: true
    };
    
  } catch (error) {
    console.error('❌ Error fetching incremental updates:', error);
    return {
      newStakeEvents: [],
      newCreateEvents: [],
      fromBlock: lastBlock,
      toBlock: currentBlock,
      updated: false
    };
  }
}

/**
 * Merge incremental updates with existing cached data
 */
export function mergeIncrementalUpdates(
  cachedData: any,
  updates: IncrementalUpdate
): any {
  if (!updates.updated) {
    return cachedData;
  }
  
  console.log('🔄 Merging incremental updates with cached data...');
  
  const updatedData = { ...cachedData };
  
  // Add new events to existing arrays
  updatedData.stakingData.stakeEvents = [
    ...cachedData.stakingData.stakeEvents,
    ...updates.newStakeEvents
  ];
  
  updatedData.stakingData.createEvents = [
    ...cachedData.stakingData.createEvents,
    ...updates.newCreateEvents
  ];
  
  // Update metadata
  if (!updatedData.stakingData.metadata) {
    updatedData.stakingData.metadata = {};
  }
  
  updatedData.stakingData.metadata.currentBlock = updates.toBlock;
  updatedData.stakingData.metadata.lastIncrementalUpdate = new Date().toISOString();
  updatedData.stakingData.metadata.incrementalUpdatesApplied = true;
  
  updatedData.lastUpdated = new Date().toISOString();
  
  console.log(`✅ Merged ${updates.newStakeEvents.length} stake events and ${updates.newCreateEvents.length} create events`);
  console.log(`📊 Total events: ${updatedData.stakingData.stakeEvents.length} stakes, ${updatedData.stakingData.createEvents.length} creates`);
  
  return updatedData;
}

/**
 * Check if incremental updates are available
 */
export async function shouldUpdateIncrementally(
  cachedData: any,
  provider: ethers.providers.JsonRpcProvider
): Promise<boolean> {
  try {
    const lastBlock = cachedData.stakingData?.metadata?.currentBlock || 
                     cachedData.stakingData?.lastBlock || 
                     22890272;
    
    const currentBlock = await RpcRateLimit.execute(async () => {
      return provider.getBlockNumber();
    }, 'Check current block for incremental update decision');
    const blocksToUpdate = currentBlock - lastBlock;
    
    // Update if there are 10+ new blocks
    return blocksToUpdate >= 10;
    
  } catch (error) {
    console.error('❌ Error checking if incremental update needed:', error);
    return false;
  }
}