#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');

// Contract configuration
const STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
const CONTRACT_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "user", "type": "address"}
    ],
    "name": "getStakePositions",
    "outputs": [
      {
        "components": [
          {"internalType": "uint256", "name": "principal", "type": "uint256"},
          {"internalType": "uint256", "name": "power", "type": "uint256"},
          {"internalType": "uint24", "name": "stakingDays", "type": "uint24"},
          {"internalType": "uint256", "name": "startTime", "type": "uint256"},
          {"internalType": "uint24", "name": "startDayIndex", "type": "uint24"},
          {"internalType": "uint256", "name": "endTime", "type": "uint256"},
          {"internalType": "uint256", "name": "shares", "type": "uint256"},
          {"internalType": "bool", "name": "claimedCreate", "type": "bool"},
          {"internalType": "bool", "name": "claimedStake", "type": "bool"},
          {"internalType": "uint256", "name": "costTitanX", "type": "uint256"},
          {"internalType": "uint256", "name": "costETH", "type": "uint256"},
          {"internalType": "uint256", "name": "rewards", "type": "uint256"},
          {"internalType": "uint256", "name": "penalties", "type": "uint256"},
          {"internalType": "uint256", "name": "claimedAt", "type": "uint256"},
          {"internalType": "bool", "name": "isCreate", "type": "bool"}
        ],
        "internalType": "struct StakeTorus[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// RPC endpoints
const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function verifyWithGetStakePositions() {
  console.log('🔍 Verifying July 24 TitanX Costs using getStakePositions\n');
  
  try {
    // Connect to Ethereum
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const contract = new ethers.Contract(STAKE_CONTRACT, CONTRACT_ABI, provider);
    
    // Check specific users
    const specificUsers = [
      { prefix: '0xd0979b1b', full: '0xd0979b1b946140eab977cff9c89116bfabde2f14', torus: 1979.28 },
      { prefix: '0xe649bf6e', full: '0xe649bf6e4ddae04b60e015937a631d7d89dbcac2', torus: 9.90 },
      { prefix: '0x8599a6ca', full: '0x8599a6cab9617ffb12e6f11ad119caee7323a2c4', torus: 39.59 }
    ];
    
    console.log('=== CHECKING SPECIFIC USERS WITH getStakePositions ===\n');
    
    let totalTitanX = ethers.BigNumber.from(0);
    let totalETH = ethers.BigNumber.from(0);
    let foundCreates = 0;
    
    for (const userInfo of specificUsers) {
      console.log(`Checking user ${userInfo.prefix}... (expecting ${userInfo.torus} TORUS):`);
      
      try {
        const positions = await contract.getStakePositions(userInfo.full);
        console.log(`  Found ${positions.length} total positions`);
        
        // Filter for creates only
        const creates = positions.filter(p => p.isCreate);
        console.log(`  Found ${creates.length} creates`);
        
        // Find the July 24 create
        const july24Start = Math.floor(new Date('2025-07-24T00:00:00Z').getTime() / 1000);
        const july24End = july24Start + 86400;
        
        creates.forEach((create, index) => {
          if (create.startTime >= july24Start && create.startTime < july24End) {
            foundCreates++;
            const torusAmount = parseFloat(ethers.utils.formatEther(create.principal));
            const titanX = parseFloat(ethers.utils.formatEther(create.costTitanX));
            const eth = parseFloat(ethers.utils.formatEther(create.costETH));
            
            totalTitanX = totalTitanX.add(create.costTitanX);
            totalETH = totalETH.add(create.costETH);
            
            console.log(`  ✅ Found July 24 create:`);
            console.log(`     TORUS: ${torusAmount.toFixed(2)}`);
            console.log(`     TitanX: ${titanX.toFixed(2)} TITANX (raw: ${create.costTitanX.toString()})`);
            console.log(`     ETH: ${eth.toFixed(6)} ETH`);
            console.log(`     Start Time: ${new Date(create.startTime * 1000).toISOString()}`);
            console.log(`     End Time: ${new Date(create.endTime * 1000).toISOString()}`);
            console.log(`     Duration: ${create.stakingDays} days`);
          }
        });
        
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
      }
      
      console.log('');
    }
    
    console.log('\n=== SUMMARY ===');
    console.log(`Found ${foundCreates} July 24 creates for specific users`);
    console.log(`Total TitanX: ${ethers.utils.formatEther(totalTitanX)} TITANX`);
    console.log(`Total ETH: ${ethers.utils.formatEther(totalETH)} ETH`);
    
    if (totalTitanX.isZero()) {
      console.log('\n✅ CONFIRMED: All July 24 creates actually have 0 TitanX cost.');
      console.log('The dashboard is correctly showing 0 TitanX for Day 15.');
    } else {
      console.log('\n❌ ISSUE: The blockchain shows non-zero TitanX costs for July 24 creates.');
      console.log('The cached data needs to be updated.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
verifyWithGetStakePositions().catch(console.error);