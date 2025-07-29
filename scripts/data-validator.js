/**
 * Data Validator for Buy & Process Data
 * Validates data integrity and alerts on issues
 */

const fs = require('fs');
const path = require('path');

class DataValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  // Validate a single day's data
  validateDayData(day) {
    const issues = [];

    // Check required fields
    if (!day.protocolDay || day.protocolDay < 1) {
      issues.push(`Missing or invalid protocol day`);
    }

    // Check for suspicious zero values
    if (day.buyAndBurnCount > 0 && day.torusBurned === 0) {
      issues.push(`Day ${day.protocolDay}: Has ${day.buyAndBurnCount} burns but 0 TORUS burned`);
    }

    if (day.buyAndBurnCount > 0 && day.titanXUsedForBurns === 0) {
      issues.push(`Day ${day.protocolDay}: Has ${day.buyAndBurnCount} burns but 0 TitanX used`);
    }

    if (day.buyAndBuildCount > 0 && day.titanXUsedForBuilds === 0) {
      issues.push(`Day ${day.protocolDay}: Has ${day.buyAndBuildCount} builds but 0 TitanX used for builds`);
    }

    // Check for missing ETH data when it should exist
    if (day.ethUsed > 0 && day.ethUsedForBurns === 0 && day.ethUsedForBuilds === 0) {
      issues.push(`Day ${day.protocolDay}: Has ETH used but not allocated to burns or builds`);
    }

    return issues;
  }

  // Validate the entire dataset
  validateData(data) {
    this.errors = [];
    this.warnings = [];

    if (!data.dailyData || !Array.isArray(data.dailyData)) {
      this.errors.push('Missing or invalid dailyData array');
      return false;
    }

    // Check for missing protocol days
    const protocolDays = new Set(data.dailyData.map(d => d.protocolDay));
    const maxDay = data.currentDay || Math.max(...protocolDays);
    
    for (let day = 1; day <= maxDay; day++) {
      if (!protocolDays.has(day)) {
        this.warnings.push(`Missing data for protocol day ${day}`);
      }
    }

    // Check for duplicate days
    const dayCount = {};
    data.dailyData.forEach(day => {
      dayCount[day.protocolDay] = (dayCount[day.protocolDay] || 0) + 1;
    });
    
    Object.entries(dayCount).forEach(([day, count]) => {
      if (count > 1) {
        this.errors.push(`Duplicate entries for protocol day ${day} (found ${count} times)`);
      }
    });

    // Validate each day
    data.dailyData.forEach(day => {
      const dayIssues = this.validateDayData(day);
      this.warnings.push(...dayIssues);
    });

    // Check date consistency
    data.dailyData.forEach((day, index) => {
      if (index > 0) {
        const prevDay = data.dailyData[index - 1];
        if (day.protocolDay <= prevDay.protocolDay) {
          this.errors.push(`Protocol days not in order: ${prevDay.protocolDay} -> ${day.protocolDay}`);
        }
      }
    });

    return this.errors.length === 0;
  }

  // Generate validation report
  getReport() {
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      timestamp: new Date().toISOString()
    };
  }
}

