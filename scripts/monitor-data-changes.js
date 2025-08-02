#!/usr/bin/env node

/**
 * Monitors for unexpected changes to historical data
 * Run this after each update to detect overwrites
 */

const fs = require('fs');
const path = require('path');

const SNAPSHOT_FILE = './logs/data-snapshot.json';
const ALERTS_FILE = './logs/data-change-alerts.log';

function takeSnapshot() {
  const data = JSON.parse(fs.readFileSync('./public/data/buy-process-data.json', 'utf8'));
  
  // Create snapshot of historical data (days 1-19)
  const snapshot = {
    timestamp: new Date().toISOString(),
    historicalDays: data.dailyData.filter(d => d.protocolDay <= 19).map(d => ({
      protocolDay: d.protocolDay,
      date: d.date,
      buyAndBurnCount: d.buyAndBurnCount,
      buyAndBuildCount: d.buyAndBuildCount,
      torusBurned: d.torusBurned,
      titanXUsed: d.titanXUsed
    }))
  };
  
  // Ensure logs directory exists
  if (!fs.existsSync('./logs')) {
    fs.mkdirSync('./logs');
  }
  
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2));
  console.log('📸 Snapshot saved');
}

function compareWithSnapshot() {
  if (!fs.existsSync(SNAPSHOT_FILE)) {
    console.log('📸 No previous snapshot found. Taking initial snapshot...');
    takeSnapshot();
    return;
  }
  
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
  const currentData = JSON.parse(fs.readFileSync('./public/data/buy-process-data.json', 'utf8'));
  
  const alerts = [];
  
  snapshot.historicalDays.forEach(snapDay => {
    const currentDay = currentData.dailyData.find(d => d.protocolDay === snapDay.protocolDay);
    
    if (!currentDay) {
      alerts.push(`Day ${snapDay.protocolDay} is missing!`);
      return;
    }
    
    // Check for data being zeroed out
    if (snapDay.buyAndBurnCount > 0 && currentDay.buyAndBurnCount === 0) {
      alerts.push(`Day ${snapDay.protocolDay}: Burn count was ${snapDay.buyAndBurnCount}, now 0!`);
    }
    
    if (snapDay.torusBurned > 0 && currentDay.torusBurned === 0) {
      alerts.push(`Day ${snapDay.protocolDay}: TORUS burned was ${snapDay.torusBurned}, now 0!`);
    }
    
    // Check for significant changes (>1% difference)
    if (Math.abs(snapDay.torusBurned - currentDay.torusBurned) > snapDay.torusBurned * 0.01) {
      alerts.push(`Day ${snapDay.protocolDay}: TORUS burned changed from ${snapDay.torusBurned} to ${currentDay.torusBurned}`);
    }
  });
  
  if (alerts.length > 0) {
    const alertMessage = `\n[${new Date().toISOString()}] DATA CHANGE ALERTS:\n${alerts.join('\n')}\n`;
    console.error('⚠️  Historical data changes detected!');
    console.error(alertMessage);
    
    // Log to file
    fs.appendFileSync(ALERTS_FILE, alertMessage);
    
    // Take new snapshot for next comparison
    takeSnapshot();
    process.exit(1);
  } else {
    console.log('✅ No unexpected changes to historical data');
    // Update snapshot with current data
    takeSnapshot();
  }
}

// Main
const command = process.argv[2];

if (command === 'snapshot') {
  takeSnapshot();
} else {
  compareWithSnapshot();
}