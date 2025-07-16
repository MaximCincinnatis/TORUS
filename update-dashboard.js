#!/usr/bin/env node

/**
 * TORUS Dashboard Update CLI
 * 
 * Simple command-line interface for updating dashboard data.
 * Maintains clear separation between data updates and frontend code.
 */

const DataUpdater = require('./scripts/data-updates/update-dashboard-data');

console.log('🚀 TORUS Dashboard Update CLI');
console.log('============================');
console.log('');
console.log('This script will:');
console.log('• Create a backup of current data');
console.log('• Extract fresh blockchain data from multiple RPC providers');
console.log('• Calculate accurate ETH and TitanX costs');
console.log('• Update the dashboard JSON with complete data');
console.log('• Maintain frontend incremental update capability');
console.log('');

const updater = new DataUpdater();
updater.run();