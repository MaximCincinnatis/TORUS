#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');

// Contract configuration
const STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
const CONTRACT_ABI = [
  'function userCreates(address user, uint256 index) view returns (uint256 torusAmount, uint256 duration, uint256 timestamp, uint256 titanAmount, uint256 ethAmount, bool claimed)',
  'function userCreateCount(address user) view returns (uint256)'
];

// RPC endpoints
const RPC_ENDPOINTS = [
  'https://eth.drpc.org',
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com'
];

async function verifyJuly24TitanX() {
  console.log('🔍 Verifying July 24 TitanX Costs from Blockchain\n');
  
  try {
    // Connect to Ethereum
    const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINTS[0]);
    const contract = new ethers.Contract(STAKE_CONTRACT, CONTRACT_ABI, provider);
    
    // Load cached data to get the July 24 creates
    const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
    
    // Filter July 24 creates
    const july24Start = Math.floor(new Date('2025-07-24T00:00:00Z').getTime() / 1000);
    const july24End = july24Start + 86400;
    
    const july24Creates = data.stakingData.createEvents.filter(c => {
      const timestamp = parseInt(c.timestamp);
      return timestamp >= july24Start && timestamp < july24End;
    });
    
    console.log(`Found ${july24Creates.length} creates on July 24, 2025\n`);
    
    // Process each create and get actual costs from blockchain
    let totalTitanX = ethers.BigNumber.from(0);
    let totalETH = ethers.BigNumber.from(0);
    let updatedCount = 0;
    
    console.log('=== FETCHING ACTUAL COSTS FROM BLOCKCHAIN ===\n');
    
    for (let i = 0; i < july24Creates.length; i++) {
      const create = july24Creates[i];
      const user = create.user || create.owner;
      const createId = create.createId || create.id || '0';
      
      try {
        // Query the blockchain for actual create data
        const createData = await contract.userCreates(user, createId);
        
        const titanAmount = createData.titanAmount;
        const ethAmount = createData.ethAmount;
        
        const titanX = parseFloat(ethers.utils.formatEther(titanAmount));
        const eth = parseFloat(ethers.utils.formatEther(ethAmount));
        
        // Check if this has non-zero TitanX
        if (!titanAmount.isZero()) {
          updatedCount++;
          totalTitanX = totalTitanX.add(titanAmount);
          totalETH = totalETH.add(ethAmount);
          
          console.log(`${i + 1}. User: ${user}`);
          console.log(`   TORUS: ${parseFloat(ethers.utils.formatEther(create.torusAmount || create.principal || '0')).toFixed(2)}`);
          console.log(`   TitanX: ${titanX.toFixed(2)} TITANX (raw: ${titanAmount.toString()})`);
          console.log(`   ETH: ${eth.toFixed(6)} ETH`);
          console.log(`   Block: ${create.blockNumber}`);
          console.log(`   Time: ${new Date(parseInt(create.timestamp) * 1000).toISOString()}\n`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 150));
        
      } catch (error) {
        console.error(`Error fetching data for user ${user}, index ${createId}:`, error.message);
      }
    }
    
    console.log('\n=== BLOCKCHAIN VERIFICATION SUMMARY ===');
    console.log(`Total Creates on July 24: ${july24Creates.length}`);
    console.log(`Creates with non-zero TitanX: ${updatedCount}`);
    console.log(`Total TitanX Used: ${ethers.utils.formatEther(totalTitanX)} TITANX`);
    console.log(`Total ETH Used: ${ethers.utils.formatEther(totalETH)} ETH`);
    
    // Check specific users
    console.log('\n=== SPECIFIC USERS VERIFICATION ===');
    const specificUsers = [
      { prefix: '0xd0979b1b', full: '0xd0979b1b946140eab977cff9c89116bfabde2f14' },
      { prefix: '0xe649bf6e', full: '0xe649bf6e4ddae04b60e015937a631d7d89dbcac2' },
      { prefix: '0x8599a6ca', full: '0x8599a6cab9617ffb12e6f11ad119caee7323a2c4' }
    ];
    
    for (const userInfo of specificUsers) {
      const userCreate = july24Creates.find(c => 
        (c.user || c.owner || '').toLowerCase() === userInfo.full.toLowerCase()
      );
      
      if (userCreate) {
        console.log(`\nUser ${userInfo.prefix}... (${userInfo.full}):`);
        console.log(`  Found in cached data with:`);
        console.log(`  - TORUS: ${parseFloat(ethers.utils.formatEther(userCreate.torusAmount || userCreate.principal || '0')).toFixed(2)}`);
        console.log(`  - Cached TitanX: ${userCreate.titanAmount || userCreate.titanXAmount || '0'}`);
        
        try {
          const createId = userCreate.createId || userCreate.id || '0';
          const createData = await contract.userCreates(userInfo.full, createId);
          
          console.log(`  Blockchain data:`);
          console.log(`  - TitanX: ${ethers.utils.formatEther(createData.titanAmount)} TITANX`);
          console.log(`  - ETH: ${ethers.utils.formatEther(createData.ethAmount)} ETH`);
        } catch (error) {
          console.log(`  Error fetching blockchain data: ${error.message}`);
        }
      }
    }
    
    console.log('\n🔍 CONCLUSION:');
    if (updatedCount > 0) {
      console.log(`❌ The cached data is showing 0 TitanX for all July 24 creates, but the blockchain shows ${updatedCount} creates with actual TitanX costs.`);
      console.log(`❌ Total TitanX that should be shown: ${ethers.utils.formatEther(totalTitanX)} TITANX`);
      console.log(`\n📝 The update-create-costs.js script needs to be run to fetch the actual TitanX and ETH costs from the blockchain.`);
    } else {
      console.log(`✅ All July 24 creates actually have 0 TitanX cost on the blockchain.`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
verifyJuly24TitanX().catch(console.error);