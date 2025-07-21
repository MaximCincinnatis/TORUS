#!/usr/bin/env node

/**
 * Data Health Monitor
 * Checks for missing or stale data and alerts when issues are found
 * Run this periodically to ensure data integrity
 */

const fs = require('fs');
const path = require('path');

const WARNINGS = [];
const ERRORS = [];

function log(message, type = 'info') {
  const prefix = {
    info: '📊',
    warn: '⚠️ ',
    error: '❌',
    success: '✅'
  }[type] || '📊';
  
  console.log(`${prefix} ${message}`);
  
  if (type === 'warn') WARNINGS.push(message);
  if (type === 'error') ERRORS.push(message);
}

async function checkDataHealth() {
  console.log('🏥 TORUS Dashboard Data Health Check');
  console.log('=====================================\n');
  
  try {
    // Load cached data
    const dataPath = path.join(__dirname, '../public/data/cached-data.json');
    if (!fs.existsSync(dataPath)) {
      log('cached-data.json not found!', 'error');
      return;
    }
    
    const cachedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // 1. Check last update time
    console.log('1️⃣  Checking data freshness...');
    const lastUpdated = new Date(cachedData.lastUpdated);
    const hoursSinceUpdate = (Date.now() - lastUpdated) / (1000 * 60 * 60);
    
    if (hoursSinceUpdate > 1) {
      log(`Data is ${hoursSinceUpdate.toFixed(1)} hours old (last updated: ${lastUpdated.toISOString()})`, 'warn');
    } else {
      log(`Data is fresh (updated ${hoursSinceUpdate.toFixed(1)} hours ago)`, 'success');
    }
    
    // 2. Check event counts
    console.log('\n2️⃣  Checking event counts...');
    const stakes = cachedData.stakingData?.stakeEvents || [];
    const creates = cachedData.stakingData?.createEvents || [];
    
    log(`Stakes: ${stakes.length}`, 'info');
    log(`Creates: ${creates.length}`, 'info');
    
    if (creates.length < 100) {
      log('Very few creates found - might be missing data', 'warn');
    }
    
    // 3. Check for gaps in create data
    console.log('\n3️⃣  Checking for data gaps...');
    const sortedCreates = [...creates].sort((a, b) => a.timestamp - b.timestamp);
    
    let maxGapHours = 0;
    let gapStart = null;
    let gapEnd = null;
    
    for (let i = 1; i < sortedCreates.length; i++) {
      const gap = (sortedCreates[i].timestamp - sortedCreates[i-1].timestamp) / 3600;
      if (gap > maxGapHours) {
        maxGapHours = gap;
        gapStart = new Date(sortedCreates[i-1].timestamp * 1000);
        gapEnd = new Date(sortedCreates[i].timestamp * 1000);
      }
    }
    
    if (maxGapHours > 24) {
      log(`Largest gap: ${maxGapHours.toFixed(1)} hours between ${gapStart.toISOString()} and ${gapEnd.toISOString()}`, 'warn');
    } else {
      log(`No significant gaps found (largest: ${maxGapHours.toFixed(1)} hours)`, 'success');
    }
    
    // 4. Check recent activity
    console.log('\n4️⃣  Checking recent activity...');
    const now = Date.now() / 1000;
    const recentCreates = creates.filter(c => now - c.timestamp < 24 * 3600).length;
    const recentStakes = stakes.filter(s => now - s.timestamp < 24 * 3600).length;
    
    log(`Creates in last 24h: ${recentCreates}`, recentCreates === 0 ? 'warn' : 'info');
    log(`Stakes in last 24h: ${recentStakes}`, recentStakes === 0 ? 'warn' : 'info');
    
    // 5. Check for creates ending after day 94
    console.log('\n5️⃣  Checking future creates distribution...');
    const contractStart = new Date('2025-07-11T00:00:00Z');
    const day94Date = new Date(contractStart);
    day94Date.setDate(day94Date.getDate() + 93);
    
    const createsAfterDay94 = creates.filter(c => new Date(c.maturityDate) >= day94Date).length;
    log(`Creates ending after day 94: ${createsAfterDay94}`, createsAfterDay94 < 10 ? 'warn' : 'info');
    
    // 6. Check LP positions
    console.log('\n6️⃣  Checking LP positions...');
    const lpPositions = cachedData.lpPositions || [];
    const positionsWithZeroAmounts = lpPositions.filter(p => 
      parseFloat(p.torusAmount || 0) === 0 && parseFloat(p.titanxAmount || 0) === 0
    ).length;
    
    log(`Total LP positions: ${lpPositions.length}`, 'info');
    if (positionsWithZeroAmounts > 0) {
      log(`Positions with zero amounts: ${positionsWithZeroAmounts}`, 'warn');
    }
    
    // 7. Check reward pool data
    console.log('\n7️⃣  Checking reward pool data...');
    const rewardPoolData = cachedData.stakingData?.rewardPoolData || [];
    const daysWithRewards = rewardPoolData.filter(d => parseFloat(d.rewardPool) > 0).length;
    
    log(`Days with reward data: ${rewardPoolData.length}`, 'info');
    log(`Days with non-zero rewards: ${daysWithRewards}`, daysWithRewards < 88 ? 'warn' : 'info');
    
    // Summary
    console.log('\n📋 SUMMARY');
    console.log('==========');
    
    if (ERRORS.length > 0) {
      console.log('\n❌ ERRORS:');
      ERRORS.forEach(e => console.log(`   - ${e}`));
    }
    
    if (WARNINGS.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      WARNINGS.forEach(w => console.log(`   - ${w}`));
    }
    
    if (ERRORS.length === 0 && WARNINGS.length === 0) {
      console.log('\n✅ All checks passed! Data appears healthy.');
    }
    
    // Return exit code based on health
    process.exit(ERRORS.length > 0 ? 1 : 0);
    
  } catch (error) {
    log(`Error running health check: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the health check
checkDataHealth().catch(console.error);