import { ethers } from 'ethers';
import { CONTRACTS, CREATE_STAKE_ABI, TORUS_TOKEN_ABI } from '../constants/contracts';
import { DataCache } from './cache';

// List of backup RPC endpoints (tested and working)
const RPC_ENDPOINTS = [
  'https://ethereum.publicnode.com',
  'https://1rpc.io/eth',
  'https://eth.llamarpc.com',
  'https://eth-mainnet.public.blastapi.io',
];

let currentRpcIndex = 0;
let provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[currentRpcIndex]);

// Function to try next RPC endpoint
const tryNextRpc = () => {
  currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
  console.log(`Switching to RPC endpoint: ${RPC_ENDPOINTS[currentRpcIndex]}`);
  provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[currentRpcIndex]);
};

// Export provider getter
export function getProvider() {
  return provider;
}

export interface StakeTorus {
  principal: string;
  power: string;
  stakingDays: string;
  startTime: string;
  startDayIndex: string;
  endTime: string;
  shares: string;
  claimedCreate: boolean;
  claimedStake: boolean;
  costTitanX: string;
  costETH: string;
  rewards: string;
  penalties: string;
  claimedAt: string;
  isCreate: boolean;
}

export interface StakeEvent {
  user: string;
  id: string;
  principal: string;
  shares: string;
  duration: string;
  timestamp: string;
  maturityDate: Date;
  blockNumber: number;
  stakingDays: number;
}

export interface CreateEvent {
  user: string;
  stakeIndex?: string;
  torusAmount: string;
  titanAmount?: string;
  endTime: string;
  timestamp: string;
  maturityDate: Date;
  blockNumber: number;
  shares: string;
  stakingDays: number;
}

// Debug helper function
// Validation helper for creates data
const validateCreateData = (creates: CreateEvent[]) => {
  if (creates.length === 0) {
    console.log('⚠️ WARNING: No create events found');
    return { isValid: true, warnings: ['No create events'] };
  }
  
  const warnings: string[] = [];
  let totalTitanX = 0;
  let eventsWithTitanX = 0;
  
  creates.forEach((create, i) => {
    // Check for astronomical values (data corruption indicator)
    const titanXAmount = parseFloat(create.titanAmount || '0') / 1e18;
    totalTitanX += titanXAmount;
    
    if (titanXAmount > 0) {
      eventsWithTitanX++;
    }
    
    if (titanXAmount > 1e12) {
      warnings.push(`Event ${i}: Astronomical TitanX value: ${titanXAmount.toExponential(2)}`);
    }
    
    // Check for missing data
    if (!create.titanAmount || create.titanAmount === '0') {
      if (i < 5) warnings.push(`Event ${i}: Missing titanAmount`);
    }
    
    if (!create.maturityDate) {
      warnings.push(`Event ${i}: Missing maturityDate`);
    }
  });
  
  const coverage = (eventsWithTitanX / creates.length) * 100;
  
  console.log(`\n📊 CREATE DATA VALIDATION:`);
  console.log(`Total creates: ${creates.length}`);
  console.log(`Events with TitanX data: ${eventsWithTitanX} (${coverage.toFixed(1)}%)`);
  console.log(`Total TitanX: ${totalTitanX.toLocaleString()} (${totalTitanX < 1e12 ? '✅ Normal' : '🚨 SUSPICIOUS'})`);
  
  if (warnings.length > 0) {
    console.log(`⚠️ Warnings (${warnings.length}):`);
    warnings.slice(0, 5).forEach(w => console.log(`  ${w}`));
    if (warnings.length > 5) console.log(`  ... and ${warnings.length - 5} more`);
  }
  
  return { 
    isValid: totalTitanX < 1e12 && coverage > 50,
    warnings,
    coverage,
    totalTitanX
  };
};

const logFetchMode = (eventType: string, isIncremental: boolean, forceFullRefresh: boolean, fromBlock: number, currentBlock: number, existingCount: number) => {
  console.log(`\n%c=== ${eventType.toUpperCase()} FETCH MODE ===`, 'background: #059669; color: white; font-weight: bold; font-size: 16px; padding: 10px');
  
  if (forceFullRefresh) {
    console.log('🔄 MODE: FORCED FULL REFRESH (user requested)');
    console.log('📋 Cache cleared, fetching complete blockchain history');
  } else if (isIncremental) {
    console.log('🔄 MODE: INCREMENTAL FETCH (cache + new data)');
    console.log(`📦 Starting with ${existingCount} cached events`);
    console.log(`📋 Only fetching blocks ${fromBlock} to ${currentBlock}`);
  } else {
    console.log('🆕 MODE: FULL FETCH (first time or no cache)');
    console.log('📋 Fetching complete blockchain history from deployment');
  }
  
  console.log(`📊 Block range: ${fromBlock} → ${currentBlock} (${currentBlock - fromBlock + 1} blocks)`);
  console.log('=======================================\n');
};

