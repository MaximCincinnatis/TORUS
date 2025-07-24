const { ethers } = require('ethers');
const fs = require('fs');

async function verifyDay12WithBlockchain() {
  console.log('🔍 VERIFYING DAY 12 DATA WITH BLOCKCHAIN...\n');
  
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  const data = JSON.parse(fs.readFileSync('public/data/cached-data.json', 'utf8'));
  
  // Contract setup
  const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';
  
  const createABI = [
    'function userCreates(address user, uint256 index) view returns (uint256 torusAmount, uint256 duration, uint256 timestamp, uint256 titanAmount, uint256 ethAmount, bool claimed)'
  ];
  
  const stakeABI = [
    'function userStakes(address user, uint256 index) view returns (uint256 principal, uint256 shares, uint256 duration, uint256 timestamp, uint256 titanAmount, uint256 ethAmount, uint256 status, uint256 payout)'
  ];
  
  const contract = new ethers.Contract(CREATE_STAKE_CONTRACT, createABI.concat(stakeABI), provider);
  
  // Get Day 12 events
  const DAY_12_START = new Date('2025-07-21T00:00:00Z');
  const DAY_12_END = new Date('2025-07-22T00:00:00Z');
  
  const day12Creates = data.stakingData.createEvents.filter(e => {
    const ts = parseInt(e.timestamp) * 1000;
    return ts >= DAY_12_START.getTime() && ts < DAY_12_END.getTime();
  });
  
  const day12Stakes = data.stakingData.stakeEvents.filter(e => {
    const ts = parseInt(e.timestamp) * 1000;
    return ts >= DAY_12_START.getTime() && ts < DAY_12_END.getTime();
  });
  
  console.log('=== DAY 12 CREATES - BLOCKCHAIN VERIFICATION ===');
  console.log(`Checking ${day12Creates.length} creates...\n`);
  
  let createMismatches = 0;
  let createWithTitanX = 0;
  let createWithETH = 0;
  
  // Check first 10 creates
  for (let i = 0; i < Math.min(10, day12Creates.length); i++) {
    const create = day12Creates[i];
    
    try {
      const onchainData = await contract.userCreates(create.user, create.createId || create.id);
      
      const jsonTitanX = create.titanXAmount || create.titanAmount || '0';
      const jsonETH = create.ethAmount || '0';
      const chainTitanX = onchainData.titanAmount.toString();
      const chainETH = onchainData.ethAmount.toString();
      
      const titanXMatch = jsonTitanX === chainTitanX;
      const ethMatch = jsonETH === chainETH;
      
      if (chainTitanX !== '0') createWithTitanX++;
      if (chainETH !== '0') createWithETH++;
      
      console.log(`Create ${i + 1} (ID: ${create.createId}, User: ${create.user.substring(0, 10)}...):`);
      console.log(`  JSON TitanX: ${jsonTitanX} (${(parseFloat(jsonTitanX) / 1e18).toLocaleString()})`);
      console.log(`  Chain TitanX: ${chainTitanX} (${(parseFloat(chainTitanX) / 1e18).toLocaleString()}) ${titanXMatch ? '✓' : '✗ MISMATCH'}`);
      console.log(`  JSON ETH: ${jsonETH} (${(parseFloat(jsonETH) / 1e18).toFixed(4)})`);
      console.log(`  Chain ETH: ${chainETH} (${(parseFloat(chainETH) / 1e18).toFixed(4)}) ${ethMatch ? '✓' : '✗ MISMATCH'}`);
      
      if (!titanXMatch || !ethMatch) {
        createMismatches++;
        console.log('  ⚠️  DATA MISMATCH DETECTED!');
      }
      console.log('');
      
      await new Promise(resolve => setTimeout(resolve, 200)); // Rate limit
    } catch (e) {
      console.log(`  Error fetching create ${create.createId}: ${e.message}\n`);
    }
  }
  
  console.log(`\nCreate Summary (first 10):`);
  console.log(`  With TitanX: ${createWithTitanX}`);
  console.log(`  With ETH: ${createWithETH}`);
  console.log(`  Mismatches: ${createMismatches}`);
  
  console.log('\n=== DAY 12 STAKES - BLOCKCHAIN VERIFICATION ===');
  console.log(`Checking ${day12Stakes.length} stakes...\n`);
  
  let stakeMismatches = 0;
  let stakeWithTitanX = 0;
  let stakeWithETH = 0;
  let stakeFetchErrors = 0;
  
  for (let i = 0; i < day12Stakes.length; i++) {
    const stake = day12Stakes[i];
    
    try {
      const onchainData = await contract.userStakes(stake.user, stake.id);
      
      const jsonTitanX = stake.rawCostTitanX || '0';
      const jsonETH = stake.rawCostETH || '0';
      const chainTitanX = onchainData.titanAmount.toString();
      const chainETH = onchainData.ethAmount.toString();
      
      const titanXMatch = jsonTitanX === chainTitanX;
      const ethMatch = jsonETH === chainETH;
      
      if (chainTitanX !== '0') stakeWithTitanX++;
      if (chainETH !== '0') stakeWithETH++;
      
      console.log(`Stake ${i + 1} (ID: ${stake.id}, User: ${stake.user.substring(0, 10)}...):`);
      console.log(`  JSON TitanX: ${jsonTitanX} (${(parseFloat(jsonTitanX) / 1e18).toLocaleString()})`);
      console.log(`  Chain TitanX: ${chainTitanX} (${(parseFloat(chainTitanX) / 1e18).toLocaleString()}) ${titanXMatch ? '✓' : '✗ MISMATCH'}`);
      console.log(`  JSON ETH: ${jsonETH} (${(parseFloat(jsonETH) / 1e18).toFixed(4)})`);
      console.log(`  Chain ETH: ${chainETH} (${(parseFloat(chainETH) / 1e18).toFixed(4)}) ${ethMatch ? '✓' : '✗ MISMATCH'}`);
      
      if (!titanXMatch || !ethMatch) {
        stakeMismatches++;
        console.log('  ⚠️  DATA MISMATCH DETECTED!');
        
        // Update the JSON with correct data
        stake.rawCostTitanX = chainTitanX;
        stake.rawCostETH = chainETH;
        stake.costTitanX = chainTitanX;
        stake.costETH = chainETH;
      }
      console.log('');
      
      await new Promise(resolve => setTimeout(resolve, 200)); // Rate limit
    } catch (e) {
      console.log(`  Error fetching stake ${stake.id}: ${e.message}`);
      stakeFetchErrors++;
      
      // Try alternative approach - fetch from event logs
      try {
        console.log('  Trying to fetch from transaction...');
        if (stake.transactionHash) {
          const tx = await provider.getTransaction(stake.transactionHash);
          if (tx) {
            console.log('  Transaction found, but cannot decode payment data from reverted contract calls\n');
          }
        }
      } catch (e2) {
        console.log('  Could not fetch transaction either\n');
      }
    }
  }
  
  console.log(`\nStake Summary:`);
  console.log(`  With TitanX: ${stakeWithTitanX}`);
  console.log(`  With ETH: ${stakeWithETH}`);
  console.log(`  Mismatches: ${stakeMismatches}`);
  console.log(`  Fetch Errors: ${stakeFetchErrors}`);
  
  if (stakeMismatches > 0) {
    console.log('\n💾 Saving corrected data...');
    fs.writeFileSync('public/data/cached-data.json', JSON.stringify(data, null, 2));
    console.log('✅ Data updated with blockchain values');
  }
}

verifyDay12WithBlockchain().catch(console.error);