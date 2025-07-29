#!/usr/bin/env node

/**
 * Monitor script for eth fetching progress
 */

const fs = require('fs');

function checkProgress() {
  console.log('\n=== ETH Fetch Progress Monitor ===');
  console.log(new Date().toISOString());
  
  // Check if process is running
  const { execSync } = require('child_process');
  try {
    const processes = execSync('ps aux | grep fetch-all-eth-values | grep -v grep', { encoding: 'utf8' });
    if (processes.trim()) {
      console.log('✅ Script is running');
    } else {
      console.log('❌ Script is not running');
      return;
    }
  } catch (e) {
    console.log('❌ Script is not running');
    return;
  }
  
  // Check log file
  try {
    const log = fs.readFileSync('eth-fetch.log', 'utf8');
    const lines = log.split('\n');
    
    // Find latest progress
    let latestProgress = null;
    let latestChunk = null;
    let foundEvents = 0;
    
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      
      if (line.includes('📊 Progress:') && !latestProgress) {
        latestProgress = line;
      }
      
      if (line.includes('/5883] Block') && !latestChunk) {
        latestChunk = line;
      }
      
      if (line.includes('Found') && line.includes('events')) {
        const match = line.match(/Found (\d+) events/);
        if (match) {
          foundEvents += parseInt(match[1]);
        }
      }
      
      if (latestProgress && latestChunk) break;
    }
    
    console.log('\n📊 Latest Status:');
    if (latestProgress) {
      console.log(latestProgress);
    }
    if (latestChunk) {
      console.log(latestChunk);
    }
    
    console.log(`\n📈 Events found so far: ${foundEvents}`);
    
    // Check for temp files
    if (fs.existsSync('temp-eth-progress.json')) {
      try {
        const progress = JSON.parse(fs.readFileSync('temp-eth-progress.json', 'utf8'));
        console.log(`\n💾 Temp file shows: ${progress.eventsProcessed}/${progress.totalEvents} events processed`);
        console.log(`   Total ETH so far: ${progress.totalETH} ETH`);
      } catch (e) {
        console.log('\n⚠️  Temp file exists but cannot be read');
      }
    }
    
    if (fs.existsSync('temp-buyandbuildevents.json')) {
      try {
        const events = JSON.parse(fs.readFileSync('temp-buyandbuildevents.json', 'utf8'));
        console.log(`\n📋 Found ${events.length} total BuyAndBuild events`);
      } catch (e) {
        console.log('\n⚠️  Events file exists but cannot be read');
      }
    }
    
  } catch (e) {
    console.log('❌ Cannot read log file');
  }
  
  console.log('\n=====================================\n');
}

// Check progress every 30 seconds
setInterval(checkProgress, 30000);

// Initial check
checkProgress();