export const fetchStakeEvents = async (forceFullRefresh: boolean = false): Promise<StakeEvent[]> => {
  // Get current block first
  const currentBlock = await provider.getBlockNumber();
  
  // Check cache with proper block-aware logic
  let lastCachedBlock = DataCache.getLastBlockNumber();
  let cachedEvents = DataCache.get<StakeEvent[]>('stake_events', currentBlock);
  
  // Check if we need to fetch new events
  const needsUpdate = !lastCachedBlock || lastCachedBlock < currentBlock;
  
  // If cache is valid, not forcing refresh, and we're already up to date, return cached
  if (cachedEvents && lastCachedBlock && !forceFullRefresh && !needsUpdate) {
    console.log(`✅ Already up to date - using cached stake events (${cachedEvents.length} events, block ${lastCachedBlock})`);
    return cachedEvents;
  }
  
  // Log the update need
  if (needsUpdate && !forceFullRefresh) {
    console.log(`📊 Update needed: last cached block ${lastCachedBlock}, current block ${currentBlock}`);
  }
  
  // Force full refresh if requested
  if (forceFullRefresh) {
    console.log(`🔄 FORCED FULL REFRESH - Clearing cache and fetching all stake events from deployment`);
    DataCache.remove('stake_events');
  }
  
  // Determine starting block for fetch - IMPROVED LOGIC
  const deploymentBlock = 22890272; // Correct deployment block from Etherscan
  let fromBlock = deploymentBlock;
  let existingEvents: StakeEvent[] = [];
  
  // IMPORTANT: Clear cache if we suspect data is from wrong deployment
  const shouldClearCache = (
    (lastCachedBlock && lastCachedBlock < deploymentBlock) ||
    (cachedEvents && cachedEvents.length === 0 && lastCachedBlock && lastCachedBlock > deploymentBlock) ||
    (cachedEvents && cachedEvents.length < 10 && currentBlock - deploymentBlock > 1000) // Suspiciously few events
  );
  
  if (shouldClearCache) {
    console.log('⚠️ STAKE: CLEARING CACHE - Suspected invalid data');
    console.log(`  Last cached block: ${lastCachedBlock}`);
    console.log(`  Cached events: ${cachedEvents ? cachedEvents.length : 'none'}`);
    DataCache.remove('create_events');
    DataCache.remove('stake_events');
    DataCache.remove('last_block_number');
    
    // After clearing, re-read cache values
    lastCachedBlock = DataCache.getLastBlockNumber();
    cachedEvents = DataCache.get<StakeEvent[]>('stake_events', currentBlock);
  }
  
  // IMPROVED: Use incremental fetch if we have ANY record of last processed block
  // Even if cache data expired, we can still do incremental fetching
  // BUT NOT if forcing full refresh
  if (!forceFullRefresh && lastCachedBlock && lastCachedBlock >= deploymentBlock && lastCachedBlock < currentBlock) {
    // We have a record of last processed block - do incremental fetch
    fromBlock = lastCachedBlock + 1;
    
    // If we have valid cached events, use them as starting point
    if (cachedEvents) {
      existingEvents = cachedEvents;
      console.log(`🔄 Incremental fetch with cache: from block ${fromBlock} to ${currentBlock} (${currentBlock - fromBlock + 1} new blocks)`);
      console.log(`📦 Starting with ${existingEvents.length} cached events`);
    } else {
      // Cache expired but we know last processed block - fetch from there
      console.log(`🔄 Incremental fetch (cache expired): from block ${fromBlock} to ${currentBlock} (${currentBlock - fromBlock + 1} new blocks)`);
      console.log(`📦 Cache expired - will need to refetch some recent events`);
      
      // For safety, go back a few blocks in case we missed something
      fromBlock = Math.max(deploymentBlock, lastCachedBlock - 100);
      console.log(`📦 Going back to block ${fromBlock} for safety margin`);
    }
  } else if (lastCachedBlock && lastCachedBlock >= currentBlock) {
    // We're up to date or ahead (shouldn't happen, but handle gracefully)
    console.log(`✅ Already up to date - cached block ${lastCachedBlock}, current block ${currentBlock}`);
    return cachedEvents || [];
  } else {
    // No previous record or invalid - do full fetch
    console.log(`🆕 Full fetch: from block ${fromBlock} to ${currentBlock} (no previous processing record)`);
  }
  
  let attempts = 0;
  const maxAttempts = RPC_ENDPOINTS.length;
  
  while (attempts < maxAttempts) {
    try {
      const isIncremental = existingEvents.length > 0;
      logFetchMode('STAKE', isIncremental, forceFullRefresh, fromBlock, currentBlock, existingEvents.length);
      console.log(`🌐 RPC Endpoint: ${RPC_ENDPOINTS[currentRpcIndex]}`);
      const contract = new ethers.Contract(CONTRACTS.TORUS_CREATE_STAKE, CREATE_STAKE_ABI, provider);
      
      const maxBlockRange = 45000; // Stay under 50k limit
      
      console.log(`Fetching stake events from block ${fromBlock} to ${currentBlock}`);
      console.log(`Total blocks to scan: ${currentBlock - fromBlock + 1}`);
      
      // Create filter for Staked events
      const filter = contract.filters.Staked();
      console.log('Filter created:', filter);
      
      // Log the event signature we're looking for
      const eventFragment = contract.interface.getEvent('Staked');
      console.log('Staked event signature:', eventFragment ? eventFragment.format() : 'NOT FOUND');
      
      // Fetch events in chunks
      const newEvents: any[] = [];
      let currentFromBlock = fromBlock;
      let chunkCount = 0;
      
      while (currentFromBlock <= currentBlock) {
        const toBlock = Math.min(currentFromBlock + maxBlockRange, currentBlock);
        chunkCount++;
        console.log(`Fetching chunk ${chunkCount}: blocks ${currentFromBlock} to ${toBlock} (${toBlock - currentFromBlock + 1} blocks)`);
        
        try {
          const chunkEvents = await contract.queryFilter(filter, currentFromBlock, toBlock);
          newEvents.push(...chunkEvents);
          console.log(`✓ Chunk ${chunkCount}: Found ${chunkEvents.length} Staked events`);
          
          // Log first event in chunk if any
          if (chunkEvents.length > 0) {
            const firstEvent = chunkEvents[0] as any;
            console.log('Sample event from chunk:', {
              blockNumber: firstEvent.blockNumber,
              transactionHash: firstEvent.transactionHash,
              args: firstEvent.args
            });
          }
        } catch (chunkError) {
          console.error(`✗ Error fetching chunk ${currentFromBlock}-${toBlock}:`, chunkError);
        }
        
        currentFromBlock = toBlock + 1;
      }
      
      // Combine existing cached events with new events
      const allEvents = [...existingEvents, ...newEvents];
      
      console.log(`\n=== STAKE EVENTS SUMMARY ===`);
      console.log(`New Staked events found: ${newEvents.length}`);
      console.log(`Total events (cached + new): ${allEvents.length}`);
      console.log(`Total chunks processed: ${chunkCount}`);
      
      if (allEvents.length > 0) {
        // Sort events by block number to ensure correct order
        allEvents.sort((a, b) => a.blockNumber - b.blockNumber);
        console.log(`First stake event block: ${allEvents[0].blockNumber}`);
        console.log(`Last stake event block: ${allEvents[allEvents.length - 1].blockNumber}`);
        
        // Log info about new events if any
        if (newEvents.length > 0) {
          console.log('\nNew events added:');
          newEvents.slice(0, 3).forEach((event, idx) => {
            console.log(`  ${idx + 1}. Block ${event.blockNumber}, User: ${event.args.user.slice(0, 10)}...`);
          });
        } else {
          console.log('\n✅ No new events - all data was cached');
        }
      } else {
        console.log('⚠️ NO STAKED EVENTS FOUND!');
      }
      console.log('========================\n');
      
      console.log('\n=== PROCESSING STAKE EVENTS ===');
      
      // IMPROVED: Use incremental processing like creates to avoid Date serialization issues
      let finalProcessedEvents: StakeEvent[] = [];
      
      if (existingEvents.length > 0 && newEvents.length > 0) {
        // Incremental mode: preserve existing processed events, only process new events
        console.log('🔧 INCREMENTAL MODE: Preserving cached stake events, processing only new events');
        
        // Keep existing processed events as-is (they were already processed correctly)
        finalProcessedEvents = [...existingEvents];
        console.log(`📦 Preserving ${existingEvents.length} cached processed stake events`);
        
        // Only process the NEW events
        console.log(`🆕 Processing ${newEvents.length} new stake events only`);
        
        const newProcessedEvents = await Promise.all(newEvents.map(async (event: any, idx: number) => {
        const args = event.args;
        
        // Log raw args for first few events
        if (idx < 3) {
          console.log(`\nProcessing stake event ${idx + 1}:`);
          console.log('  Raw args:', {
            user: args.user,
            stakeIndex: args.stakeIndex?.toString(),
            principal: args.principal?.toString(),
            stakingDays: args.stakingDays?.toString(),
            shares: args.shares?.toString()
          });
        }
        
        // Get block timestamp since event doesn't include timestamp
        // We MUST fetch block data to get accurate timestamp for maturity calculation
        const blockNumber = event.blockNumber;
        let timestamp;
        
        try {
          const block = await event.getBlock();
          timestamp = block.timestamp;
          if (idx < 3) {
            console.log(`  Block ${blockNumber} timestamp: ${new Date(timestamp * 1000).toISOString()}`);
          }
        } catch (err) {
          // If we can't get block timestamp, we can't calculate maturity date accurately
          console.error(`ERROR: Failed to get block ${blockNumber} timestamp:`, err);
          // Try alternative method
          const provider = event.provider || event.log?.provider;
          if (provider) {
            const block = await provider.getBlock(blockNumber);
            timestamp = block.timestamp;
          } else {
            throw new Error(`Cannot get timestamp for block ${blockNumber}`);
          }
        }
        
        const stakingDays = Number(args.stakingDays);
        const maturityDate = new Date((timestamp + stakingDays * 86400) * 1000);
        
        if (idx < 3) {
          console.log('  Calculated:', {
            blockNumber: event.blockNumber,
            timestamp: new Date(timestamp * 1000).toISOString(),
            stakingDays: `${stakingDays} days`,
            maturityDate: maturityDate.toISOString()
          });
        }
        
        return {
          user: args.user,
          id: args.stakeIndex.toString(),
          principal: args.principal.toString(),
          shares: args.shares.toString(),
          duration: args.stakingDays.toString(),
          timestamp: timestamp.toString(),
          maturityDate,
          blockNumber: event.blockNumber,
          stakingDays: stakingDays,
        };
        }));
        
        // Combine existing processed events with newly processed events
        finalProcessedEvents.push(...newProcessedEvents);
        console.log(`✅ Combined: ${existingEvents.length} cached + ${newProcessedEvents.length} new = ${finalProcessedEvents.length} total`);
        
      } else {
        // Full fetch mode: process all events normally
        console.log('🔧 FULL FETCH MODE: Processing all stake events');
        
        // Capture provider reference to avoid closure issues
        const currentProvider = provider;
        
        finalProcessedEvents = await Promise.all(allEvents.map(async (event: any, idx: number) => {
        const args = event.args;
        
        // Log raw args for first few events
        if (idx < 3) {
          console.log(`\nProcessing stake event ${idx + 1}:`);
          console.log('  Raw args:', {
            user: args.user,
            stakeIndex: args.stakeIndex?.toString(),
            principal: args.principal?.toString(),
            stakingDays: args.stakingDays?.toString(),
            shares: args.shares?.toString()
          });
        }
        
        // Get block timestamp since event doesn't include timestamp
        // We MUST fetch block data to get accurate timestamp for maturity calculation
        const blockNumber = event.blockNumber;
        let timestamp;
        
        try {
          const block = await currentProvider.getBlock(blockNumber);
          if (block) {
            timestamp = block.timestamp;
            
            if (idx < 3) {
              console.log(`  Block ${blockNumber} timestamp: ${new Date(timestamp * 1000).toISOString()}`);
            }
          } else {
            console.error(`ERROR: Block ${blockNumber} not found`);
            timestamp = Math.floor(Date.now() / 1000); // fallback
          }
          
          // Log detailed timestamp info for first few events
          if (idx < 3) {
            console.log(`  Block ${blockNumber} timestamp: ${new Date(timestamp * 1000).toISOString()}`);
          }
        } catch (err) {
          // If we can't get block timestamp, we can't calculate maturity date accurately
          console.error(`ERROR: Failed to get block ${blockNumber} timestamp:`, err);
          // Try alternative method
          const provider = event.provider || event.log?.provider;
          if (provider) {
            const block = await provider.getBlock(blockNumber);
            timestamp = block.timestamp;
          } else {
            throw new Error(`Cannot get timestamp for block ${blockNumber}`);
          }
        }
        
        const stakingDays = Number(args.stakingDays);
        const maturityDate = new Date((timestamp + stakingDays * 86400) * 1000);
        
        if (idx < 3) {
          console.log('  Calculated:', {
            blockNumber: event.blockNumber,
            timestamp: new Date(timestamp * 1000).toISOString(),
            stakingDays: `${stakingDays} days`,
            maturityDate: maturityDate.toISOString()
          });
        }
        
        return {
          user: args.user,
          id: args.stakeIndex.toString(),
          principal: args.principal.toString(),
          shares: args.shares.toString(),
          duration: args.stakingDays.toString(),
          timestamp: timestamp.toString(),
          maturityDate,
          blockNumber: event.blockNumber,
          stakingDays: stakingDays,
        };
        }));
      }
      
      console.log(`\nTotal stake events processed: ${finalProcessedEvents.length}`);
      console.log('=========================\n');
      
      // Cache the results
      DataCache.set('stake_events', finalProcessedEvents, currentBlock);
      DataCache.setLastBlockNumber(currentBlock);
      
      return finalProcessedEvents;
    } catch (error: any) {
      console.error(`Error with RPC ${RPC_ENDPOINTS[currentRpcIndex]}:`, error.message);
      attempts++;
      
      if (attempts < maxAttempts) {
        tryNextRpc();
      } else {
        console.error('All RPC endpoints failed for stake events');
        return [];
      }
    }
  }
  
  return [];
};

