#!/usr/bin/env node

/**
 * LP Update Monitoring Dashboard
 * 
 * Provides real-time monitoring of LP position updates
 * Shows recent logs, errors, and performance metrics
 */

const { getLogger } = require('../utils/logger');
const { calculatePositionStats } = require('../utils/lpPositionStates');
const fs = require('fs').promises;
const path = require('path');

const CACHE_FILE = path.join(__dirname, '../data/cached-data.json');

/**
 * Display monitoring dashboard
 */
async function showDashboard() {
  console.clear();
  console.log('LP Position Update Monitor');
  console.log('='.repeat(50));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('='.repeat(50));

  const logger = getLogger();

  try {
    // Get recent logs
    const recentLogs = await logger.getRecentLogs(60); // Last hour
    
    // Get error summary
    const errors = await logger.getErrorSummary(1); // Last day
    
    // Load current data
    const data = JSON.parse(await fs.readFile(CACHE_FILE, 'utf8'));
    const stats = calculatePositionStats(data.lpPositions || []);

    // Display position statistics
    console.log('\n📊 Position Statistics:');
    console.log(`Total Positions: ${stats.total}`);
    console.log('By Status:');
    Object.entries(stats.byStatus).forEach(([status, count]) => {
      const emoji = getStatusEmoji(status);
      console.log(`  ${emoji} ${status}: ${count}`);
    });
    
    if (stats.recentlyClosed > 0) {
      console.log(`\nRecently Closed (7d): ${stats.recentlyClosed}`);
    }
    if (stats.recentlyCreated > 0) {
      console.log(`Recently Created (7d): ${stats.recentlyCreated}`);
    }

    // Display recent activity
    console.log('\n📈 Recent Activity (Last Hour):');
    const updateLogs = recentLogs.filter(log => log.message.includes('LP Update Summary'));
    
    if (updateLogs.length > 0) {
      console.log(`Updates Run: ${updateLogs.length}`);
      
      // Aggregate stats
      let totalUpdated = 0, totalNew = 0, totalClosed = 0;
      updateLogs.forEach(log => {
        if (log.results) {
          totalUpdated += log.results.updated || 0;
          totalNew += log.results.new || 0;
          totalClosed += log.results.closed || 0;
        }
      });
      
      console.log(`Positions Updated: ${totalUpdated}`);
      console.log(`New Positions: ${totalNew}`);
      console.log(`Positions Closed: ${totalClosed}`);
    } else {
      console.log('No updates in the last hour');
    }

    // Display performance metrics
    console.log('\n⚡ Performance Metrics:');
    const perfLogs = recentLogs.filter(log => log.message.startsWith('Performance:'));
    
    if (perfLogs.length > 0) {
      const metrics = {};
      perfLogs.forEach(log => {
        const operation = log.operation;
        if (!metrics[operation]) {
          metrics[operation] = [];
        }
        const duration = parseInt(log.duration);
        if (!isNaN(duration)) {
          metrics[operation].push(duration);
        }
      });

      Object.entries(metrics).forEach(([operation, durations]) => {
        const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
        const max = Math.max(...durations);
        console.log(`  ${operation}: avg ${avg.toFixed(0)}ms, max ${max}ms`);
      });
    }

    // Display errors
    if (errors.length > 0) {
      console.log('\n❌ Recent Errors:');
      const errorSummary = {};
      errors.forEach(error => {
        const key = error.message.split(':')[0];
        errorSummary[key] = (errorSummary[key] || 0) + 1;
      });
      
      Object.entries(errorSummary).forEach(([error, count]) => {
        console.log(`  ${error}: ${count} occurrences`);
      });
      
      // Show last error details
      const lastError = errors[errors.length - 1];
      console.log('\nLast Error:');
      console.log(`  Time: ${lastError.timestamp}`);
      console.log(`  Message: ${lastError.message}`);
      if (lastError.tokenId) {
        console.log(`  Token ID: ${lastError.tokenId}`);
      }
    } else {
      console.log('\n✅ No errors in the last 24 hours');
    }

    // Display state transitions
    const transitionLogs = recentLogs.filter(log => log.type === 'POSITION_CHANGE');
    if (transitionLogs.length > 0) {
      console.log('\n🔄 Recent State Changes:');
      transitionLogs.slice(-5).forEach(log => {
        console.log(`  Position ${log.tokenId}: ${log.changes.previousStatus} → ${log.changes.newStatus}`);
      });
    }

  } catch (error) {
    console.error('Failed to load monitoring data:', error.message);
  }
}

