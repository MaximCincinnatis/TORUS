/**
 * Stake Events Recovery Script - Using Transaction Hashes
 * 
 * Purpose: Recover 134 stake events using their transaction hashes from the logs
 * 
 * The issue: The ABI had stakeIndex marked as indexed when it's not
 * This script fetches events by transaction hash and decodes with correct ABI
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// RPC providers
const RPC_PROVIDERS = [
  'https://ethereum.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
  'https://eth-mainnet.public.blastapi.io'
];

// Correct ABI - only user is indexed, not stakeIndex
const CORRECT_STAKE_ABI = ['event Staked(address indexed user, uint256 stakeIndex, uint256 principal, uint256 stakingDays, uint256 shares)'];

// Contract address
const CREATE_STAKE_CONTRACT = '0xc7cc775b21f9df85e043c7fdd9dac60af0b69507';

// Get stake transaction hashes from log file
function getStakeTransactionHashes() {
  const logPath = path.join(__dirname, '..', 'resumable-progress-new.log');
  
  if (!fs.existsSync(logPath)) {
    throw new Error('Log file not found!');
  }
  
  const logContent = fs.readFileSync(logPath, 'utf8');
  const txHashRegex = /Skipping stake event that couldn't be decoded: (0x[a-fA-F0-9]{64})/g;
  const txHashes = [];
  
  let match;
  while ((match = txHashRegex.exec(logContent)) !== null) {
    txHashes.push(match[1]);
  }
  
  return txHashes;
}

// Protocol day calculation
function getProtocolDay(timestamp) {
  const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
  const msPerDay = 24 * 60 * 60 * 1000;
  const dateObj = new Date(timestamp * 1000);
  const daysDiff = Math.floor((dateObj.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1;
  return Math.max(1, daysDiff);
}

// Get working provider
async function getWorkingProvider() {
  for (const rpcUrl of RPC_PROVIDERS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      await provider.getBlockNumber();
      console.log(`✅ Connected to ${rpcUrl}`);
      return provider;
    } catch (error) {
      console.log(`❌ Failed to connect to ${rpcUrl}`);
    }
  }
  throw new Error('No working RPC providers found!');
}

// Fetch and decode stake event from transaction
async function fetchStakeEvent(txHash, provider, iface) {
  try {
    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return null;
    }
    
    // Find Staked event in logs
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === CREATE_STAKE_CONTRACT.toLowerCase()) {
        try {
          // Try to decode with correct ABI
          const decoded = iface.parseLog({
            data: log.data,
            topics: log.topics
          });
          
          if (decoded.name === 'Staked') {
            // Get block timestamp
            const block = await provider.getBlock(receipt.blockNumber);
            
            return {
              args: decoded.args,
              blockNumber: receipt.blockNumber,
              transactionHash: txHash,
              timestamp: block.timestamp
            };
          }
        } catch (err) {
          // Continue to next log
        }
      }
    }
    
    return null;
  } catch (error) {
    console.log(`Error fetching ${txHash}: ${error.message}`);
    return null;
  }
}

async function recoverStakeEvents() {
  console.log('🔧 Stake Events Recovery Script (from Transaction Hashes)');
  console.log('========================================================');
  
  try {
    // Step 1: Get transaction hashes from log
    console.log('\n📋 Extracting transaction hashes from log...');
    const txHashes = getStakeTransactionHashes();
    console.log(`✅ Found ${txHashes.length} stake transaction hashes`);
    
    if (txHashes.length === 0) {
      throw new Error('No transaction hashes found in log file!');
    }
    
    // Step 2: Connect to RPC
    console.log('\n🌐 Connecting to RPC provider...');
    const provider = await getWorkingProvider();
    
    // Step 3: Load existing cached data
    console.log('\n📄 Loading cached-data.json...');
    const cachedDataPath = path.join(__dirname, '..', 'public', 'data', 'cached-data.json');
    const cachedData = JSON.parse(fs.readFileSync(cachedDataPath, 'utf8'));
    
    // Create backup
    const backupPath = path.join(__dirname, '..', 'public', 'data', `cached-data-backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(cachedData, null, 2));
    console.log(`✅ Created backup: ${path.basename(backupPath)}`);
    
    // Initialize stake events array
    if (!cachedData.stakingData) {
      cachedData.stakingData = {};
    }
    cachedData.stakingData.stakeEvents = [];
    
    // Step 4: Fetch and decode events
    console.log('\n🔄 Fetching and decoding stake events...');
    const iface = new ethers.utils.Interface(CORRECT_STAKE_ABI);
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < txHashes.length; i++) {
      const txHash = txHashes[i];
      
      if ((i + 1) % 10 === 0) {
        console.log(`  📊 Progress: ${i + 1}/${txHashes.length} (${successCount} decoded)`);
      }
      
      const event = await fetchStakeEvent(txHash, provider, iface);
      
      if (event) {
        // Create stake data object
        const stakeData = {
          user: event.args.user.toLowerCase(),
          stakeIndex: event.args.stakeIndex.toString(),
          principal: event.args.principal.toString(),
          stakingDays: event.args.stakingDays.toString(),
          shares: event.args.shares.toString(),
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          timestamp: event.timestamp.toString(),
          protocolDay: getProtocolDay(event.timestamp),
          // Additional fields for consistency
          titanAmount: event.args.principal.toString(),
          rawCostTitanX: event.args.principal.toString(),
          costTitanX: ethers.utils.formatEther(event.args.principal),
          costETH: "0.0",
          rawCostETH: "0"
        };
        
        cachedData.stakingData.stakeEvents.push(stakeData);
        successCount++;
      } else {
        failCount++;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n📊 Fetching Complete:');
    console.log(`  ✅ Successfully decoded: ${successCount} stake events`);
    console.log(`  ❌ Failed to decode: ${failCount} events`);
    
    // Step 5: Sort events by timestamp
    cachedData.stakingData.stakeEvents.sort((a, b) => 
      parseInt(a.timestamp) - parseInt(b.timestamp)
    );
    
    // Step 6: Update metadata
    cachedData.lastUpdated = new Date().toISOString();
    if (!cachedData.metadata) {
      cachedData.metadata = {};
    }
    cachedData.metadata.stakesRecovered = true;
    cachedData.metadata.stakesRecoveryDate = new Date().toISOString();
    cachedData.metadata.totalStakes = cachedData.stakingData.stakeEvents.length;
    
    // Step 7: Save updated data
    console.log('\n💾 Saving updated cached-data.json...');
    fs.writeFileSync(cachedDataPath, JSON.stringify(cachedData, null, 2));
    console.log('✅ Successfully saved updated data!');
    
    // Step 8: Summary
    console.log('\n📈 Summary:');
    console.log(`  Total stake events recovered: ${cachedData.stakingData.stakeEvents.length}`);
    
    // Show sample of recovered data
    if (cachedData.stakingData.stakeEvents.length > 0) {
      console.log('\n  Sample stake events:');
      for (let i = 0; i < Math.min(3, cachedData.stakingData.stakeEvents.length); i++) {
        const stake = cachedData.stakingData.stakeEvents[i];
        console.log(`\n  Stake ${i + 1}:`);
        console.log(`    User: ${stake.user}`);
        console.log(`    Principal: ${stake.costTitanX} TitanX`);
        console.log(`    Days: ${stake.stakingDays}`);
        console.log(`    Shares: ${ethers.utils.commify(stake.shares)}`);
        console.log(`    Protocol Day: ${stake.protocolDay}`);
      }
    }
    
    console.log('\n✅ Stake events recovery completed successfully!');
    console.log('🎉 Dashboard should now show all stake history from July 10th');
    
  } catch (error) {
    console.error('\n❌ Recovery failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the recovery
recoverStakeEvents();