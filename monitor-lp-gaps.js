#!/usr/bin/env node

const fs = require('fs');
const { ethers } = require('ethers');

console.log('🔍 MONITORING LP FEE COLLECTION GAPS');
console.log('===================================\n');

async function checkForGaps() {
  try {
    // Load current data
    const lpData = JSON.parse(fs.readFileSync('./public/data/buy-process-burns.json', 'utf8'));
    
    // Calculate current protocol day
    const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
    const now = new Date();
    const currentDayUTC = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    currentDayUTC.setUTCHours(18, 0, 0, 0);
    
    if (now.getTime() < currentDayUTC.getTime()) {
      currentDayUTC.setUTCDate(currentDayUTC.getUTCDate() - 1);
    }
    
    const msPerDay = 24 * 60 * 60 * 1000;
    const currentProtocolDay = Math.max(1, Math.floor((currentDayUTC.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1);
    
    // Check for recent collections
    const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
    const COLLECT_TOPIC = ethers.utils.id("Collect(uint256,address,uint256,uint256)");
    
    const recentLogs = await provider.getLogs({
      address: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
      topics: [COLLECT_TOPIC],
      fromBlock: lpData.lastBlock,
      toBlock: 'latest'
    });
    
    // Alert if there are untrackedcollections
    if (recentLogs.length > 0) {
      console.log(`🚨 ALERT: ${recentLogs.length} untracked Collect events detected!`);
      console.log('   Run: node update-lp-fee-burns.js');
      return false;
    }
    
    // Check data freshness
    const lastUpdate = new Date(lpData.lastUpdated);
    const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
    
    if (hoursSinceUpdate > 48) {
      console.log(`⚠️ WARNING: LP fee data is ${hoursSinceUpdate.toFixed(1)} hours old`);
      return false;
    }
    
    console.log(`✅ LP fee tracking is up to date (last updated ${hoursSinceUpdate.toFixed(1)}h ago)`);
    return true;
    
  } catch (e) {
    console.log(`❌ Error checking LP fee gaps: ${e.message}`);
    return false;
  }
}

checkForGaps().then(success => {
  process.exit(success ? 0 : 1);
});