/**
 * Get emoji for status
 */
function getStatusEmoji(status) {
  const emojis = {
    active: '✅',
    inactive: '😴',
    closed: '🔒',
    transferred: '➡️',
    new: '🆕',
    unknown: '❓'
  };
  return emojis[status] || '•';
}

/**
 * Watch mode - refresh every 30 seconds
 */
async function watchMode() {
  // Initialize logger
  const logger = getLogger();
  await logger.initialize();

  console.log('Starting monitor in watch mode (refresh every 30s)...');
  console.log('Press Ctrl+C to exit\n');

  // Initial display
  await showDashboard();

  // Refresh periodically
  setInterval(async () => {
    await showDashboard();
  }, 30000);
}

/**
 * Generate report
 */
async function generateReport() {
  const logger = getLogger();
  await logger.initialize();

  console.log('Generating LP Update Report...');
  console.log('='.repeat(50));

  const errors = await logger.getErrorSummary(7); // Last week
  const recentLogs = await logger.getRecentLogs(24 * 60); // Last day

  const report = {
    generated: new Date().toISOString(),
    period: {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString()
    },
    summary: {
      totalUpdates: recentLogs.filter(log => log.message.includes('LP Update Summary')).length,
      totalErrors: errors.length,
      errorTypes: {}
    },
    performance: {},
    stateChanges: []
  };

  // Analyze errors
  errors.forEach(error => {
    const type = error.message.split(':')[0];
    report.summary.errorTypes[type] = (report.summary.errorTypes[type] || 0) + 1;
  });

  // Analyze performance
  const perfLogs = recentLogs.filter(log => log.message.startsWith('Performance:'));
  perfLogs.forEach(log => {
    if (!report.performance[log.operation]) {
      report.performance[log.operation] = {
        count: 0,
        totalDuration: 0,
        maxDuration: 0
      };
    }
    const duration = parseInt(log.duration);
    if (!isNaN(duration)) {
      report.performance[log.operation].count++;
      report.performance[log.operation].totalDuration += duration;
      report.performance[log.operation].maxDuration = Math.max(
        report.performance[log.operation].maxDuration,
        duration
      );
    }
  });

  // Calculate averages
  Object.entries(report.performance).forEach(([op, stats]) => {
    stats.avgDuration = stats.count > 0 ? stats.totalDuration / stats.count : 0;
  });

  // Save report
  const reportFile = path.join(__dirname, '../logs', `lp-report-${new Date().toISOString().split('T')[0]}.json`);
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
  
  console.log(`\n✅ Report saved to: ${reportFile}`);
  
  // Display summary
  console.log('\nReport Summary:');
  console.log(`Total Updates: ${report.summary.totalUpdates}`);
  console.log(`Total Errors: ${report.summary.totalErrors}`);
  
  if (Object.keys(report.summary.errorTypes).length > 0) {
    console.log('\nError Types:');
    Object.entries(report.summary.errorTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  }
  
  console.log('\nPerformance Summary:');
  Object.entries(report.performance).forEach(([op, stats]) => {
    console.log(`  ${op}: avg ${stats.avgDuration.toFixed(0)}ms (${stats.count} calls)`);
  });
}

// CLI handling
const command = process.argv[2];

if (command === 'watch') {
  watchMode().catch(console.error);
} else if (command === 'report') {
  generateReport().catch(console.error);
} else {
  showDashboard()
    .then(() => {
      console.log('\nUsage:');
      console.log('  node monitor-lp-updates.js         - Show current status');
      console.log('  node monitor-lp-updates.js watch   - Watch mode (refresh every 30s)');
      console.log('  node monitor-lp-updates.js report  - Generate weekly report');
    })
    .catch(console.error);
}