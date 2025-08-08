#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Color logging
const log = (msg, color = 'white') => {
  const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bright: '\x1b[1m'
  };
  console.log(`${colors[color] || colors.white}${msg}\x1b[0m`);
};

const CACHE_FILE = path.join(__dirname, 'public/data/cached-data.json');
const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');

async function fixStakingDays() {
  try {
    log('🔧 Fixing missing stakingDays in positions...', 'cyan');
    
    // Load cached data
    const cachedData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    
    let fixedStakes = 0;
    let fixedCreates = 0;
    
    // Fix stake events
    if (cachedData.stakingData?.stakeEvents) {
      cachedData.stakingData.stakeEvents.forEach(stake => {
        if (!stake.stakingDays && stake.maturityDate && stake.timestamp) {
          const startTime = parseInt(stake.timestamp) * 1000;
          const maturityTime = new Date(stake.maturityDate).getTime();
          const stakingDays = Math.round((maturityTime - startTime) / (24 * 60 * 60 * 1000));
          stake.stakingDays = stakingDays;
          fixedStakes++;
        }
      });
    }
    
    // Fix create events  
    if (cachedData.stakingData?.createEvents) {
      cachedData.stakingData.createEvents.forEach(create => {
        if (!create.stakingDays && create.maturityDate) {
          // For creates, we need to calculate from endTime or maturityDate
          if (create.endTime) {
            // endTime is the maturity timestamp in seconds
            const endTime = parseInt(create.endTime);
            // For creates, timestamp might be missing or 0, so calculate from protocol day if available
            let startTime;
            if (create.timestamp && create.timestamp !== "0") {
              startTime = parseInt(create.timestamp);
            } else if (create.protocolDay) {
              // Calculate start time from protocol day
              const daysSinceStart = create.protocolDay - 1;
              const startDate = new Date(CONTRACT_START_DATE);
              startDate.setUTCDate(startDate.getUTCDate() + daysSinceStart);
              startTime = Math.floor(startDate.getTime() / 1000);
            } else {
              // Fallback: assume it was created on day 1
              startTime = Math.floor(CONTRACT_START_DATE.getTime() / 1000);
            }
            
            const stakingDays = Math.round((endTime - startTime) / 86400);
            create.stakingDays = stakingDays;
            fixedCreates++;
          } else if (create.maturityDate) {
            // Calculate from maturityDate and assume it was created on the protocol day
            const maturityTime = new Date(create.maturityDate).getTime();
            let startTime;
            if (create.timestamp && create.timestamp !== "0") {
              startTime = parseInt(create.timestamp) * 1000;
            } else if (create.protocolDay) {
              const daysSinceStart = create.protocolDay - 1;
              const startDate = new Date(CONTRACT_START_DATE);
              startDate.setUTCDate(startDate.getUTCDate() + daysSinceStart);
              startTime = startDate.getTime();
            } else {
              startTime = CONTRACT_START_DATE.getTime();
            }
            
            const stakingDays = Math.round((maturityTime - startTime) / (24 * 60 * 60 * 1000));
            create.stakingDays = stakingDays;
            fixedCreates++;
          }
        }
      });
    }
    
    log(`✅ Fixed ${fixedStakes} stake positions`, 'green');
    log(`✅ Fixed ${fixedCreates} create positions`, 'green');
    
    // Verify the fix
    let missingStakes = 0;
    let missingCreates = 0;
    
    cachedData.stakingData?.stakeEvents?.forEach(stake => {
      if (!stake.stakingDays) {
        missingStakes++;
        log(`⚠️ Stake ${stake.id} still missing stakingDays`, 'yellow');
      }
    });
    
    cachedData.stakingData?.createEvents?.forEach(create => {
      if (!create.stakingDays) {
        missingCreates++;
        log(`⚠️ Create ${create.id} still missing stakingDays`, 'yellow');
      }
    });
    
    if (missingStakes > 0 || missingCreates > 0) {
      log(`⚠️ Still have ${missingStakes} stakes and ${missingCreates} creates without stakingDays`, 'yellow');
    } else {
      log('✅ All positions now have stakingDays!', 'green');
    }
    
    // Save the fixed data
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cachedData, null, 2));
    log('💾 Updated cached-data.json saved', 'green');
    
    // Show sample of fixed data
    if (cachedData.stakingData?.createEvents?.length > 0) {
      const sample = cachedData.stakingData.createEvents[0];
      log('\n📊 Sample fixed create event:', 'cyan');
      log(`  ID: ${sample.id}`, 'white');
      log(`  Staking Days: ${sample.stakingDays}`, 'white');
      log(`  Maturity Date: ${sample.maturityDate}`, 'white');
    }
    
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run the fix
fixStakingDays();