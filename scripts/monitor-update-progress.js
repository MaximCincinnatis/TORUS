#!/usr/bin/env node

/**
 * Monitor the progress of the full update script
 */

const fs = require('fs');
const path = require('path');

function checkProgress() {
  console.clear();
  console.log('📊 FULL UPDATE PROGRESS MONITOR');
  console.log('================================\n');
  
  // Check if process is running
  const { execSync } = require('child_process');
  try {
    const psResult = execSync('ps aux | grep "node.*update-all-dashboard-data-resumable" | grep -v grep', { encoding: 'utf8' });
    if (psResult.trim()) {
      console.log('✅ Update script is RUNNING\n');
    } else {
      console.log('❌ Update script is NOT RUNNING\n');
    }
  } catch (e) {
    console.log('❌ Update script is NOT RUNNING\n');
  }
  
  // Check log file
  const logPath = path.join(__dirname, '..', 'update-resumable.log');
  if (fs.existsSync(logPath)) {
    const logContent = fs.readFileSync(logPath, 'utf8');
    const lines = logContent.split('\n');
    
    // Find key milestones
    const milestones = {
      connected: false,
      eventsFound: null,
      timestampProgress: null,
      createsProcessed: null,
      stakesProcessed: null,
      currentStage: 'Unknown'
    };
    
    // Parse log for milestones
    lines.forEach(line => {
      if (line.includes('Connected to')) {
        milestones.connected = true;
      }
      if (line.includes('Found') && line.includes('creates and')) {
        const match = line.match(/Found (\d+) creates and (\d+) stakes/);
        if (match) {
          milestones.eventsFound = { creates: match[1], stakes: match[2] };
        }
      }
      if (line.includes('Progress:') && line.includes('/1464')) {
        const match = line.match(/Progress: (\d+)\/(\d+)/);
        if (match) {
          milestones.timestampProgress = {
            current: parseInt(match[1]),
            total: parseInt(match[2]),
            percent: ((parseInt(match[1]) / parseInt(match[2])) * 100).toFixed(1)
          };
        }
      }
      if (line.includes('Processed') && line.includes('creates')) {
        const match = line.match(/Processed (\d+)\/(\d+) creates/);
        if (match) {
          milestones.createsProcessed = {
            current: parseInt(match[1]),
            total: parseInt(match[2]),
            percent: ((parseInt(match[1]) / parseInt(match[2])) * 100).toFixed(1)
          };
        }
      }
      if (line.includes('STAGE')) {
        const match = line.match(/STAGE \d+: (.+)/);
        if (match) {
          milestones.currentStage = match[1];
        }
      }
    });
    
    // Display progress
    console.log(`Current Stage: ${milestones.currentStage}`);
    console.log('');
    
    if (milestones.eventsFound) {
      console.log(`📊 Events Found:`);
      console.log(`   Creates: ${milestones.eventsFound.creates}`);
      console.log(`   Stakes: ${milestones.eventsFound.stakes}`);
      console.log('');
    }
    
    if (milestones.timestampProgress) {
      console.log(`⏱️  Timestamp Fetching:`);
      console.log(`   Progress: ${milestones.timestampProgress.current}/${milestones.timestampProgress.total} (${milestones.timestampProgress.percent}%)`);
      const remaining = milestones.timestampProgress.total - milestones.timestampProgress.current;
      const estimatedMinutes = Math.ceil(remaining * 0.2 / 60); // ~0.2 sec per block
      console.log(`   Estimated time remaining: ~${estimatedMinutes} minutes`);
      console.log('');
    }
    
    if (milestones.createsProcessed) {
      console.log(`💎 Create Events Processing:`);
      console.log(`   Progress: ${milestones.createsProcessed.current}/${milestones.createsProcessed.total} (${milestones.createsProcessed.percent}%)`);
      console.log('');
    }
    
    // Check checkpoint file
    const checkpointPath = path.join(__dirname, '..', 'checkpoint-full-update.json');
    if (fs.existsSync(checkpointPath)) {
      const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
      console.log(`📍 Checkpoint Status:`);
      console.log(`   Stage: ${checkpoint.stage || 'Unknown'}`);
      if (checkpoint.lastUpdate) {
        const lastUpdate = new Date(checkpoint.lastUpdate);
        const minutesAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 60000);
        console.log(`   Last Updated: ${minutesAgo} minutes ago`);
      }
      if (checkpoint.cachedData?.stakingData) {
        console.log(`   Creates in checkpoint: ${checkpoint.cachedData.stakingData.createEvents?.length || 0}`);
        console.log(`   Stakes in checkpoint: ${checkpoint.cachedData.stakingData.stakeEvents?.length || 0}`);
      }
    }
    
    // Show last few log lines
    console.log('\n📄 Recent Log Output:');
    console.log('─'.repeat(50));
    const recentLines = lines.slice(-5).filter(l => l.trim()).join('\n');
    console.log(recentLines);
  }
  
  console.log('\n[Refreshing in 10 seconds... Press Ctrl+C to stop]');
}

// Run check immediately
checkProgress();

// Update every 10 seconds
setInterval(checkProgress, 10000);