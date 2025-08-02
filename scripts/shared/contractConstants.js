/**
 * Shared Contract Constants
 * 
 * Single source of truth for contract addresses, event ABIs, and other constants
 * used across multiple scripts in the TORUS dashboard.
 * 
 * IMPORTANT: All ABIs are verified from Etherscan contracts
 * Last verified: 2025-07-31
 */

// Contract Addresses (checksummed)
const CONTRACT_ADDRESSES = {
  // Main contracts
  TORUS: '0xb47f575807fc5466285e1277ef8acfbb5c6686e8',
  CREATE_STAKE: '0xc7Cc775B21f9Df85E043C7FDd9dAC60af0B69507',
  BUY_PROCESS: '0xaa390a37006e22b5775a34f2147f81ebd6a63641',
  TITANX: '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1',
  
  // Uniswap V3 contracts
  POSITION_MANAGER: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  TORUS_TITANX_POOL: '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F',
  
  // Other contracts
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
};

// Event ABIs - Verified from Etherscan
const EVENT_ABIS = {
  // Create & Stake Contract Events (verified from 0xc7Cc775B21f9Df85E043C7FDd9dAC60af0B69507)
  CREATED: 'event Created(address indexed user, uint256 stakeIndex, uint256 torusAmount, uint256 endTime)',
  STAKED: 'event Staked(address indexed user, uint256 stakeIndex, uint256 principal, uint256 stakingDays, uint256 shares)',
  
  // Buy & Process Contract Events (verified from 0xaa390a37006e22b5775a34f2147f81ebd6a63641)
  // Note: There are multiple versions in use - this is the correct one from the contract
  BUY_AND_BUILD: 'event BuyAndBuild(uint256 indexed tokenAllocated, uint256 indexed torusPurchased, address indexed caller)',
  BUY_AND_BURN: 'event BuyAndBurn(uint256 indexed titanXAmount, uint256 indexed torusBurnt, address indexed caller)',
  
  // Standard ERC20 Events
  TRANSFER: 'event Transfer(address indexed from, address indexed to, uint256 value)',
  
  // Uniswap V3 Position Manager Events
  MINT: 'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
  INCREASE_LIQUIDITY: 'event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  
  // WETH Events
  WETH_DEPOSIT: 'event Deposit(address indexed dst, uint256 wad)'
};

// Event Topics (for filtering)
const EVENT_TOPICS = {
  // Keccak256 hashes of event signatures
  TRANSFER: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  WETH_DEPOSIT: '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c',
  // Created event: Created(address indexed user, uint256 stakeIndex, uint256 torusAmount, uint256 endTime)
  CREATED: '0x99a12a7aefbbb67909c2bee4a5e2ddb98b2183b8ae2a59e5a7db47f53453345d',
  // Staked event: Staked(address indexed user, uint256 stakeIndex, uint256 principal, uint256 stakingDays, uint256 shares)
  STAKED: '0x9cfd25589d1eb8ad71e342a86a8524e83522e3936c0803048c08f6d9ad974f40'
};

// Protocol Constants
const PROTOCOL_CONSTANTS = {
  // Contract deployment date - Protocol Day 1 starts at this time
  CONTRACT_START_DATE: new Date('2025-07-10T18:00:00.000Z'),
  
  // Protocol day changes at 18:00 UTC daily
  PROTOCOL_DAY_START_HOUR: 18,
  
  // Max blocks to query at once (to avoid RPC limits)
  MAX_BLOCK_RANGE: 10000,
  
  // Rate limiting between RPC calls (milliseconds)
  RPC_DELAY: 150
};

// RPC Providers
const RPC_PROVIDERS = [
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
  'https://cloudflare-eth.com',
  'https://eth-mainnet.public.blastapi.io'
];

// Helper function to get protocol day from timestamp
function getProtocolDay(timestamp) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const dateObj = new Date(timestamp * 1000);
  const daysDiff = Math.floor((dateObj.getTime() - PROTOCOL_CONSTANTS.CONTRACT_START_DATE.getTime()) / msPerDay) + 1;
  return Math.max(1, daysDiff);
}

// Helper function to get checksummed address
function getAddress(address) {
  return address.toLowerCase();
}

module.exports = {
  CONTRACT_ADDRESSES,
  EVENT_ABIS,
  EVENT_TOPICS,
  PROTOCOL_CONSTANTS,
  RPC_PROVIDERS,
  getProtocolDay,
  getAddress
};