#!/usr/bin/env node

/**
 * Debug script to check what the frontend expects vs what we have
 */

const fs = require('fs');
const path = require('path');

async function main() {
  console.log('=== DEBUGGING FRONTEND DATA EXPECTATIONS ===\n');
  
  try {
    // Load cached data
    const dataPath = path.join(__dirname, '../public/data/cached-data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    console.log('1. Data at stakingData level:');
    console.log('   - createEvents:', data.stakingData?.createEvents?.length || 0);
    console.log('   - stakeEvents:', data.stakingData?.stakeEvents?.length || 0);
    console.log('   - rewardPoolData:', data.stakingData?.rewardPoolData?.length || 0);
    console.log('');
    
    console.log('2. Frontend expects (from cacheDataLoader.ts):');
    console.log('   - stakeEvents (converted dates)');
    console.log('   - createEvents (converted dates)');
    console.log('   - rewardPoolData');
    console.log('');
    
    console.log('3. Check date conversion:');
    if (data.stakingData?.createEvents?.length > 0) {
      const firstCreate = data.stakingData.createEvents[0];
      console.log('   First create maturityDate:', firstCreate.maturityDate);
      console.log('   Type:', typeof firstCreate.maturityDate);
      console.log('   Is valid ISO date:', !isNaN(Date.parse(firstCreate.maturityDate)));
    }
    
    console.log('');
    console.log('4. Check required fields for charts:');
    if (data.stakingData?.createEvents?.length > 0) {
      const sampleCreate = data.stakingData.createEvents[0];
      console.log('   Sample create has:');
      console.log('     - user:', !!sampleCreate.user);
      console.log('     - torusAmount:', !!sampleCreate.torusAmount);
      console.log('     - timestamp:', !!sampleCreate.timestamp);
      console.log('     - endTime:', !!sampleCreate.endTime);
      console.log('     - maturityDate:', !!sampleCreate.maturityDate);
      console.log('     - shares:', !!sampleCreate.shares);
      console.log('     - protocolDay:', !!sampleCreate.protocolDay);
    }
    
    console.log('');
    console.log('5. Check if data would pass the condition:');
    const loading = false; // Assume loading is false
    const stakeDataLength = data.stakingData?.stakeEvents?.length || 0;
    const createDataLength = data.stakingData?.createEvents?.length || 0;
    
    const condition = loading || (stakeDataLength === 0 && createDataLength === 0);
    console.log(`   loading: ${loading}`);
    console.log(`   stakeData.length: ${stakeDataLength}`);
    console.log(`   createData.length: ${createDataLength}`);
    console.log(`   Condition result: ${condition}`);
    console.log(`   Charts would show: ${condition ? 'EMPTY ARRAYS' : 'DATA'}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();