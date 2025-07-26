/**
 * RPC Utility Functions for Performance Optimization
 * 
 * Features:
 * - Timeout and retry logic
 * - Batch RPC calls
 * - Silent failure handling
 * - RPC success rate monitoring
 */

const { ethers } = require('ethers');

// Configuration
const RPC_TIMEOUT = 5000; // 5 seconds
const MAX_RETRIES = 2;
const BATCH_SIZE = 10;
const BATCH_DELAY = 100; // 100ms between batches

// Monitoring
let rpcStats = {
  totalCalls: 0,
  successfulCalls: 0,
  failedCalls: 0,
  timeouts: 0,
  startTime: Date.now()
};

function log(message, color = 'reset') {
  const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m'
  };
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${colors[color]}${message}${colors.reset}`);
}

/**
 * Enhanced RPC call with timeout and retry logic
 */
async function callWithRetry(contractCall, description = 'RPC call', silent = false) {
  rpcStats.totalCalls++;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await Promise.race([
        contractCall(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), RPC_TIMEOUT)
        )
      ]);
      
      rpcStats.successfulCalls++;
      return { success: true, data: result };
      
    } catch (error) {
      if (error.message === 'Timeout') {
        rpcStats.timeouts++;
      }
      
      if (attempt === MAX_RETRIES) {
        rpcStats.failedCalls++;
        if (!silent) {
          log(`Failed ${description} after ${MAX_RETRIES} attempts: ${error.message}`, 'yellow');
        }
        return { success: false, error: error.message };
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, attempt * 500));
    }
  }
}

/**
 * Batch multiple RPC calls with rate limiting
 */
async function batchRpcCalls(calls, silent = false) {
  const results = [];
  
  for (let i = 0; i < calls.length; i += BATCH_SIZE) {
    const batch = calls.slice(i, i + BATCH_SIZE);
    
    // Process batch in parallel
    const batchPromises = batch.map(async (call) => {
      return await callWithRetry(call.fn, call.description, silent);
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Rate limiting - wait between batches
    if (i + BATCH_SIZE < calls.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }
  
  return results;
}

/**
 * Fetch user stake data with optimized error handling
 */
async function fetchUserStakeData(contract, user, stakeIndex, silent = true) {
  return await callWithRetry(
    () => contract.userStakes(user, stakeIndex),
    `stake data for ${user}:${stakeIndex}`,
    silent
  );
}

/**
 * Fetch user create data with optimized error handling
 */
async function fetchUserCreateData(contract, user, createIndex, silent = true) {
  return await callWithRetry(
    () => contract.userCreates(user, createIndex),
    `create data for ${user}:${createIndex}`,
    silent
  );
}

/**
 * Fetch block data with caching and error handling
 */
async function fetchBlockData(provider, blockNumbers, silent = false) {
  const blockTimestamps = new Map();
  
  // Create batch calls for block data
  const blockCalls = blockNumbers.map(blockNumber => ({
    fn: () => provider.getBlock(blockNumber),
    description: `block ${blockNumber}`
  }));
  
  const results = await batchRpcCalls(blockCalls, silent);
  
  // Process results
  blockNumbers.forEach((blockNumber, index) => {
    const result = results[index];
    if (result.success) {
      blockTimestamps.set(blockNumber, result.data.timestamp);
    } else {
      // Use current timestamp as fallback
      blockTimestamps.set(blockNumber, Math.floor(Date.now() / 1000));
      if (!silent) {
        log(`Using current timestamp for block ${blockNumber}`, 'yellow');
      }
    }
  });
  
  return blockTimestamps;
}

/**
 * Get RPC performance statistics
 */
function getRpcStats() {
  const runtime = Date.now() - rpcStats.startTime;
  const successRate = rpcStats.totalCalls > 0 ? 
    (rpcStats.successfulCalls / rpcStats.totalCalls * 100).toFixed(2) : '0.00';
  
  return {
    ...rpcStats,
    runtime: Math.round(runtime / 1000), // seconds
    successRate: `${successRate}%`,
    callsPerSecond: rpcStats.totalCalls / (runtime / 1000)
  };
}

/**
 * Log RPC performance summary
 */
function logRpcStats() {
  const stats = getRpcStats();
  log(`📊 RPC Performance Summary:`, 'cyan');
  log(`   Total calls: ${stats.totalCalls}`, 'cyan');
  log(`   Successful: ${stats.successfulCalls} (${stats.successRate})`, 'green');
  log(`   Failed: ${stats.failedCalls}`, 'red');
  log(`   Timeouts: ${stats.timeouts}`, 'yellow');
  log(`   Runtime: ${stats.runtime}s`, 'cyan');
  log(`   Calls/sec: ${stats.callsPerSecond.toFixed(2)}`, 'cyan');
}

/**
 * Reset RPC statistics
 */
function resetRpcStats() {
  rpcStats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    timeouts: 0,
    startTime: Date.now()
  };
}

module.exports = {
  callWithRetry,
  batchRpcCalls,
  fetchUserStakeData,
  fetchUserCreateData,
  fetchBlockData,
  getRpcStats,
  logRpcStats,
  resetRpcStats
};