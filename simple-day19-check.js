#!/usr/bin/env node

/**
 * Simple Day 19 Creates Check
 * Use the known Day 19 create users from JSON to verify on blockchain
 */

const { ethers } = require('ethers');

// Known Day 19 users from JSON
const DAY19_USERS = [
  '0x7ed0eb8d78212877a715e23d3333d2f74b453bd1',
  '0x31df898ae0b6d76b3b1ebc6f8e86e2e82ee6cb94',
  '0x5dad16301ccf329985bcfb604c7ec6a9f121f9fe'
];

// RPC endpoints
const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.payload.de',
  'https://eth-mainnet.public.blastapi.io'
];

async function getWorkingProvider() {
  for (const rpc of RPC_ENDPOINTS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpc);
      await provider.getBlockNumber();
      console.log(`✅ Connected to ${rpc}`);
      return provider;
    } catch (e) {
      console.log(`❌ Failed ${rpc}`);
    }
  }
  throw new Error('No working RPC');
}

async function checkDay19Creates() {
  console.log('🔍 Simple Day 19 Creates Check\n');
  
  const provider = await getWorkingProvider();
  const STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  // Contract ABI for userCreates
  const abi = [
    'function userCreates(address user, uint256 index) view returns (uint256 torusAmount, uint256 principal, uint256 timestamp, uint256 endTime, uint256 blockNumber)',
    'function userCreateCount(address user) view returns (uint256)'
  ];
  
  const contract = new ethers.Contract(STAKE_CONTRACT, abi, provider);
  
  // Day 19 timestamps
  const day19Start = 1753725600; // July 28, 2025 6:00 PM UTC
  const day19End = 1753811999;   // July 29, 2025 5:59:59 PM UTC
  
  console.log(`📅 Day 19: ${new Date(day19Start * 1000).toISOString()} to ${new Date(day19End * 1000).toISOString()}\n`);
  
  const day19Creates = [];
  
  // Check each known user
  for (const userAddress of DAY19_USERS) {
    console.log(`\nChecking user: ${userAddress}`);
    
    try {
      const createCount = await contract.userCreateCount(userAddress);
      console.log(`  Total creates: ${createCount}`);
      
      // Check each create
      for (let i = 0; i < createCount; i++) {
        try {
          const create = await contract.userCreates(userAddress, i);
          const timestamp = Number(create.timestamp);
          
          if (timestamp >= day19Start && timestamp <= day19End) {
            day19Creates.push({
              user: userAddress,
              index: i,
              timestamp,
              date: new Date(timestamp * 1000).toISOString(),
              principal: ethers.utils.formatEther(create.principal),
              blockNumber: Number(create.blockNumber)
            });
            
            console.log(`  ✅ Found Day 19 create #${i}: ${(parseFloat(ethers.utils.formatEther(create.principal)) / 1e9).toFixed(2)}B TORUS`);
          }
        } catch (e) {
          // Create doesn't exist at this index
        }
      }
    } catch (e) {
      console.log(`  ❌ Error: ${e.message}`);
    }
  }
  
  // Summary
  console.log('\n📊 DAY 19 CREATES SUMMARY:');
  console.log(`Found ${day19Creates.length} creates on Day 19\n`);
  
  if (day19Creates.length > 0) {
    console.log('Details:');
    day19Creates.forEach((create, i) => {
      console.log(`${i + 1}. ${create.user}`);
      console.log(`   Amount: ${(parseFloat(create.principal) / 1e9).toFixed(2)}B TORUS`);
      console.log(`   Time: ${create.date}`);
      console.log(`   Block: ${create.blockNumber}\n`);
    });
  }
  
  // Verification
  const expectedCreates = 5;
  if (day19Creates.length === expectedCreates) {
    console.log(`✅ CONFIRMED: Found ${day19Creates.length} creates, matching expected ${expectedCreates}`);
  } else {
    console.log(`⚠️ Found ${day19Creates.length} creates, expected ${expectedCreates}`);
  }
}

checkDay19Creates().catch(console.error);