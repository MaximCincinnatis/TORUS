#!/usr/bin/env node

/**
 * LP Fee Burns Update Script
 * Updates LP fee burn data from the Buy & Process contract
 */

const { ethers } = require('ethers');
const fs = require('fs').promises;
const path = require('path');

const BUY_PROCESS_CONTRACT = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';
const TORUS_TITANX_POOL = '0x7ff1f30F6E7EeC2ff3F0D1b60739115BDF88190F';
const TORUS_TOKEN = '0xb47f575807fc5466285e1277ef8acfbb5c6686e8';
const COLLECT_TOPIC = '0x70935338e69775456a85ddef226c395fb668b63fa0115f5f20610b388e6ca9c0';
const DATA_FILE = './public/data/buy-process-burns.json';

async function updateLPFeeBurns() {
  const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
  
  try {
    // Load existing data
    let existingData = {
      lastUpdated: new Date().toISOString(),
      lastBlock: 0,
      nftPosition: {
        tokenId: 1029195,
        owner: BUY_PROCESS_CONTRACT
      },
      feeDrivenBurns: [],
      totals: {
        feeCollections: 0,
        torusCollected: "0.0",
        torusBurned: "0.0",
        titanxCollected: "0.0",
        averageBurnRate: "0"
      }
    };
    
    try {
      const fileContent = await fs.readFile(DATA_FILE, 'utf8');
      existingData = JSON.parse(fileContent);
    } catch (e) {
      console.log('📝 Creating new LP fee burns data file');
    }
    
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = existingData.lastBlock || 22700000;
    
    console.log(`🔍 Searching for LP fee collections from block ${fromBlock} to ${currentBlock}`);
    
    // Search for new fee collections
    const newCollects = [];
    const chunkSize = 10000;
    
    for (let block = fromBlock + 1; block <= currentBlock; block += chunkSize) {
      const toBlock = Math.min(block + chunkSize - 1, currentBlock);
      
      try {
        const logs = await provider.getLogs({
          address: TORUS_TITANX_POOL,
          topics: [COLLECT_TOPIC],
          fromBlock: block,
          toBlock: toBlock
        });
        
        for (const log of logs) {
          const types = ['address', 'uint256', 'uint256'];
          const decoded = ethers.utils.defaultAbiCoder.decode(types, log.data);
          const recipient = decoded[0];
          
          if (recipient.toLowerCase() === BUY_PROCESS_CONTRACT.toLowerCase()) {
            const blockData = await provider.getBlock(log.blockNumber);
            const receipt = await provider.getTransactionReceipt(log.transactionHash);
            
            // Look for TORUS burn in same transaction
            const burnLogs = receipt.logs.filter(l => 
              l.address.toLowerCase() === TORUS_TOKEN.toLowerCase() &&
              l.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' &&
              l.topics[1] === ethers.utils.hexZeroPad(BUY_PROCESS_CONTRACT.toLowerCase(), 32) &&
              l.topics[2] === '0x0000000000000000000000000000000000000000000000000000000000000000'
            );
            
            const burnAmount = burnLogs.length > 0 ? ethers.BigNumber.from(burnLogs[0].data) : ethers.BigNumber.from(0);
            
            newCollects.push({
              blockNumber: log.blockNumber,
              timestamp: blockData.timestamp,
              date: new Date(blockData.timestamp * 1000).toISOString(),
              transactionHash: log.transactionHash,
              torusCollected: ethers.utils.formatEther(decoded[1]),
              titanxCollected: ethers.utils.formatEther(decoded[2]),
              torusBurned: ethers.utils.formatEther(burnAmount),
              burnPercentage: decoded[1].gt(0) ? (burnAmount.mul(10000).div(decoded[1]).toNumber() / 100).toFixed(2) : "0"
            });
            
            console.log(`✅ Found LP fee collection at block ${log.blockNumber}`);
          }
        }
      } catch (e) {
        console.log(`⚠️ Error in block range ${block}-${toBlock}: ${e.message}`);
      }
    }
    
    // Merge with existing data
    const allBurns = [...existingData.feeDrivenBurns, ...newCollects];
    
    // Recalculate totals
    let totalTorusCollected = ethers.BigNumber.from(0);
    let totalTorusBurned = ethers.BigNumber.from(0);
    let totalTitanxCollected = ethers.BigNumber.from(0);
    
    for (const burn of allBurns) {
      totalTorusCollected = totalTorusCollected.add(ethers.utils.parseEther(burn.torusCollected));
      totalTorusBurned = totalTorusBurned.add(ethers.utils.parseEther(burn.torusBurned));
      totalTitanxCollected = totalTitanxCollected.add(ethers.utils.parseEther(burn.titanxCollected));
    }
    
    const updatedData = {
      lastUpdated: new Date().toISOString(),
      lastBlock: currentBlock,
      nftPosition: existingData.nftPosition,
      feeDrivenBurns: allBurns,
      totals: {
        feeCollections: allBurns.length,
        torusCollected: ethers.utils.formatEther(totalTorusCollected),
        torusBurned: ethers.utils.formatEther(totalTorusBurned),
        titanxCollected: ethers.utils.formatEther(totalTitanxCollected),
        averageBurnRate: totalTorusCollected.gt(0) ? 
          (totalTorusBurned.mul(10000).div(totalTorusCollected).toNumber() / 100).toFixed(2) : '0'
      }
    };
    
    // Save updated data
    await fs.writeFile(DATA_FILE, JSON.stringify(updatedData, null, 2));
    
    console.log(`\n📊 Update Summary:`);
    console.log(`- New fee collections: ${newCollects.length}`);
    console.log(`- Total fee collections: ${allBurns.length}`);
    console.log(`- Total TORUS burned from fees: ${updatedData.totals.torusBurned}`);
    console.log(`- Average burn rate: ${updatedData.totals.averageBurnRate}%`);
    
  } catch (error) {
    console.error('❌ Error updating LP fee burns:', error.message);
    process.exit(1);
  }
}

// Run the update
updateLPFeeBurns().catch(console.error);