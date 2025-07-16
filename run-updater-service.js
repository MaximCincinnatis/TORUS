#!/usr/bin/env node

/**
 * TORUS Dashboard Update Service
 * Runs continuously and executes updates every 30 minutes
 * Designed to run as a systemd service or on reboot
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const UPDATE_INTERVAL = 30 * 60 * 1000; // 30 minutes
const SCRIPT_PATH = path.join(__dirname, 'auto-update-fixed.js');

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function runUpdate() {
  log('Running scheduled update...');
  
  exec(`node ${SCRIPT_PATH}`, (error, stdout, stderr) => {
    if (error) {
      log(`Update error: ${error.message}`);
      return;
    }
    if (stderr) {
      log(`Update stderr: ${stderr}`);
    }
    log('Update completed successfully');
  });
}

// Initial startup
log('🚀 TORUS Dashboard Update Service Started');
log(`Update interval: ${UPDATE_INTERVAL / 60000} minutes`);
log(`Working directory: ${__dirname}`);

// Run first update after 1 minute
setTimeout(() => {
  log('Running initial update...');
  runUpdate();
}, 60000);

// Schedule regular updates
setInterval(runUpdate, UPDATE_INTERVAL);

// Handle graceful shutdown
process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Keep the process running
log('Service is running. Updates will execute every 30 minutes.');