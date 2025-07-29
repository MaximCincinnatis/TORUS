#!/usr/bin/env node

/**
 * Fixes protocol days for all stake and create events in cached-data.json
 */

const fs = require('fs');
const path = require('path');

// Contract start date (6 PM UTC - actual protocol start time)
const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');

function getProtocolDay(timestamp) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const eventDate = new Date(parseInt(timestamp) * 1000);
  const protocolDay = Math.floor((eventDate.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1;
  return Math.max(1, protocolDay);
}

function fixProtocolDays() {
  console.log('🔧 Fixing protocol days for stake and create events...\n');
  
  // Load cached data
  const dataPath = path.join(__dirname, 'public/data/cached-data.json');
  const cachedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  
  let stakeFixed = 0;
  let createFixed = 0;
  
  // Fix stake events
  if (cachedData.stakingData && cachedData.stakingData.stakeEvents) {
    cachedData.stakingData.stakeEvents.forEach(event => {
      if (!event.protocolDay || event.protocolDay === 0) {
        event.protocolDay = getProtocolDay(event.timestamp);
        stakeFixed++;
      }
    });
  }
  
  // Fix create events
  if (cachedData.stakingData && cachedData.stakingData.createEvents) {
    cachedData.stakingData.createEvents.forEach(event => {
      if (!event.protocolDay || event.protocolDay === 0) {
        const timestamp = event.timestamp || event.endTime;
        if (timestamp) {
          event.protocolDay = getProtocolDay(timestamp);
          createFixed++;
        }
      }
    });
  }
  
  // Count events by protocol day
  const stakesByDay = {};
  const createsByDay = {};
  
  cachedData.stakingData.stakeEvents.forEach(event => {
    const day = event.protocolDay || 0;
    stakesByDay[day] = (stakesByDay[day] || 0) + 1;
  });
  
  cachedData.stakingData.createEvents.forEach(event => {
    const day = event.protocolDay || 0;
    createsByDay[day] = (createsByDay[day] || 0) + 1;
  });
  
  console.log(`📊 Fixed ${stakeFixed} stake events`);
  console.log(`📊 Fixed ${createFixed} create events`);
  console.log('\n📅 Stakes by protocol day:', stakesByDay);
  console.log('📅 Creates by protocol day:', createsByDay);
  
  // Update last updated timestamp
  cachedData.lastUpdated = new Date().toISOString();
  
  // Save updated data
  fs.writeFileSync(dataPath, JSON.stringify(cachedData, null, 2));
  
  console.log('\n✅ Protocol days fixed successfully!');
}

// Run the fix
fixProtocolDays();