// Alert system
class AlertSystem {
  static logAlert(message, severity = 'WARNING') {
    const timestamp = new Date().toISOString();
    const alertMessage = `[${timestamp}] ${severity}: ${message}`;
    
    // Log to console with color
    if (severity === 'ERROR') {
      console.error('\x1b[31m%s\x1b[0m', alertMessage);
    } else if (severity === 'WARNING') {
      console.warn('\x1b[33m%s\x1b[0m', alertMessage);
    } else {
      console.log('\x1b[32m%s\x1b[0m', alertMessage);
    }

    // Append to alert log file
    const alertLogPath = path.join(__dirname, '../logs/data-alerts.log');
    const logDir = path.dirname(alertLogPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    fs.appendFileSync(alertLogPath, alertMessage + '\n');
  }

  static sendAlert(report) {
    if (report.errors.length > 0) {
      this.logAlert(`Data validation failed with ${report.errors.length} errors`, 'ERROR');
      report.errors.forEach(error => this.logAlert(error, 'ERROR'));
    }

    if (report.warnings.length > 0) {
      this.logAlert(`Data validation found ${report.warnings.length} warnings`, 'WARNING');
      report.warnings.slice(0, 5).forEach(warning => this.logAlert(warning, 'WARNING'));
      if (report.warnings.length > 5) {
        this.logAlert(`... and ${report.warnings.length - 5} more warnings`, 'WARNING');
      }
    }

    // Save validation report
    const reportPath = path.join(__dirname, '../logs/last-validation.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }
}

// Recovery system
class DataRecovery {
  static fillMissingDays(data) {
    const recovered = [];
    const existingDays = new Set(data.dailyData.map(d => d.protocolDay));
    const maxDay = data.currentDay || Math.max(...existingDays);
    
    for (let day = 1; day <= maxDay; day++) {
      if (!existingDays.has(day)) {
        // Calculate the date for this protocol day
        const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
        const dayStartTime = new Date(CONTRACT_START_DATE.getTime() + (day - 1) * 24 * 60 * 60 * 1000);
        const dateKey = dayStartTime.toISOString().split('T')[0];
        
        const emptyDay = {
          date: dateKey,
          protocolDay: day,
          buyAndBurnCount: 0,
          buyAndBuildCount: 0,
          fractalCount: 0,
          torusBurned: 0,
          titanXUsed: 0,
          ethUsed: 0,
          titanXUsedForBurns: 0,
          ethUsedForBurns: 0,
          titanXUsedForBuilds: 0,
          ethUsedForBuilds: 0,
          torusPurchased: 0,
          fractalTitanX: 0,
          fractalETH: 0
        };
        
        data.dailyData.push(emptyDay);
        recovered.push(day);
        AlertSystem.logAlert(`Recovered missing day ${day} with zero values`, 'INFO');
      }
    }
    
    // Sort by protocol day
    data.dailyData.sort((a, b) => a.protocolDay - b.protocolDay);
    
    return recovered;
  }

  static removeDuplicates(data) {
    const seen = new Map();
    const duplicates = [];
    
    data.dailyData = data.dailyData.filter(day => {
      if (seen.has(day.protocolDay)) {
        duplicates.push(day.protocolDay);
        // Keep the entry with more data
        const existing = seen.get(day.protocolDay);
        const dayTotal = (day.buyAndBurnCount || 0) + (day.buyAndBuildCount || 0);
        const existingTotal = (existing.buyAndBurnCount || 0) + (existing.buyAndBuildCount || 0);
        
        if (dayTotal > existingTotal) {
          seen.set(day.protocolDay, day);
          return true;
        }
        return false;
      }
      seen.set(day.protocolDay, day);
      return true;
    });
    
    if (duplicates.length > 0) {
      AlertSystem.logAlert(`Removed ${duplicates.length} duplicate days: ${duplicates.join(', ')}`, 'WARNING');
    }
    
    return duplicates;
  }

  static async attemptRecovery(data) {
    let recovered = false;
    
    // 1. Remove duplicates
    const duplicatesRemoved = this.removeDuplicates(data);
    if (duplicatesRemoved.length > 0) recovered = true;
    
    // 2. Fill missing days
    const daysRecovered = this.fillMissingDays(data);
    if (daysRecovered.length > 0) recovered = true;
    
    // 3. Fix protocol day consistency
    data.dailyData.forEach((day, index) => {
      // Ensure dates match protocol days
      const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
      const expectedDate = new Date(CONTRACT_START_DATE.getTime() + (day.protocolDay - 1) * 24 * 60 * 60 * 1000);
      const expectedDateStr = expectedDate.toISOString().split('T')[0];
      
      if (day.date !== expectedDateStr) {
        AlertSystem.logAlert(`Fixed date for day ${day.protocolDay}: ${day.date} -> ${expectedDateStr}`, 'INFO');
        day.date = expectedDateStr;
        recovered = true;
      }
    });
    
    return recovered;
  }
}

// Export for use in other scripts
module.exports = {
  DataValidator,
  AlertSystem,
  DataRecovery
};

// Run validation if called directly
if (require.main === module) {
  const dataPath = path.join(__dirname, '../public/data/buy-process-data.json');
  
  if (!fs.existsSync(dataPath)) {
    console.error('Data file not found:', dataPath);
    process.exit(1);
  }
  
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const validator = new DataValidator();
  
  console.log('🔍 Validating buy-process data...\n');
  
  validator.validateData(data);
  const report = validator.getReport();
  
  AlertSystem.sendAlert(report);
  
  if (!report.valid) {
    console.log('\n🔧 Attempting automatic recovery...\n');
    const recovered = DataRecovery.attemptRecovery(data);
    
    if (recovered) {
      // Re-validate after recovery
      validator.validateData(data);
      const newReport = validator.getReport();
      
      if (newReport.valid || newReport.errors.length < report.errors.length) {
        // Save recovered data
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
        AlertSystem.logAlert('Data recovery successful, file updated', 'INFO');
      }
    }
  } else {
    console.log('\n✅ Data validation passed!');
  }
}