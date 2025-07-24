#!/usr/bin/env node

/**
 * Find the contract creation transaction
 */

const { ethers } = require('ethers');

const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function findContractCreation() {
  console.log('🔍 Finding contract creation...\n');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
    
    // Get contract code to verify it exists
    const code = await provider.getCode(BUY_PROCESS_CONTRACT);
    if (code === '0x') {
      console.log('Contract does not exist at this address');
      return;
    }
    
    console.log(`Contract exists at ${BUY_PROCESS_CONTRACT}`);
    console.log(`Code size: ${(code.length - 2) / 2} bytes`);
    
    // The contract was deployed around block 22890272
    // Let's check the nonce and find the deployer
    console.log(`\nContract deployed around block 22890272`);
    
    // Alternative: Check early burns
    console.log(`\nLet's trace the discrepancy differently...`);
    console.log(`\nThe 947 TORUS difference could be:`);
    console.log(`1. Initial TORUS sent to the contract that was burned`);
    console.log(`2. TORUS from liquidity operations that got burned`);
    console.log(`3. A initialization value in the contract`);
    
    // Let's check the first transfer to the contract
    console.log(`\nThe first TORUS transfer we found was 20,000 TORUS from 0x0`);
    console.log(`This was likely the initial funding`);
    
    // Theory: The contract might have burned some of this initial funding
    console.log(`\nIf the contract burned part of the initial 20,000 TORUS funding,`);
    console.log(`that could explain the discrepancy.`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findContractCreation().catch(console.error);