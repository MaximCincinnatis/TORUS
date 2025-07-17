#!/usr/bin/env node

/**
 * Find Complete LP Position Data
 * Scans backup files to find the most complete set of LP positions
 */

const fs = require('fs');
const path = require('path');

function scanBackupFiles() {
  console.log('🔍 Scanning backup files for complete LP position data...');
  
  const backupDir = './public/data/backups/';
  const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json'));
  
  let maxPositions = 0;
  let bestFile = '';
  let positionCounts = [];
  
  files.forEach(file => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(backupDir, file), 'utf8'));
      const positionCount = data.lpPositions?.length || 0;
      
      positionCounts.push({
        file,
        count: positionCount,
        lastUpdated: data.lastUpdated
      });
      
      if (positionCount > maxPositions) {
        maxPositions = positionCount;
        bestFile = file;
      }
    } catch (e) {
      console.log(`⚠️  Could not read ${file}: ${e.message}`);
    }
  });
  
  // Sort by position count descending
  positionCounts.sort((a, b) => b.count - a.count);
  
  console.log('\n📊 LP Position Counts by Backup File:');
  positionCounts.slice(0, 10).forEach(item => {
    console.log(`${item.count} positions - ${item.file} (${item.lastUpdated})`);
  });
  
  console.log(`\n🎯 Best file: ${bestFile} with ${maxPositions} positions`);
  
  if (maxPositions > 5) {
    console.log('\n🚨 We are missing positions! Current has 5, found backup with', maxPositions);
    
    // Show the positions in the best file
    const bestData = JSON.parse(fs.readFileSync(path.join(backupDir, bestFile), 'utf8'));
    console.log('\n📋 Positions in best backup file:');
    bestData.lpPositions.forEach(pos => {
      console.log(`  - ${pos.tokenId}: ${pos.owner?.substring(0,10)}... (${pos.liquidity})`);
    });
    
    return bestData.lpPositions;
  } else {
    console.log('\n✅ Current position count matches best backup');
    return null;
  }
}

// Also check blockchain directly for more positions
async function checkBlockchainForPositions() {
  console.log('\n🔍 Checking blockchain for additional positions...');
  
  const { ethers } = require('ethers');
  
  // Working RPC providers
  const RPC_PROVIDERS = [
    'https://eth.drpc.org',
    'https://rpc.payload.de',
    'https://eth-mainnet.public.blastapi.io'
  ];
  
  let provider = null;
  for (const url of RPC_PROVIDERS) {
    try {
      provider = new ethers.providers.JsonRpcProvider(url);
      await provider.getBlockNumber();
      console.log(`✅ Connected to ${url}`);
      break;
    } catch (e) {
      continue;
    }
  }
  
  if (!provider) {
    console.log('❌ No working RPC provider');
    return [];
  }
  
  // Check for more comprehensive Mint events
  const poolAddress = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
  const poolABI = ['event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)'];
  const pool = new ethers.Contract(poolAddress, poolABI, provider);
  
  try {
    const currentBlock = await provider.getBlockNumber();
    const poolCreationBlock = 22890272;
    
    console.log(`📊 Scanning from block ${poolCreationBlock} to ${currentBlock}`);
    
    // Scan larger block ranges to find all mint events
    const mintEvents = await pool.queryFilter(pool.filters.Mint(), poolCreationBlock, currentBlock);
    console.log(`🎯 Found ${mintEvents.length} total Mint events`);
    
    // Extract unique position information
    const positions = new Set();
    mintEvents.forEach(event => {
      positions.add(JSON.stringify({
        owner: event.args.owner,
        tickLower: event.args.tickLower,
        tickUpper: event.args.tickUpper,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash
      }));
    });
    
    console.log(`📋 Unique position patterns: ${positions.size}`);
    
    return Array.from(positions).map(p => JSON.parse(p));
    
  } catch (error) {
    console.log(`❌ Blockchain scan failed: ${error.message}`);
    return [];
  }
}

async function runAnalysis() {
  const backupPositions = scanBackupFiles();
  const blockchainPatterns = await checkBlockchainForPositions();
  
  console.log('\n📊 Analysis Summary:');
  console.log(`Current positions: 5`);
  console.log(`Best backup had: ${backupPositions?.length || 'same'}`);
  console.log(`Mint event patterns: ${blockchainPatterns.length}`);
  
  if (backupPositions && backupPositions.length > 5) {
    console.log('\n🚨 ACTION NEEDED: Restore missing positions from backup');
    return backupPositions;
  }
  
  if (blockchainPatterns.length > 5) {
    console.log('\n🚨 ACTION NEEDED: More positions exist on blockchain than we have cached');
  }
  
  return null;
}

runAnalysis().catch(console.error);