export const fetchCreateEvents = async (forceFullRefresh: boolean = false): Promise<CreateEvent[]> => {
  console.log('🚀 fetchCreateEvents CALLED - forceFullRefresh:', forceFullRefresh);
  
  try {
    // Get current block first
    const currentBlock = await provider.getBlockNumber();
    console.log('🔢 Current block number:', currentBlock);
  
  // Check cache with proper block-aware logic
  let lastCachedBlock = DataCache.getLastBlockNumber();
  let cachedEvents = DataCache.get<CreateEvent[]>('create_events', currentBlock);
  
  // Check if we need to fetch new events
  const needsUpdate = !lastCachedBlock || lastCachedBlock < currentBlock;
  
  // If cache is valid, not forcing refresh, and we're already up to date, return cached
  if (cachedEvents && lastCachedBlock && !forceFullRefresh && !needsUpdate && cachedEvents.length > 0) {
    console.log(`✅ Already up to date - using cached create events (${cachedEvents.length} events, block ${lastCachedBlock})`);
    return cachedEvents;
  } else if (cachedEvents && cachedEvents.length === 0 && lastCachedBlock && !forceFullRefresh) {
    console.warn('⚠️ WARNING: Cache has 0 events but marked as valid! Forcing re-fetch.');
    console.log('Detected cache corruption - will fetch all events.');
    forceFullRefresh = true;
  }
  
  // Log the update need
  if (needsUpdate && !forceFullRefresh) {
    console.log(`📊 Update needed: last cached block ${lastCachedBlock}, current block ${currentBlock}`);
  }
  
  // Force full refresh if requested
  if (forceFullRefresh) {
    console.log(`🔄 FORCED FULL REFRESH - Clearing cache and fetching all create events from deployment`);
    DataCache.remove('create_events');
  }
  
  // Determine starting block for fetch - IMPROVED LOGIC  
  const deploymentBlock = 22890272; // Correct deployment block from Etherscan
  let fromBlock = deploymentBlock;
  let existingEvents: CreateEvent[] = [];
  
  // IMPORTANT: Clear cache if we suspect data is from wrong deployment
  // This could happen if:
  // 1. lastCachedBlock < deploymentBlock (cached from before contract existed)
  // 2. We have cached events but they're empty or suspiciously few
  const shouldClearCache = (
    (lastCachedBlock && lastCachedBlock < deploymentBlock) ||
    (cachedEvents && cachedEvents.length === 0 && lastCachedBlock && lastCachedBlock > deploymentBlock) ||
    (cachedEvents && cachedEvents.length < 10 && currentBlock - deploymentBlock > 1000) // Suspiciously few events
  );
  
  if (shouldClearCache) {
    console.log('⚠️ CLEARING CACHE - Suspected invalid data');
    console.log(`  Reason: ${lastCachedBlock && lastCachedBlock < deploymentBlock ? 'Old deployment block' : 
                          cachedEvents && cachedEvents.length === 0 ? 'Empty cache with high block number' :
                          'Suspiciously few events'}`);
    console.log(`  Last cached block: ${lastCachedBlock}`);
    console.log(`  Cached events: ${cachedEvents ? cachedEvents.length : 'none'}`);
    console.log(`  Deployment block: ${deploymentBlock}`);
    
    DataCache.remove('create_events');
    DataCache.remove('stake_events');
    DataCache.remove('last_block_number');
    
    // After clearing, re-read cache values
    lastCachedBlock = DataCache.getLastBlockNumber();
    cachedEvents = DataCache.get<CreateEvent[]>('create_events', currentBlock);
    
    console.log('✅ Cache cleared completely');
    console.log('  New lastCachedBlock:', lastCachedBlock);
    console.log('  New cachedEvents:', cachedEvents);
  }
  
  // IMPROVED: Use incremental fetch if we have ANY record of last processed block
  // BUT NOT if forcing full refresh
  console.log('\n🔀 DETERMINING FETCH STRATEGY:');
  console.log(`  Force full refresh: ${forceFullRefresh}`);
  console.log(`  Last cached block: ${lastCachedBlock}`);
  console.log(`  Deployment block: ${deploymentBlock}`);
  console.log(`  Current block: ${currentBlock}`);
  console.log(`  Has cached events: ${cachedEvents ? cachedEvents.length : 'no'}`);
  
  if (!forceFullRefresh && lastCachedBlock && lastCachedBlock >= deploymentBlock && lastCachedBlock < currentBlock) {
    console.log('📋 PATH: Incremental fetch');
    // We have a record of last processed block - do incremental fetch
    fromBlock = lastCachedBlock + 1;
    
    // If we have valid cached events, use them as starting point
    if (cachedEvents) {
      existingEvents = cachedEvents;
      console.log(`🔄 Incremental create fetch with cache: from block ${fromBlock} to ${currentBlock} (${currentBlock - fromBlock + 1} new blocks)`);
      console.log(`📦 Starting with ${existingEvents.length} cached create events`);
    } else {
      // Cache expired but we know last processed block - fetch from there
      console.log(`🔄 Incremental create fetch (cache expired): from block ${fromBlock} to ${currentBlock} (${currentBlock - fromBlock + 1} new blocks)`);
      console.log(`📦 Cache expired - will need to refetch some recent events`);
      
      // For safety, go back a few blocks in case we missed something
      fromBlock = Math.max(deploymentBlock, lastCachedBlock - 100);
      console.log(`📦 Going back to block ${fromBlock} for safety margin`);
    }
  } else if (lastCachedBlock && lastCachedBlock >= currentBlock) {
    console.log('📋 PATH: Already up to date');
    // We're up to date or ahead (shouldn't happen, but handle gracefully)
    console.log(`✅ Already up to date - cached block ${lastCachedBlock}, current block ${currentBlock}`);
    console.log(`Returning ${cachedEvents ? cachedEvents.length : 0} cached events`);
    if (!cachedEvents || cachedEvents.length === 0) {
      console.error('❌ ERROR: Marked as up-to-date but have NO EVENTS!');
      console.error('This is likely a cache corruption issue. Forcing full refresh...');
      // Don't return empty cache - fall through to full fetch
      fromBlock = deploymentBlock;
      console.log('🔄 Forcing full fetch due to empty cache');
    } else {
      return cachedEvents;
    }
  } else {
    console.log('📋 PATH: Full fetch');
    // No previous record or invalid - do full fetch
    console.log(`🆕 Full create fetch: from block ${fromBlock} to ${currentBlock} (no previous processing record)`);
  }
  
  let attempts = 0;
  const maxAttempts = RPC_ENDPOINTS.length;
  
  while (attempts < maxAttempts) {
    try {
      const isIncremental = existingEvents.length > 0;
      logFetchMode('CREATE', isIncremental, forceFullRefresh, fromBlock, currentBlock, existingEvents.length);
      console.log(`🌐 RPC Endpoint: ${RPC_ENDPOINTS[currentRpcIndex]}`);
      console.log(`📄 Contract address: ${CONTRACTS.TORUS_CREATE_STAKE}`);
      
      const contract = new ethers.Contract(CONTRACTS.TORUS_CREATE_STAKE, CREATE_STAKE_ABI, provider);
      
      // Verify contract exists
      console.log('🔍 Verifying contract exists...');
      const code = await provider.getCode(CONTRACTS.TORUS_CREATE_STAKE);
      console.log(`📏 Contract code length: ${code.length} bytes`);
      
      if (code === '0x' || code === '0x0') {
        console.error('❌ Contract not found at address:', CONTRACTS.TORUS_CREATE_STAKE);
        throw new Error('Contract not found');
      }
      console.log('✅ Contract verified');
      
      const maxBlockRange = 45000; // Stay under 50k limit
      
      console.log(`\n🎯 FETCH PARAMETERS:`);
      console.log(`  From block: ${fromBlock}`);
      console.log(`  To block: ${currentBlock}`);
      console.log(`  Blocks to scan: ${currentBlock - fromBlock + 1}`);
      console.log(`  Is incremental: ${isIncremental}`);
      console.log(`  Force full refresh: ${forceFullRefresh}`);
      
      // Create filter for Created events
      console.log('\n🔧 Creating event filter...');
      const filter = contract.filters.Created();
      console.log('Filter created:', JSON.stringify(filter, null, 2));
      
      // Double-check we're looking for the right event
      console.log('Event filter:', filter);
      
      // The correct signature for the event with indexed user
      const eventSignature = 'Created(address,uint256,uint256,uint256)';
      const computedHash = ethers.utils.id(eventSignature);
      console.log('Expected Created event signature:', eventSignature);
      console.log('Expected topic hash:', computedHash);
      
      // Fetch events in chunks
      const newEvents: any[] = [];
      let currentFromBlock = fromBlock;
      let totalChunks = 0;
      
      console.log('📊 CREATE EVENTS FETCH DETAILS:');
      console.log(`  Deployment block: ${deploymentBlock}`);
      console.log(`  From block: ${fromBlock}`);
      console.log(`  To block: ${currentBlock}`);
      console.log(`  Total blocks to scan: ${currentBlock - fromBlock + 1}`);
      console.log(`  Chunks needed: ${Math.ceil((currentBlock - fromBlock + 1) / maxBlockRange)}`);
      
      while (currentFromBlock <= currentBlock) {
        const toBlock = Math.min(currentFromBlock + maxBlockRange, currentBlock);
        totalChunks++;
        console.log(`\n🔍 Fetching chunk ${totalChunks}: blocks ${currentFromBlock} to ${toBlock} (${toBlock - currentFromBlock + 1} blocks)`);
        
        try {
          console.log(`  📡 Calling queryFilter with:`, {
            filter: filter,
            from: currentFromBlock,
            to: toBlock
          });
          
          const chunkEvents = await contract.queryFilter(filter, currentFromBlock, toBlock);
          console.log(`  📦 queryFilter returned:`, chunkEvents);
          console.log(`  📊 Type of result:`, Array.isArray(chunkEvents) ? 'array' : typeof chunkEvents);
          
          newEvents.push(...chunkEvents);
          console.log(`✅ Found ${chunkEvents.length} events in chunk ${totalChunks}`);
          
          if (chunkEvents.length > 0) {
            console.log(`  First event in chunk: block ${chunkEvents[0].blockNumber}`);
            console.log(`  Last event in chunk: block ${chunkEvents[chunkEvents.length - 1].blockNumber}`);
            console.log(`  Sample event structure:`, chunkEvents[0]);
          }
        } catch (chunkError: any) {
          console.error(`❌ Error fetching chunk ${totalChunks} (${currentFromBlock}-${toBlock}):`, chunkError.message);
          console.error('Full error:', chunkError);
          
          // If chunk is too large, try smaller chunks
          if (chunkError.message?.includes('query returned more than') || chunkError.code === 'SERVER_ERROR') {
            console.log('🔄 Retrying with smaller chunk size...');
            const smallerChunkSize = Math.floor(maxBlockRange / 2);
            let retryFromBlock = currentFromBlock;
            
            while (retryFromBlock <= toBlock) {
              const retryToBlock = Math.min(retryFromBlock + smallerChunkSize, toBlock);
              try {
                const retryEvents = await contract.queryFilter(filter, retryFromBlock, retryToBlock);
                newEvents.push(...retryEvents);
                console.log(`  ✅ Retry successful: ${retryEvents.length} events in blocks ${retryFromBlock}-${retryToBlock}`);
              } catch (retryError) {
                console.error(`  ❌ Retry failed for blocks ${retryFromBlock}-${retryToBlock}:`, retryError);
              }
              retryFromBlock = retryToBlock + 1;
            }
          }
        }
        
        currentFromBlock = toBlock + 1;
      }
      
      console.log(`\n📊 CHUNK FETCH SUMMARY:`);
      console.log(`  Total chunks processed: ${totalChunks}`);
      console.log(`  Total new events found: ${newEvents.length}`);
      
      // Combine existing cached events with new events
      const allEvents = [...existingEvents, ...newEvents].sort((a, b) => a.blockNumber - b.blockNumber);
      
      console.log(`\n=== CREATE EVENTS SUMMARY ===`);
      console.log(`New create events found: ${newEvents.length}`);
      console.log(`Total events (cached + new): ${allEvents.length}`);
      
      if (newEvents.length > 0) {
        console.log('\nNew create events:');
        newEvents.slice(0, 3).forEach((event: any, idx: number) => {
          console.log(`  ${idx + 1}: user=${event.args.user.slice(0,10)}... stakeIndex=${event.args.stakeIndex} endTime=${event.args.endTime}`);
        });
      } else {
        console.log('\n✅ No new create events - all data was cached');
      }
      
      // CRITICAL FIX: Only process NEW events to avoid data corruption
      let finalProcessedEvents: CreateEvent[] = [];
      
      if (existingEvents.length > 0 && newEvents.length > 0) {
        // Incremental: We have cached events + new events
        console.log('🔧 INCREMENTAL MODE: Processing only new events to avoid corruption');
        
        // Keep existing processed events as-is (they were already processed correctly)
        finalProcessedEvents = [...existingEvents];
        console.log(`📦 Preserving ${existingEvents.length} cached processed events`);
        
        // Only process the NEW events
        const eventsToProcess = newEvents;
        console.log(`🆕 Processing ${newEvents.length} new events only`);
        
        // Group NEW events by user to batch contract calls
        const eventsByUser = new Map<string, any[]>();
        eventsToProcess.forEach((event: any) => {
          const user = event.args.user;
          if (!eventsByUser.has(user)) {
            eventsByUser.set(user, []);
          }
          eventsByUser.get(user)!.push(event);
        });

        // Fetch stake positions for users with NEW events only
        const userStakePositions = new Map<string, StakeTorus[]>();
        const users = Array.from(eventsByUser.keys());
        console.log(`Fetching stake positions for ${users.length} users with new events...`);
      
        // Also create a map to store titanX amounts by user and create event
        const titanXAmountsByEvent = new Map<string, string>();
        
        for (const user of users) {
        try {
          const positions = await contract.getStakePositions(user);
          userStakePositions.set(user, positions);
          console.log(`User ${user} has ${positions.length} stake positions`);
          
          // Count and log create positions
          const createPositions = positions.filter((p: any) => p.isCreate);
          console.log(`  - ${createPositions.length} are creates`);
          
          // Debug: log all positions for this user
          if (positions.length > 0) {
            console.log(`  All positions for ${user}:`);
            positions.forEach((p: any, idx: number) => {
              console.log(`    [${idx}] isCreate=${p.isCreate}, endTime=${p.endTime}, principal=${p.principal}, costTitanX=${p.costTitanX}`);
            });
          }
          
          // Match created events with positions
          const userEvents = eventsByUser.get(user) || [];
          for (const event of userEvents) {
            const eventEndTime = event.args.endTime.toString();
            const eventStakeIndex = event.args.stakeIndex.toString();
            
            // First try: Direct index access (if stakeIndex corresponds to array position)
            if (positions[Number(eventStakeIndex)] && positions[Number(eventStakeIndex)].isCreate) {
              const position = positions[Number(eventStakeIndex)];
              if (position.endTime.toString() === eventEndTime) {
                const eventKey = `${user}-${eventStakeIndex}-${eventEndTime}`;
                titanXAmountsByEvent.set(eventKey, position.costTitanX.toString());
                console.log(`Matched create by index ${eventStakeIndex}: titanX = ${position.costTitanX.toString()}`);
                continue;
              }
            }
            
            // Second try: Find by endTime among create positions
            const matchingPosition = positions.find((p: any) => 
              p.isCreate && 
              p.endTime.toString() === eventEndTime
            );
            
            if (matchingPosition) {
              const eventKey = `${user}-${eventStakeIndex}-${eventEndTime}`;
              titanXAmountsByEvent.set(eventKey, matchingPosition.costTitanX.toString());
              console.log(`Matched create by endTime: titanX = ${matchingPosition.costTitanX.toString()}`);
            } else {
              console.log(`WARNING: No match found for create ${eventStakeIndex} with endTime ${eventEndTime}`);
            }
          }
          
          if (createPositions.length > 0) {
            const totalTitanX = createPositions.reduce((sum: number, p: any) => {
              return sum + parseFloat(p.costTitanX.toString()) / 1e18;
            }, 0);
            console.log(`  - Total TitanX used in creates: ${totalTitanX.toFixed(2)}`);
          }
        } catch (error) {
          console.error(`Failed to get stake positions for ${user}:`, error);
          userStakePositions.set(user, []);
        }
        
        // Log summary of matching results for NEW events
        console.log(`\n=== TITANX MATCHING SUMMARY (NEW EVENTS) ===`);
        console.log(`New Create events: ${newEvents.length}`);
        console.log(`TitanX matches found: ${titanXAmountsByEvent.size}`);
        console.log(`Missing titanX data: ${newEvents.length - titanXAmountsByEvent.size}`);
        console.log(`================================\n`);
        
        // Process only NEW events
        const currentProvider = provider;
        const newProcessedEvents = await Promise.all(newEvents.map(async (event: any) => {
        const args = event.args;
        const endTime = Number(args.endTime);
        let maturityDate = new Date(endTime * 1000);
        const user = args.user;
        const stakeIndex = Number(args.stakeIndex);
        
        // Get block timestamp for when the create happened
        const block = await currentProvider.getBlock(event.blockNumber);
        const timestamp = block?.timestamp || Math.floor(Date.now() / 1000);
        
        // Get the actual stakingDays from the contract position
        let stakingDays = 0;
        let shares = BigInt(0);
        
        // If we have the position data, use the actual data from contract
        const userPositions = userStakePositions.get(user);
        if (userPositions && userPositions[stakeIndex]) {
          const position = userPositions[stakeIndex];
          if (position.isCreate) {
            stakingDays = parseInt(position.stakingDays);
            shares = BigInt(position.shares);
            
            // IMPORTANT: Use the endTime from the contract position, not the event!
            const contractEndTime = Number(position.endTime);
            if (contractEndTime !== endTime) {
              console.error(`ENDTIME MISMATCH! Event endTime: ${endTime}, Contract endTime: ${contractEndTime}`);
              // Update maturityDate to use contract's endTime
              maturityDate = new Date(contractEndTime * 1000);
            }
            
            console.log(`Using contract data for ${user} index ${stakeIndex}: stakingDays=${stakingDays}, shares=${shares}, endTime=${contractEndTime}`);
          }
        } else {
          // Fallback: calculate stakingDays (but this might be inaccurate)
          stakingDays = Math.round((endTime - timestamp) / 86400);
          const torusAmountBN = BigInt(args.torusAmount.toString());
          shares = torusAmountBN * BigInt(stakingDays) * BigInt(stakingDays);
          console.warn(`Fallback calculation for ${user}: stakingDays=${stakingDays}`);
        }
        
        // Get titanAmount from our pre-matched map
        let titanAmount = '0';
        const eventKey = `${user}-${stakeIndex}-${args.endTime.toString()}`;
        const matchedTitanAmount = titanXAmountsByEvent.get(eventKey);
        
        if (matchedTitanAmount) {
          titanAmount = matchedTitanAmount;
        } else {
          console.log(`WARNING: No titanX data for create ${stakeIndex} of ${user}`);
        }
        
        return {
          user,
          stakeIndex: stakeIndex.toString(),
          torusAmount: args.torusAmount.toString(),
          titanAmount,
          endTime: args.endTime.toString(),
          timestamp: timestamp.toString(),
          maturityDate,
          blockNumber: event.blockNumber,
          shares: shares.toString(),
          stakingDays,
        };
        }));
        
        // Combine existing processed events with newly processed events
        finalProcessedEvents.push(...newProcessedEvents);
        console.log(`✅ Combined: ${existingEvents.length} cached + ${newProcessedEvents.length} new = ${finalProcessedEvents.length} total`);
        
        }
      } else {
        // Full fetch mode: process all events normally
        console.log('🔧 FULL FETCH MODE: Processing all events');
        
        // Group events by user to batch contract calls
        const eventsByUser = new Map<string, any[]>();
        allEvents.forEach((event: any) => {
          const user = event.args.user;
          if (!eventsByUser.has(user)) {
            eventsByUser.set(user, []);
          }
          eventsByUser.get(user)!.push(event);
        });

        // Fetch stake positions for each user
        const userStakePositions = new Map<string, StakeTorus[]>();
        const users = Array.from(eventsByUser.keys());
        console.log(`Fetching stake positions for ${users.length} unique users...`);
        
        // Also create a map to store titanX amounts by user and create event
        const titanXAmountsByEvent = new Map<string, string>();
        
        for (const user of users) {
          try {
            const positions = await contract.getStakePositions(user);
            userStakePositions.set(user, positions);
            console.log(`User ${user} has ${positions.length} stake positions`);
            
            // Count and log create positions
            const createPositions = positions.filter((p: any) => p.isCreate);
            console.log(`  - ${createPositions.length} are creates`);
            
            // Debug: log all positions for this user
            if (positions.length > 0) {
              console.log(`  All positions for ${user}:`);
              positions.forEach((p: any, idx: number) => {
                console.log(`    [${idx}] isCreate=${p.isCreate}, endTime=${p.endTime}, principal=${p.principal}, costTitanX=${p.costTitanX}`);
              });
            }
            
            // Match created events with positions
            const userEvents = eventsByUser.get(user) || [];
            for (const event of userEvents) {
              const eventEndTime = event.args.endTime.toString();
              const eventStakeIndex = event.args.stakeIndex.toString();
              
              // First try: Direct index access (if stakeIndex corresponds to array position)
              if (positions[Number(eventStakeIndex)] && positions[Number(eventStakeIndex)].isCreate) {
                const position = positions[Number(eventStakeIndex)];
                if (position.endTime.toString() === eventEndTime) {
                  const eventKey = `${user}-${eventStakeIndex}-${eventEndTime}`;
                  titanXAmountsByEvent.set(eventKey, position.costTitanX.toString());
                  console.log(`Matched create by index ${eventStakeIndex}: titanX = ${position.costTitanX.toString()}`);
                  continue;
                }
              }
              
              // Second try: Find by endTime among create positions
              const matchingPosition = positions.find((p: any) => 
                p.isCreate && 
                p.endTime.toString() === eventEndTime
              );
              
              if (matchingPosition) {
                const eventKey = `${user}-${eventStakeIndex}-${eventEndTime}`;
                titanXAmountsByEvent.set(eventKey, matchingPosition.costTitanX.toString());
                console.log(`Matched create by endTime: titanX = ${matchingPosition.costTitanX.toString()}`);
              } else {
                console.log(`WARNING: No match found for create ${eventStakeIndex} with endTime ${eventEndTime}`);
              }
            }
            
            if (createPositions.length > 0) {
              const totalTitanX = createPositions.reduce((sum: number, p: any) => {
                return sum + parseFloat(p.costTitanX.toString()) / 1e18;
              }, 0);
              console.log(`  - Total TitanX used in creates: ${totalTitanX.toFixed(2)}`);
            }
          } catch (error) {
            console.error(`Failed to get stake positions for ${user}:`, error);
            userStakePositions.set(user, []);
          }
        }

        // Log summary of matching results
        console.log(`\n=== TITANX MATCHING SUMMARY ===`);
        console.log(`Total Create events: ${allEvents.length}`);
        console.log(`Total titanX matches found: ${titanXAmountsByEvent.size}`);
        console.log(`Missing titanX data for: ${allEvents.length - titanXAmountsByEvent.size} creates`);
        console.log(`================================\n`);
        
        // Capture provider reference outside the loop
        const currentProvider = provider;
        
        finalProcessedEvents = await Promise.all(allEvents.map(async (event: any) => {
          const args = event.args;
          const endTime = Number(args.endTime);
          let maturityDate = new Date(endTime * 1000);
          const user = args.user;
          const stakeIndex = Number(args.stakeIndex);
          
          // Get block timestamp for when the create happened
          const block = await currentProvider.getBlock(event.blockNumber);
          const timestamp = block?.timestamp || Math.floor(Date.now() / 1000);
          
          // Get the actual stakingDays from the contract position
          let stakingDays = 0;
          let shares = BigInt(0);
          
          // If we have the position data, use the actual data from contract
          const userPositions = userStakePositions.get(user);
          if (userPositions && userPositions[stakeIndex]) {
            const position = userPositions[stakeIndex];
            if (position.isCreate) {
              stakingDays = parseInt(position.stakingDays);
              shares = BigInt(position.shares);
              
              // IMPORTANT: Use the endTime from the contract position, not the event!
              const contractEndTime = Number(position.endTime);
              if (contractEndTime !== endTime) {
                console.error(`ENDTIME MISMATCH! Event endTime: ${endTime}, Contract endTime: ${contractEndTime}`);
                // Update maturityDate to use contract's endTime
                maturityDate = new Date(contractEndTime * 1000);
              }
              
              console.log(`Using contract data for ${user} index ${stakeIndex}: stakingDays=${stakingDays}, shares=${shares}, endTime=${contractEndTime}`);
            }
          } else {
            // Fallback: calculate stakingDays (but this might be inaccurate)
            stakingDays = Math.round((endTime - timestamp) / 86400);
            const torusAmountBN = BigInt(args.torusAmount.toString());
            shares = torusAmountBN * BigInt(stakingDays) * BigInt(stakingDays);
            console.warn(`Fallback calculation for ${user}: stakingDays=${stakingDays}`);
          }
          
          // Get titanAmount from our pre-matched map
          let titanAmount = '0';
          const eventKey = `${user}-${stakeIndex}-${args.endTime.toString()}`;
          const matchedTitanAmount = titanXAmountsByEvent.get(eventKey);
          
          if (matchedTitanAmount) {
            titanAmount = matchedTitanAmount;
          } else {
            console.log(`WARNING: No titanX data for create ${stakeIndex} of ${user}`);
          }
          
          return {
            user,
            stakeIndex: stakeIndex.toString(),
            torusAmount: args.torusAmount.toString(),
            titanAmount,
            endTime: args.endTime.toString(),
            timestamp: timestamp.toString(),
            maturityDate,
            blockNumber: event.blockNumber,
            shares: shares.toString(),
            stakingDays,
          };
        }));
      }
      
      // Final summary
      const createsWithTitanX = finalProcessedEvents.filter(c => c.titanAmount !== '0').length;
      console.log(`\n=== FINAL CREATE EVENTS SUMMARY ===`);
      console.log(`Total create events: ${finalProcessedEvents.length}`);
      console.log(`Creates with TitanX data: ${createsWithTitanX}`);
      console.log(`Creates without TitanX data: ${finalProcessedEvents.length - createsWithTitanX}`);
      console.log(`=============================\n`);
      
      // Validate data before caching
      const validation = validateCreateData(finalProcessedEvents);
      if (!validation.isValid) {
        console.log('🚨 DATA VALIDATION FAILED - Review before proceeding');
      }
      
      // Cache the results
      DataCache.set('create_events', finalProcessedEvents, currentBlock);
      DataCache.setLastBlockNumber(currentBlock);
      
      return finalProcessedEvents;
    } catch (error: any) {
      console.error(`❌ CREATE EVENTS ERROR with RPC ${RPC_ENDPOINTS[currentRpcIndex]}:`, error);
      console.error('Full error:', error.message);
      console.error('Stack:', error.stack);
      attempts++;
      
      if (attempts < maxAttempts) {
        console.log(`Trying next RPC endpoint (attempt ${attempts + 1}/${maxAttempts})...`);
        tryNextRpc();
      } else {
        console.error('❌ All RPC endpoints failed for create events');
        console.error('Returning empty array - no creates will be shown');
        return [];
      }
    }
  }
  
  } catch (error: any) {
    console.error('🚨 FATAL ERROR in fetchCreateEvents:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return [];
  }
  
  return [];
};

export const getContractInfo = async () => {
  try {
    const balance = await provider.getBalance(CONTRACTS.TORUS_CREATE_STAKE);
    const code = await provider.getCode(CONTRACTS.TORUS_CREATE_STAKE);
    const blockNumber = await provider.getBlockNumber();
    
    return {
      balance: ethers.utils.formatEther(balance),
      hasCode: code !== '0x',
      currentBlock: blockNumber,
    };
  } catch (error) {
    console.error('Error getting contract info:', error);
    return null;
  }
};

export interface RewardPoolData {
  day: number;
  rewardPool: string;
  totalShares: string;
  penaltiesInPool: string;
}

export const fetchRewardPoolData = async (startDay: number, endDay: number): Promise<RewardPoolData[]> => {
  let attempts = 0;
  const maxAttempts = RPC_ENDPOINTS.length;
  
  while (attempts < maxAttempts) {
    try {
      console.log('Fetching reward pool data...');
      const contract = new ethers.Contract(CONTRACTS.TORUS_CREATE_STAKE, CREATE_STAKE_ABI, provider);
      
      const poolData: RewardPoolData[] = [];
      
      // Batch fetch reward pool data for efficiency
      const promises = [];
      for (let day = startDay; day <= endDay; day++) {
        promises.push(
          Promise.all([
            contract.rewardPool(day),
            contract.totalShares(day),
            contract.penaltiesInRewardPool(day)
          ]).then(([rewardPool, totalShares, penalties]) => ({
            day,
            rewardPool: rewardPool.toString(),
            totalShares: totalShares.toString(),
            penaltiesInPool: penalties.toString()
          }))
        );
      }
      
      const results = await Promise.all(promises);
      poolData.push(...results);
      
      console.log(`Fetched reward pool data for ${poolData.length} days`);
      return poolData;
    } catch (error: any) {
      console.error(`Error fetching reward pool data:`, error.message);
      attempts++;
      
      if (attempts < maxAttempts) {
        tryNextRpc();
      } else {
        console.error('All RPC endpoints failed for reward pool data');
        return [];
      }
    }
  }
  
  return [];
};

export const getCurrentProtocolDay = async (): Promise<number> => {
  try {
    const contract = new ethers.Contract(CONTRACTS.TORUS_CREATE_STAKE, CREATE_STAKE_ABI, provider);
    const currentDay = await contract.getCurrentDayIndex();
    return Number(currentDay);
  } catch (error) {
    console.error('Error getting current protocol day:', error);
    return 0;
  }
};

export const getTorusSupplyData = async (): Promise<{totalSupply: number, burnedSupply: number}> => {
  // Check cache first - supply data doesn't change often
  const cached = DataCache.get<{totalSupply: number, burnedSupply: number}>('supply_data');
  if (cached) {
    console.log(`Using cached supply data: ${cached.totalSupply} total, ${cached.burnedSupply} burned`);
    return cached;
  }
  
  let attempts = 0;
  const maxAttempts = RPC_ENDPOINTS.length;
  let currentRpcIndex = 0;
  
  // TORUS uses address(0) for burning, not the dead address
  const BURN_ADDRESSES = [
    '0x0000000000000000000000000000000000000000'  // address(0) - where TORUS tokens are actually burned
  ];
  
  while (attempts < maxAttempts) {
    try {
      const currentProvider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[currentRpcIndex]);
      const contract = new ethers.Contract(CONTRACTS.TORUS_TOKEN, TORUS_TOKEN_ABI, currentProvider);
      
      console.log(`Fetching TORUS supply data from ${RPC_ENDPOINTS[currentRpcIndex]}...`);
      
      const totalSupply = await contract.totalSupply();
      
      // Calculate burned supply by checking balances of burn addresses
      let burnedSupply = BigInt(0);
      
      for (const burnAddress of BURN_ADDRESSES) {
        try {
          const balance = await contract.balanceOf(burnAddress);
          burnedSupply += BigInt(balance.toString());
          console.log(`Balance at ${burnAddress}: ${parseFloat(balance.toString()) / 1e18} TORUS`);
        } catch (e) {
          console.log(`Could not fetch balance for ${burnAddress}`);
        }
      }
      
      const totalSupplyFormatted = parseFloat(totalSupply.toString()) / 1e18;
      const burnedSupplyFormatted = parseFloat(burnedSupply.toString()) / 1e18;
      
      console.log(`Total Supply: ${totalSupplyFormatted} TORUS`);
      console.log(`Burned Supply: ${burnedSupplyFormatted} TORUS`);
      console.log(`Burn percentage: ${(burnedSupplyFormatted / totalSupplyFormatted * 100).toFixed(4)}%`);
      
      const result = {
        totalSupply: totalSupplyFormatted,
        burnedSupply: burnedSupplyFormatted
      };
      
      // Cache the results
      DataCache.set('supply_data', result);
      
      return result;
    } catch (error: any) {
      console.error(`Error fetching token supply data from ${RPC_ENDPOINTS[currentRpcIndex]}:`, error.message);
      attempts++;
      currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
      
      if (attempts >= maxAttempts) {
        console.error('All RPC endpoints failed for token supply data');
        return { totalSupply: 0, burnedSupply: 0 };
      }
    }
  }
  
  return { totalSupply: 0, burnedSupply: 0 };
};