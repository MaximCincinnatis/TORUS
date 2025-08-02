/**
 * Migration Example: How to Update Scripts to Use Shared Constants
 * 
 * This file shows before/after examples of updating scripts to use
 * the shared contractConstants.js file.
 */

// ============================================
// BEFORE: Hardcoded values in each script
// ============================================

// OLD WAY - DON'T DO THIS:
/*
const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
const abi = [
  'event Created(address indexed user, uint256 indexed stakeIndex, uint256 torusAmount, uint256 endTime)',
  'event Staked(address indexed user, uint256 indexed stakeIndex, uint256 principal, uint256 stakingDays, uint256 shares)'
];

// Hardcoded protocol day calculation
function getProtocolDay(timestamp) {
  const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
  const msPerDay = 24 * 60 * 60 * 1000;
  const dateObj = new Date(timestamp * 1000);
  const daysDiff = Math.floor((dateObj.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1;
  return Math.max(1, daysDiff);
}
*/

// ============================================
// AFTER: Using shared constants
// ============================================

// NEW WAY - DO THIS:
const { 
  CONTRACT_ADDRESSES, 
  EVENT_ABIS, 
  getProtocolDay,
  getAddress 
} = require('./contractConstants');

// Use constants instead of hardcoding
const contractAddress = CONTRACT_ADDRESSES.CREATE_STAKE;
const abi = [
  EVENT_ABIS.CREATED,
  EVENT_ABIS.STAKED
];

// Use shared helper functions
const protocolDay = getProtocolDay(timestamp);

// ============================================
// Full Example: Updated Script Section
// ============================================

const { ethers } = require('ethers');
const { 
  CONTRACT_ADDRESSES, 
  EVENT_ABIS,
  RPC_PROVIDERS,
  PROTOCOL_CONSTANTS,
  getProtocolDay 
} = require('./shared/contractConstants');

async function updateCreatesStakes() {
  // Use shared RPC providers
  const provider = new ethers.providers.JsonRpcProvider(RPC_PROVIDERS[0]);
  
  // Use shared contract address
  const contract = new ethers.Contract(
    CONTRACT_ADDRESSES.CREATE_STAKE,
    [EVENT_ABIS.CREATED, EVENT_ABIS.STAKED],
    provider
  );
  
  // Process events
  const events = await contract.queryFilter(
    contract.filters.Created(),
    startBlock,
    endBlock
  );
  
  // Use shared protocol day calculation
  for (const event of events) {
    const block = await provider.getBlock(event.blockNumber);
    const protocolDay = getProtocolDay(block.timestamp);
    // ... process event
  }
}

// ============================================
// Benefits of This Approach
// ============================================

/*
1. SINGLE SOURCE OF TRUTH
   - Fix ABI in one place, fixed everywhere
   - No more copy-paste errors
   
2. CONSISTENCY
   - All scripts use same addresses and ABIs
   - Protocol day calculation is always the same
   
3. MAINTAINABILITY
   - Easy to update when contracts change
   - Clear what values are being used
   
4. TYPE SAFETY
   - Can add TypeScript definitions later
   - IDE autocomplete for constants
*/

module.exports = {
  // This file is just an example
};