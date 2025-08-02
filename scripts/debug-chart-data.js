#!/usr/bin/env node

/**
 * Debug script to check what data is available for charts
 */

const fs = require('fs');
const path = require('path');

async function main() {
  console.log('=== DEBUGGING CHART DATA ===\n');
  
  try {
    // Load cached data
    const dataPath = path.join(__dirname, '../public/data/cached-data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    console.log('1. Data Structure Check:');
    console.log('   - Has stakingData:', !!data.stakingData);
    console.log('   - Has createEvents:', !!data.stakingData?.createEvents);
    console.log('   - Has stakeEvents:', !!data.stakingData?.stakeEvents);
    console.log('   - Has rewardPoolData:', !!data.stakingData?.rewardPoolData);
    console.log('');
    
    console.log('2. Data Counts:');
    console.log('   - createEvents:', data.stakingData?.createEvents?.length || 0);
    console.log('   - stakeEvents:', data.stakingData?.stakeEvents?.length || 0);
    console.log('   - rewardPoolData:', data.stakingData?.rewardPoolData?.length || 0);
    console.log('');
    
    console.log('3. Sample Data:');
    if (data.stakingData?.createEvents?.length > 0) {
      console.log('   First create:', {
        user: data.stakingData.createEvents[0].user,
        torusAmount: data.stakingData.createEvents[0].torusAmount,
        maturityDate: data.stakingData.createEvents[0].maturityDate,
        shares: data.stakingData.createEvents[0].shares
      });
    }
    
    if (data.stakingData?.stakeEvents?.length > 0) {
      console.log('   First stake:', {
        user: data.stakingData.stakeEvents[0].user,
        principal: data.stakingData.stakeEvents[0].principal,
        maturityDate: data.stakingData.stakeEvents[0].maturityDate,
        shares: data.stakingData.stakeEvents[0].shares
      });
    }
    
    if (data.stakingData?.rewardPoolData?.length > 0) {
      console.log('   First reward day:', data.stakingData.rewardPoolData[0]);
      console.log('   Last reward day:', data.stakingData.rewardPoolData[data.stakingData.rewardPoolData.length - 1]);
    }
    
    console.log('');
    console.log('4. Frontend Expected Fields:');
    console.log('   - totalSupply:', data.totalSupply || data.stakingData?.totalSupply || 'MISSING');
    console.log('   - currentProtocolDay:', data.currentProtocolDay || data.stakingData?.currentProtocolDay || 'MISSING');
    console.log('   - lastUpdated:', data.lastUpdated || 'MISSING');
    
    // Check for common issues
    console.log('\n5. Common Issues Check:');
    
    // Check if shares are missing
    const createsWithoutShares = data.stakingData?.createEvents?.filter(c => !c.shares).length || 0;
    const stakesWithoutShares = data.stakingData?.stakeEvents?.filter(s => !s.shares).length || 0;
    console.log('   - Creates without shares:', createsWithoutShares);
    console.log('   - Stakes without shares:', stakesWithoutShares);
    
    // Check date formats
    if (data.stakingData?.createEvents?.length > 0) {
      const firstCreate = data.stakingData.createEvents[0];
      console.log('   - maturityDate format:', typeof firstCreate.maturityDate, firstCreate.maturityDate);
      console.log('   - timestamp format:', typeof firstCreate.timestamp, firstCreate.timestamp);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();