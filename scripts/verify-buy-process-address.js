#!/usr/bin/env node

/**
 * Script to verify the correct TorusBuyAndProcess contract address
 * by querying the TORUS token contract
 */

const { ethers } = require('ethers');

// RPC endpoints
const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

// TORUS token contract address
const TORUS_CONTRACT = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';

// Current buy & process address in our code
const CURRENT_BUY_PROCESS = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';

// Simple ABI to read the buyAndProcess address
const TORUS_ABI = [
  {
    "inputs": [],
    "name": "buyAndProcess",
    "outputs": [
      {
        "internalType": "contract ITorusBuyAndProcess",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// ABI to check if contract has recent activity
const BUY_PROCESS_ABI = [
  {
    "inputs": [],
    "name": "totalTorusBurnt",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalEthBurnt",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalTitanXBurnt",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

async function verifyBuyProcessAddress() {
  console.log('🔍 Verifying TorusBuyAndProcess contract address...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    
    // Connect to TORUS token contract
    const torusContract = new ethers.Contract(TORUS_CONTRACT, TORUS_ABI, provider);
    
    // Get the buy and process contract address from the token contract
    console.log('Querying TORUS token contract for buyAndProcess address...');
    const actualBuyProcessAddress = await torusContract.buyAndProcess();
    
    console.log('\n📊 Results:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`TORUS Token Contract:        ${TORUS_CONTRACT}`);
    console.log(`Actual BuyAndProcess:        ${actualBuyProcessAddress}`);
    console.log(`Current in our code:         ${CURRENT_BUY_PROCESS}`);
    console.log(`Match:                       ${actualBuyProcessAddress.toLowerCase() === CURRENT_BUY_PROCESS.toLowerCase() ? '✅ YES' : '❌ NO'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Check activity on the actual contract
    console.log('Checking activity on the actual BuyAndProcess contract...');
    const buyProcessContract = new ethers.Contract(actualBuyProcessAddress, BUY_PROCESS_ABI, provider);
    
    const [totalTorusBurnt, totalEthBurnt, totalTitanXBurnt] = await Promise.all([
      buyProcessContract.totalTorusBurnt(),
      buyProcessContract.totalEthBurnt(),
      buyProcessContract.totalTitanXBurnt()
    ]);
    
    console.log('\n💰 Contract Activity:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total TORUS Burned:    ${ethers.utils.formatEther(totalTorusBurnt)} TORUS`);
    console.log(`Total ETH Burned:      ${ethers.utils.formatEther(totalEthBurnt)} ETH`);
    console.log(`Total TitanX Burned:   ${ethers.utils.formatEther(totalTitanXBurnt)} TitanX`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (actualBuyProcessAddress.toLowerCase() !== CURRENT_BUY_PROCESS.toLowerCase()) {
      console.log('⚠️  WARNING: The address in our code does not match the actual contract!');
      console.log(`   Please update all references from ${CURRENT_BUY_PROCESS}`);
      console.log(`   to ${actualBuyProcessAddress}`);
    } else {
      console.log('✅ The BuyAndProcess address in our code is correct!');
    }
    
  } catch (error) {
    console.error('Error verifying contract:', error);
    process.exit(1);
  }
}

verifyBuyProcessAddress();