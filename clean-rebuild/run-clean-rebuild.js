#!/usr/bin/env node

/**
 * Clean Data Rebuild Master Script
 * 
 * Purpose: Rebuild all data from scratch in correct order
 * This runs all scripts with proper data paths
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, 'data');
const SCRIPTS_DIR = path.join(__dirname, 'scripts');
const LOG_FILE = path.join(__dirname, 'logs', 'rebuild.log');

// Helper function to log with timestamp
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// Helper function to run script
function runScript(scriptName, description) {
  log(`Starting: ${description}`);
  try {
    // Change to project root for script execution
    process.chdir(path.join(__dirname, '..'));
    
    // Set environment to use our clean data directory
    process.env.DATA_DIR = DATA_DIR;
    
    const scriptPath = path.join(SCRIPTS_DIR, scriptName);
    log(`Running: node ${scriptPath}`);
    
    // Execute script
    execSync(`node ${scriptPath}`, { 
      stdio: 'inherit',
      env: { ...process.env, DATA_DIR: DATA_DIR }
    });
    
    log(`✓ Completed: ${description}`, 'success');
    return true;
  } catch (error) {
    log(`✗ Failed: ${description} - ${error.message}`, 'error');
    return false;
  }
}

// Main execution
async function main() {
  log('=== STARTING CLEAN DATA REBUILD ===');
  log(`Data directory: ${DATA_DIR}`);
  log(`Scripts directory: ${SCRIPTS_DIR}`);
  
  // Step 1: Update all dashboard data (main blockchain fetch)
  if (!runScript('update-all-dashboard-data.js', 'Full blockchain data fetch')) {
    log('Critical failure in main data fetch. Aborting.', 'error');
    process.exit(1);
  }
  
  // Wait a moment for file writes to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Step 2: Run comprehensive payment matching
  runScript('comprehensive-payment-matching.js', 'Match TitanX payments to creates');
  
  // Step 3: Update buy & process data
  runScript('update-buy-process-data.js', 'Fetch buy & burn/build events');
  
  // Step 4: Run creates/stakes incremental to ensure latest
  runScript('update-creates-stakes-incremental.js', 'Update latest creates/stakes');
  
  log('=== REBUILD COMPLETE ===');
  
  // Show summary
  const cachedData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cached-data.json')));
  const buyProcessData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'buy-process-data.json')));
  
  log('\n=== DATA SUMMARY ===');
  log(`Total creates: ${cachedData.stakingData?.createEvents?.length || 0}`);
  log(`Total stakes: ${cachedData.stakingData?.stakeEvents?.length || 0}`);
  log(`Current protocol day: ${cachedData.currentProtocolDay}`);
  log(`Buy & burn events: ${buyProcessData.eventCounts?.buyAndBurn || 0}`);
  log(`Buy & build events: ${buyProcessData.eventCounts?.buyAndBuild || 0}`);
  
  // Check Day 21 data
  const day21Creates = cachedData.stakingData?.createEvents?.filter(c => c.protocolDay === 21) || [];
  const day21Stakes = cachedData.stakingData?.stakeEvents?.filter(s => s.protocolDay === 21) || [];
  
  log('\n=== DAY 21 CHECK ===');
  log(`Day 21 creates: ${day21Creates.length}`);
  log(`Day 21 stakes: ${day21Stakes.length}`);
  
  if (day21Creates.length > 0) {
    const titanXCreates = day21Creates.filter(c => c.titanAmount && c.titanAmount !== '0');
    log(`Day 21 creates with TitanX: ${titanXCreates.length}`);
  }
}

// Run the rebuild
main().catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  process.exit(1);
});