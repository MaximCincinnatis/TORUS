import { ethers } from 'ethers';
import { CONTRACTS, CREATE_STAKE_ABI, TORUS_TOKEN_ABI } from '../constants/contracts';
import { DataCache } from './cache';

// List of working RPC endpoints (all public, no API keys)
const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://rpc.payload.de',
  'https://eth-mainnet.public.blastapi.io',
  'https://rpc.flashbots.net',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth'
];

let currentRpcIndex = 0;
let provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[currentRpcIndex]);

// Function to try next RPC endpoint
const tryNextRpc = () => {
  currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
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
  
  
  // Warnings are tracked but not logged in production
  
  return { 
    isValid: totalTitanX < 1e12 && coverage > 50,
    warnings,
    coverage,
    totalTitanX
  };
};

const logFetchMode = (eventType: string, isIncremental: boolean, forceFullRefresh: boolean, fromBlock: number, currentBlock: number, existingCount: number) => {
  
  if (forceFullRefresh) {
  } else if (isIncremental) {
  } else {
  }
  
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
    return cachedEvents;
  }
  
  // Log the update need
  if (needsUpdate && !forceFullRefresh) {
  }
  
  // Force full refresh if requested
  if (forceFullRefresh) {
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
    } else {
      // Cache expired but we know last processed block - fetch from there
      
      // For safety, go back a few blocks in case we missed something
      fromBlock = Math.max(deploymentBlock, lastCachedBlock - 100);
    }
  } else if (lastCachedBlock && lastCachedBlock >= currentBlock) {
    // We're up to date or ahead (shouldn't happen, but handle gracefully)
    return cachedEvents || [];
  } else {
    // No previous record or invalid - do full fetch
  }
  
  let attempts = 0;
  const maxAttempts = RPC_ENDPOINTS.length;
  
  while (attempts < maxAttempts) {
    try {
      const isIncremental = existingEvents.length > 0;
      logFetchMode('STAKE', isIncremental, forceFullRefresh, fromBlock, currentBlock, existingEvents.length);
      const contract = new ethers.Contract(CONTRACTS.TORUS_CREATE_STAKE, CREATE_STAKE_ABI, provider);
      
      const maxBlockRange = 45000; // Stay under 50k limit
      
      
      // Create filter for Staked events
      const filter = contract.filters.Staked();
      
      // Log the event signature we're looking for
      const eventFragment = contract.interface.getEvent('Staked');
      
      // Fetch events in chunks
      const newEvents: any[] = [];
      let currentFromBlock = fromBlock;
      let chunkCount = 0;
      
      while (currentFromBlock <= currentBlock) {
        const toBlock = Math.min(currentFromBlock + maxBlockRange, currentBlock);
        chunkCount++;
        
        try {
          const chunkEvents = await contract.queryFilter(filter, currentFromBlock, toBlock);
          newEvents.push(...chunkEvents);
          
          // Log first event in chunk if any
          if (chunkEvents.length > 0) {
            const firstEvent = chunkEvents[0] as any;
          }
        } catch (chunkError) {
        }
        
        currentFromBlock = toBlock + 1;
      }
      
      // Combine existing cached events with new events
      const allEvents = [...existingEvents, ...newEvents];
      
      
      if (allEvents.length > 0) {
        // Sort events by block number to ensure correct order
        allEvents.sort((a, b) => a.blockNumber - b.blockNumber);
        
        // Log info about new events if any
        if (newEvents.length > 0) {
          newEvents.slice(0, 3).forEach((event, idx) => {
          });
        } else {
        }
      } else {
      }
      
      
      // IMPROVED: Use incremental processing like creates to avoid Date serialization issues
      let finalProcessedEvents: StakeEvent[] = [];
      
      if (existingEvents.length > 0 && newEvents.length > 0) {
        // Incremental mode: preserve existing processed events, only process new events
        
        // Keep existing processed events as-is (they were already processed correctly)
        finalProcessedEvents = [...existingEvents];
        
        // Only process the NEW events
        
        const newProcessedEvents = await Promise.all(newEvents.map(async (event: any, idx: number) => {
        const args = event.args;
        
        // Log raw args for first few events
        if (idx < 3) {
        }
        
        // Get block timestamp since event doesn't include timestamp
        // We MUST fetch block data to get accurate timestamp for maturity calculation
        const blockNumber = event.blockNumber;
        let timestamp;
        
        try {
          const block = await event.getBlock();
          timestamp = block.timestamp;
          if (idx < 3) {
          }
        } catch (err) {
          // If we can't get block timestamp, we can't calculate maturity date accurately
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
        
      } else {
        // Full fetch mode: process all events normally
        
        // Capture provider reference to avoid closure issues
        const currentProvider = provider;
        
        finalProcessedEvents = await Promise.all(allEvents.map(async (event: any, idx: number) => {
        const args = event.args;
        
        // Log raw args for first few events
        if (idx < 3) {
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
            }
          } else {
            timestamp = Math.floor(Date.now() / 1000); // fallback
          }
          
          // Log detailed timestamp info for first few events
          if (idx < 3) {
          }
        } catch (err) {
          // If we can't get block timestamp, we can't calculate maturity date accurately
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
      
      
      // Cache the results
      DataCache.set('stake_events', finalProcessedEvents, currentBlock);
      DataCache.setLastBlockNumber(currentBlock);
      
      return finalProcessedEvents;
    } catch (error: any) {
      attempts++;
      
      if (attempts < maxAttempts) {
        tryNextRpc();
      } else {
        return [];
      }
    }
  }
  
  return [];
};

export const fetchCreateEvents = async (forceFullRefresh: boolean = false): Promise<CreateEvent[]> => {
  
  try {
    // Get current block first
    const currentBlock = await provider.getBlockNumber();
  
  // Check cache with proper block-aware logic
  let lastCachedBlock = DataCache.getLastBlockNumber();
  let cachedEvents = DataCache.get<CreateEvent[]>('create_events', currentBlock);
  
  // Check if we need to fetch new events
  const needsUpdate = !lastCachedBlock || lastCachedBlock < currentBlock;
  
  // If cache is valid, not forcing refresh, and we're already up to date, return cached
  if (cachedEvents && lastCachedBlock && !forceFullRefresh && !needsUpdate && cachedEvents.length > 0) {
    return cachedEvents;
  } else if (cachedEvents && cachedEvents.length === 0 && lastCachedBlock && !forceFullRefresh) {
    forceFullRefresh = true;
  }
  
  // Log the update need
  if (needsUpdate && !forceFullRefresh) {
  }
  
  // Force full refresh if requested
  if (forceFullRefresh) {
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
    
    DataCache.remove('create_events');
    DataCache.remove('stake_events');
    DataCache.remove('last_block_number');
    
    // After clearing, re-read cache values
    lastCachedBlock = DataCache.getLastBlockNumber();
    cachedEvents = DataCache.get<CreateEvent[]>('create_events', currentBlock);
    
  }
  
  // IMPROVED: Use incremental fetch if we have ANY record of last processed block
  // BUT NOT if forcing full refresh
  
  if (!forceFullRefresh && lastCachedBlock && lastCachedBlock >= deploymentBlock && lastCachedBlock < currentBlock) {
    // We have a record of last processed block - do incremental fetch
    fromBlock = lastCachedBlock + 1;
    
    // If we have valid cached events, use them as starting point
    if (cachedEvents) {
      existingEvents = cachedEvents;
    } else {
      // Cache expired but we know last processed block - fetch from there
      
      // For safety, go back a few blocks in case we missed something
      fromBlock = Math.max(deploymentBlock, lastCachedBlock - 100);
    }
  } else if (lastCachedBlock && lastCachedBlock >= currentBlock) {
    // We're up to date or ahead (shouldn't happen, but handle gracefully)
    if (!cachedEvents || cachedEvents.length === 0) {
      // Don't return empty cache - fall through to full fetch
      fromBlock = deploymentBlock;
    } else {
      return cachedEvents;
    }
  } else {
    // No previous record or invalid - do full fetch
  }
  
  let attempts = 0;
  const maxAttempts = RPC_ENDPOINTS.length;
  
  while (attempts < maxAttempts) {
    try {
      const isIncremental = existingEvents.length > 0;
      logFetchMode('CREATE', isIncremental, forceFullRefresh, fromBlock, currentBlock, existingEvents.length);
      
      const contract = new ethers.Contract(CONTRACTS.TORUS_CREATE_STAKE, CREATE_STAKE_ABI, provider);
      
      // Verify contract exists
      const code = await provider.getCode(CONTRACTS.TORUS_CREATE_STAKE);
      
      if (code === '0x' || code === '0x0') {
        throw new Error('Contract not found');
      }
      
      const maxBlockRange = 45000; // Stay under 50k limit
      
      
      // Create filter for Created events
      const filter = contract.filters.Created();
      
      // Double-check we're looking for the right event
      
      // The correct signature for the event with indexed user
      const eventSignature = 'Created(address,uint256,uint256,uint256)';
      const computedHash = ethers.utils.id(eventSignature);
      
      // Fetch events in chunks
      const newEvents: any[] = [];
      let currentFromBlock = fromBlock;
      let totalChunks = 0;
      
      
      while (currentFromBlock <= currentBlock) {
        const toBlock = Math.min(currentFromBlock + maxBlockRange, currentBlock);
        totalChunks++;
        
        try {
          
          const chunkEvents = await contract.queryFilter(filter, currentFromBlock, toBlock);
          
          newEvents.push(...chunkEvents);
          
          if (chunkEvents.length > 0) {
          }
        } catch (chunkError: any) {
          
          // If chunk is too large, try smaller chunks
          if (chunkError.message?.includes('query returned more than') || chunkError.code === 'SERVER_ERROR') {
            const smallerChunkSize = Math.floor(maxBlockRange / 2);
            let retryFromBlock = currentFromBlock;
            
            while (retryFromBlock <= toBlock) {
              const retryToBlock = Math.min(retryFromBlock + smallerChunkSize, toBlock);
              try {
                const retryEvents = await contract.queryFilter(filter, retryFromBlock, retryToBlock);
                newEvents.push(...retryEvents);
              } catch (retryError) {
              }
              retryFromBlock = retryToBlock + 1;
            }
          }
        }
        
        currentFromBlock = toBlock + 1;
      }
      
      
      // Combine existing cached events with new events
      const allEvents = [...existingEvents, ...newEvents].sort((a, b) => a.blockNumber - b.blockNumber);
      
      
      if (newEvents.length > 0) {
        newEvents.slice(0, 3).forEach((event: any, idx: number) => {
        });
      } else {
      }
      
      // CRITICAL FIX: Only process NEW events to avoid data corruption
      let finalProcessedEvents: CreateEvent[] = [];
      
      if (existingEvents.length > 0 && newEvents.length > 0) {
        // Incremental: We have cached events + new events
        
        // Keep existing processed events as-is (they were already processed correctly)
        finalProcessedEvents = [...existingEvents];
        
        // Only process the NEW events
        const eventsToProcess = newEvents;
        
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
      
        // Also create a map to store titanX amounts by user and create event
        const titanXAmountsByEvent = new Map<string, string>();
        
        for (const user of users) {
        try {
          const positions = await contract.getStakePositions(user);
          userStakePositions.set(user, positions);
          
          // Count and log create positions
          const createPositions = positions.filter((p: any) => p.isCreate);
          
          // Debug: log all positions for this user
          if (positions.length > 0) {
            positions.forEach((p: any, idx: number) => {
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
            } else {
            }
          }
          
          if (createPositions.length > 0) {
            const totalTitanX = createPositions.reduce((sum: number, p: any) => {
              return sum + parseFloat(p.costTitanX.toString()) / 1e18;
            }, 0);
          }
        } catch (error) {
          userStakePositions.set(user, []);
        }
        
        // Log summary of matching results for NEW events
        
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
              // Update maturityDate to use contract's endTime
              maturityDate = new Date(contractEndTime * 1000);
            }
            
          }
        } else {
          // Fallback: calculate stakingDays (but this might be inaccurate)
          stakingDays = Math.round((endTime - timestamp) / 86400);
          const torusAmountBN = BigInt(args.torusAmount.toString());
          shares = torusAmountBN * BigInt(stakingDays) * BigInt(stakingDays);
        }
        
        // Get titanAmount from our pre-matched map
        let titanAmount = '0';
        const eventKey = `${user}-${stakeIndex}-${args.endTime.toString()}`;
        const matchedTitanAmount = titanXAmountsByEvent.get(eventKey);
        
        if (matchedTitanAmount) {
          titanAmount = matchedTitanAmount;
        } else {
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
        
        }
      } else {
        // Full fetch mode: process all events normally
        
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
        
        // Also create a map to store titanX amounts by user and create event
        const titanXAmountsByEvent = new Map<string, string>();
        
        for (const user of users) {
          try {
            const positions = await contract.getStakePositions(user);
            userStakePositions.set(user, positions);
            
            // Count and log create positions
            const createPositions = positions.filter((p: any) => p.isCreate);
            
            // Debug: log all positions for this user
            if (positions.length > 0) {
              positions.forEach((p: any, idx: number) => {
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
              } else {
              }
            }
            
            if (createPositions.length > 0) {
              const totalTitanX = createPositions.reduce((sum: number, p: any) => {
                return sum + parseFloat(p.costTitanX.toString()) / 1e18;
              }, 0);
            }
          } catch (error) {
            userStakePositions.set(user, []);
          }
        }

        // Log summary of matching results
        
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
                // Update maturityDate to use contract's endTime
                maturityDate = new Date(contractEndTime * 1000);
              }
              
            }
          } else {
            // Fallback: calculate stakingDays (but this might be inaccurate)
            stakingDays = Math.round((endTime - timestamp) / 86400);
            const torusAmountBN = BigInt(args.torusAmount.toString());
            shares = torusAmountBN * BigInt(stakingDays) * BigInt(stakingDays);
          }
          
          // Get titanAmount from our pre-matched map
          let titanAmount = '0';
          const eventKey = `${user}-${stakeIndex}-${args.endTime.toString()}`;
          const matchedTitanAmount = titanXAmountsByEvent.get(eventKey);
          
          if (matchedTitanAmount) {
            titanAmount = matchedTitanAmount;
          } else {
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
      
      // Validate data before caching
      const validation = validateCreateData(finalProcessedEvents);
      if (!validation.isValid) {
      }
      
      // Cache the results
      DataCache.set('create_events', finalProcessedEvents, currentBlock);
      DataCache.setLastBlockNumber(currentBlock);
      
      return finalProcessedEvents;
    } catch (error: any) {
      attempts++;
      
      if (attempts < maxAttempts) {
        tryNextRpc();
      } else {
        return [];
      }
    }
  }
  
  } catch (error: any) {
    return [];
  }
  
  return [];
};

export const getContractInfo = async () => {
  try {
    const balance = await provider.getBalance(CONTRACTS.TORUS_CREATE_STAKE);
    const code = await provider.getCode(CONTRACTS.TORUS_CREATE_STAKE);
    const blockNumber = await provider.getBlockNumber();
    
    // Get TitanX burned data from contract
    const stakeContract = new ethers.Contract(CONTRACTS.TORUS_CREATE_STAKE, CREATE_STAKE_ABI, provider);
    const totalTitanXBurnt = await stakeContract.totalTitanXBurnt();
    
    // Get TitanX total supply
    const TITANX_ADDRESS = '0xf19308f923582a6f7c465e5ce7a9dc1bec6665b1';
    const titanxContract = new ethers.Contract(TITANX_ADDRESS, TORUS_TOKEN_ABI, provider);
    const titanxTotalSupply = await titanxContract.totalSupply();
    
    return {
      balance: ethers.utils.formatEther(balance),
      hasCode: code !== '0x',
      currentBlock: blockNumber,
      totalTitanXBurnt: totalTitanXBurnt.toString(),
      titanxTotalSupply: titanxTotalSupply.toString(),
    };
  } catch (error) {
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
      
      return poolData;
    } catch (error: any) {
      attempts++;
      
      if (attempts < maxAttempts) {
        tryNextRpc();
      } else {
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
    return 0;
  }
};

export const getTorusSupplyData = async (): Promise<{totalSupply: number, burnedSupply: number}> => {
  // Check cache first - supply data doesn't change often
  const cached = DataCache.get<{totalSupply: number, burnedSupply: number}>('supply_data');
  if (cached) {
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
      
      
      const totalSupply = await contract.totalSupply();
      
      // Calculate burned supply by checking balances of burn addresses
      let burnedSupply = BigInt(0);
      
      for (const burnAddress of BURN_ADDRESSES) {
        try {
          const balance = await contract.balanceOf(burnAddress);
          burnedSupply += BigInt(balance.toString());
        } catch (e) {
        }
      }
      
      const totalSupplyFormatted = parseFloat(totalSupply.toString()) / 1e18;
      const burnedSupplyFormatted = parseFloat(burnedSupply.toString()) / 1e18;
      
      
      const result = {
        totalSupply: totalSupplyFormatted,
        burnedSupply: burnedSupplyFormatted
      };
      
      // Cache the results
      DataCache.set('supply_data', result);
      
      return result;
    } catch (error: any) {
      attempts++;
      currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
      
      if (attempts >= maxAttempts) {
        return { totalSupply: 0, burnedSupply: 0 };
      }
    }
  }
  
  return { totalSupply: 0, burnedSupply: 0 };
};