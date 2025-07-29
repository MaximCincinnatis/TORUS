#!/usr/bin/env node

/**
 * Monitor update health and alert on issues
 * Run this periodically to check update status
 */

const fs = require('fs');
const path = require('path');
const { AlertSystem } = require('./data-validator');

class UpdateMonitor {
  constructor() {
    this.alertThresholds = {
      updateDelayMinutes: 10, // Alert if no update for 10 minutes
      errorCount: 3,          // Alert if more than 3 errors
      warningCount: 10,       // Alert if more than 10 warnings
      missingDays: 2          // Alert if more than 2 days missing
    };
  }

  checkUpdateRecency() {
    const dataPath = path.join(__dirname, '../public/data/buy-process-data.json');
    
    if (!fs.existsSync(dataPath)) {
      AlertSystem.logAlert('Buy-process data file missing!', 'ERROR');
      return false;
    }
    
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const lastUpdate = new Date(data.lastUpdated);
    const now = new Date();
    const minutesSinceUpdate = (now - lastUpdate) / (1000 * 60);
    
    if (minutesSinceUpdate > this.alertThresholds.updateDelayMinutes) {
      AlertSystem.logAlert(
        `No update for ${minutesSinceUpdate.toFixed(1)} minutes (threshold: ${this.alertThresholds.updateDelayMinutes})`,
        'WARNING'
      );
      return false;
    }
    
    return true;
  }

  checkAlertLog() {
    const alertLogPath = path.join(__dirname, '../logs/data-alerts.log');
    
    if (!fs.existsSync(alertLogPath)) {
      return { errors: 0, warnings: 0 };
    }
    
    const logContent = fs.readFileSync(alertLogPath, 'utf8');
    const lines = logContent.split('\n');
    const recentLines = lines.slice(-100); // Check last 100 entries
    
    let errors = 0;
    let warnings = 0;
    
    recentLines.forEach(line => {
      if (line.includes('ERROR:')) errors++;
      if (line.includes('WARNING:')) warnings++;
    });
    
    if (errors > this.alertThresholds.errorCount) {
      AlertSystem.logAlert(
        `High error count: ${errors} errors in recent logs (threshold: ${this.alertThresholds.errorCount})`,
        'ERROR'
      );
    }
    
    if (warnings > this.alertThresholds.warningCount) {
      AlertSystem.logAlert(
        `High warning count: ${warnings} warnings in recent logs (threshold: ${this.alertThresholds.warningCount})`,
        'WARNING'
      );
    }
    
    return { errors, warnings };
  }

  checkDataIntegrity() {
    const dataPath = path.join(__dirname, '../public/data/buy-process-data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Check for missing days
    const protocolDays = new Set(data.dailyData.map(d => d.protocolDay));
    const maxDay = data.currentDay || Math.max(...protocolDays);
    const missingDays = [];
    
    for (let day = 1; day <= maxDay; day++) {
      if (!protocolDays.has(day)) {
        missingDays.push(day);
      }
    }
    
    if (missingDays.length > this.alertThresholds.missingDays) {
      AlertSystem.logAlert(
        `${missingDays.length} protocol days missing: ${missingDays.join(', ')}`,
        'ERROR'
      );
    }
    
    // Check for zero-value anomalies in recent days
    const recentDays = data.dailyData.slice(-5);
    recentDays.forEach(day => {
      if (day.buyAndBurnCount > 10 && day.torusBurned === 0) {
        AlertSystem.logAlert(
          `Day ${day.protocolDay} has ${day.buyAndBurnCount} burns but 0 TORUS burned - possible data issue`,
          'ERROR'
        );
      }
    });
    
    return { missingDays: missingDays.length, totalDays: maxDay };
  }

  generateReport() {
    console.log('🔍 TORUS Dashboard Update Monitor Report\n');
    console.log('Timestamp:', new Date().toISOString());
    console.log('=' .repeat(50) + '\n');
    
    // Check update recency
    console.log('1. Update Recency Check');
    const isRecent = this.checkUpdateRecency();
    console.log(`   Status: ${isRecent ? '✅ PASS' : '❌ FAIL'}\n`);
    
    // Check alert log
    console.log('2. Alert Log Analysis');
    const { errors, warnings } = this.checkAlertLog();
    console.log(`   Errors: ${errors}`);
    console.log(`   Warnings: ${warnings}`);
    console.log(`   Status: ${errors <= this.alertThresholds.errorCount ? '✅ PASS' : '❌ FAIL'}\n`);
    
    // Check data integrity
    console.log('3. Data Integrity Check');
    const { missingDays, totalDays } = this.checkDataIntegrity();
    console.log(`   Total Days: ${totalDays}`);
    console.log(`   Missing Days: ${missingDays}`);
    console.log(`   Status: ${missingDays <= this.alertThresholds.missingDays ? '✅ PASS' : '❌ FAIL'}\n`);
    
    // Overall health
    const overallHealth = isRecent && 
                         errors <= this.alertThresholds.errorCount && 
                         missingDays <= this.alertThresholds.missingDays;
    
    console.log('=' .repeat(50));
    console.log(`Overall Health: ${overallHealth ? '✅ HEALTHY' : '❌ NEEDS ATTENTION'}`);
    console.log('=' .repeat(50) + '\n');
    
    if (!overallHealth) {
      console.log('⚠️  Action Required: Check logs/data-alerts.log for details');
    }
    
    return overallHealth;
  }
}

// Run monitor if called directly
if (require.main === module) {
  const monitor = new UpdateMonitor();
  const isHealthy = monitor.generateReport();
  
  // Exit with error code if unhealthy
  process.exit(isHealthy ? 0 : 1);
}

module.exports = UpdateMonitor;