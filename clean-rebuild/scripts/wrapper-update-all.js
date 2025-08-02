#!/usr/bin/env node

/**
 * Wrapper for update-all-dashboard-data.js
 * Redirects output to clean-rebuild/data/
 */

const path = require('path');
const fs = require('fs');

// Override the data paths
const CLEAN_DATA_DIR = path.join(__dirname, '..', 'data');

// Backup original fs functions
const originalWriteFileSync = fs.writeFileSync;
const originalReadFileSync = fs.readFileSync;

// Override fs.writeFileSync to redirect clean-rebuild/data writes
fs.writeFileSync = function(filePath, ...args) {
  if (filePath.includes('clean-rebuild/data/') && filePath.endsWith('.json')) {
    const fileName = path.basename(filePath);
    const newPath = path.join(CLEAN_DATA_DIR, fileName);
    console.log(`Redirecting write from ${filePath} to ${newPath}`);
    return originalWriteFileSync.call(fs, newPath, ...args);
  }
  return originalWriteFileSync.call(fs, filePath, ...args);
};

// Override fs.readFileSync to redirect clean-rebuild/data reads
fs.readFileSync = function(filePath, ...args) {
  if (filePath.includes('clean-rebuild/data/') && filePath.endsWith('.json')) {
    const fileName = path.basename(filePath);
    const newPath = path.join(CLEAN_DATA_DIR, fileName);
    if (fs.existsSync(newPath)) {
      console.log(`Redirecting read from ${filePath} to ${newPath}`);
      return originalReadFileSync.call(fs, newPath, ...args);
    }
  }
  return originalReadFileSync.call(fs, filePath, ...args);
};

// Now load and run the original script
console.log('=== Running update-all-dashboard-data.js with clean data ===');
require('./update-all-dashboard-data.js');