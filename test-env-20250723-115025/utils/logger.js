const fs = require('fs').promises;
const path = require('path');

/**
 * Comprehensive Logger for LP Position Updates
 * 
 * Features:
 * - Multiple log levels (debug, info, warn, error)
 * - File and console output
 * - Structured logging with timestamps
 * - Performance metrics
 * - Audit trail for position changes
 */

class Logger {
  constructor(options = {}) {
    this.logLevel = options.logLevel || 'info';
    this.logToFile = options.logToFile !== false;
    this.logToConsole = options.logToConsole !== false;
    this.logDir = options.logDir || path.join(__dirname, '../logs');
    this.maxLogSize = options.maxLogSize || 10 * 1024 * 1024; // 10MB
    this.performanceMetrics = new Map();
    
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    
    this.colors = {
      debug: '\x1b[36m',  // Cyan
      info: '\x1b[32m',   // Green
      warn: '\x1b[33m',   // Yellow
      error: '\x1b[31m',  // Red
      reset: '\x1b[0m'
    };
  }

  /**
   * Initialize logger (create log directory)
   */
  async initialize() {
    if (this.logToFile) {
      await fs.mkdir(this.logDir, { recursive: true });
      await this.rotateLogsIfNeeded();
    }
  }

  /**
   * Log a message
   */
  async log(level, message, metadata = {}) {
    if (this.levels[level] < this.levels[this.logLevel]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...metadata
    };

    // Console output
    if (this.logToConsole) {
      const color = this.colors[level] || this.colors.reset;
      console.log(`${color}[${timestamp}] [${level.toUpperCase()}] ${message}${this.colors.reset}`);
      if (Object.keys(metadata).length > 0) {
        console.log('  Metadata:', JSON.stringify(metadata, null, 2));
      }
    }

    // File output
    if (this.logToFile) {
      await this.writeToFile(logEntry);
    }
  }

  // Convenience methods
  async debug(message, metadata) {
    await this.log('debug', message, metadata);
  }

  async info(message, metadata) {
    await this.log('info', message, metadata);
  }

  async warn(message, metadata) {
    await this.log('warn', message, metadata);
  }

  async error(message, metadata) {
    await this.log('error', message, metadata);
  }

  /**
   * Log LP position change
   */
  async logPositionChange(tokenId, changes) {
    const changeEntry = {
      type: 'POSITION_CHANGE',
      tokenId,
      changes,
      timestamp: new Date().toISOString()
    };

    await this.info(`Position ${tokenId} changed`, changeEntry);
    
    // Also write to audit log
    await this.writeAuditLog(changeEntry);
  }

  /**
   * Log performance metrics
   */
  startTimer(operation) {
    this.performanceMetrics.set(operation, Date.now());
  }

  async endTimer(operation, metadata = {}) {
    const startTime = this.performanceMetrics.get(operation);
    if (!startTime) {
      await this.warn(`No start time found for operation: ${operation}`);
      return;
    }

    const duration = Date.now() - startTime;
    this.performanceMetrics.delete(operation);

    await this.info(`Performance: ${operation}`, {
      operation,
      duration: `${duration}ms`,
      ...metadata
    });

    return duration;
  }

  /**
   * Log update summary
   */
  async logUpdateSummary(results) {
    const summary = {
      type: 'UPDATE_SUMMARY',
      timestamp: new Date().toISOString(),
      results: {
        updated: results.updated || 0,
        new: results.new || 0,
        closed: results.closed || 0,
        transferred: results.transferred || 0,
        errors: results.errors || []
      }
    };

    await this.info('LP Update Summary', summary);
    
    // Write to daily summary file
    await this.writeDailySummary(summary);
  }

  /**
   * Write to log file
   */
  async writeToFile(logEntry) {
    try {
      const filename = `lp-updates-${new Date().toISOString().split('T')[0]}.log`;
      const filepath = path.join(this.logDir, filename);
      
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(filepath, logLine);
      
      // Check if rotation needed
      await this.rotateLogsIfNeeded();
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  /**
   * Write audit log entry
   */
  async writeAuditLog(entry) {
    try {
      const filename = `audit-${new Date().toISOString().split('T')[0]}.log`;
      const filepath = path.join(this.logDir, 'audit', filename);
      
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      await fs.appendFile(filepath, JSON.stringify(entry) + '\n');
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  /**
   * Write daily summary
   */
  async writeDailySummary(summary) {
    try {
      const filename = `summary-${new Date().toISOString().split('T')[0]}.json`;
      const filepath = path.join(this.logDir, 'summaries', filename);
      
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      
      // Read existing summary if exists
      let dailySummary = { updates: [] };
      try {
        const existing = await fs.readFile(filepath, 'utf8');
        dailySummary = JSON.parse(existing);
      } catch (e) {
        // File doesn't exist yet
      }
      
      dailySummary.updates.push(summary);
      dailySummary.lastUpdated = summary.timestamp;
      
      await fs.writeFile(filepath, JSON.stringify(dailySummary, null, 2));
    } catch (error) {
      console.error('Failed to write daily summary:', error);
    }
  }

  /**
   * Rotate logs if they get too large
   */
  async rotateLogsIfNeeded() {
    try {
      const files = await fs.readdir(this.logDir);
      
      for (const file of files) {
        if (!file.endsWith('.log')) continue;
        
        const filepath = path.join(this.logDir, file);
        const stats = await fs.stat(filepath);
        
        if (stats.size > this.maxLogSize) {
          const rotatedName = file.replace('.log', `-${Date.now()}.log`);
          await fs.rename(filepath, path.join(this.logDir, 'archive', rotatedName));
          await this.info(`Rotated log file: ${file} -> ${rotatedName}`);
        }
      }
    } catch (error) {
      console.error('Failed to rotate logs:', error);
    }
  }

  /**
   * Get recent logs
   */
  async getRecentLogs(minutes = 60) {
    const logs = [];
    const since = new Date(Date.now() - minutes * 60 * 1000);
    
    try {
      const filename = `lp-updates-${new Date().toISOString().split('T')[0]}.log`;
      const filepath = path.join(this.logDir, filename);
      
      const content = await fs.readFile(filepath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (new Date(entry.timestamp) >= since) {
            logs.push(entry);
          }
        } catch (e) {
          // Skip malformed lines
        }
      }
    } catch (error) {
      // File might not exist
    }
    
    return logs;
  }

  /**
   * Get error summary
   */
  async getErrorSummary(days = 7) {
    const errors = [];
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    try {
      const files = await fs.readdir(this.logDir);
      
      for (const file of files) {
        if (!file.startsWith('lp-updates-') || !file.endsWith('.log')) continue;
        
        const fileDate = file.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
        if (!fileDate || new Date(fileDate) < since) continue;
        
        const filepath = path.join(this.logDir, file);
        const content = await fs.readFile(filepath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry.level === 'error') {
              errors.push(entry);
            }
          } catch (e) {
            // Skip malformed lines
          }
        }
      }
    } catch (error) {
      console.error('Failed to get error summary:', error);
    }
    
    return errors;
  }
}

// Singleton instance
let loggerInstance = null;

/**
 * Get logger instance
 */
function getLogger(options) {
  if (!loggerInstance) {
    loggerInstance = new Logger(options);
  }
  return loggerInstance;
}

module.exports = {
  Logger,
  getLogger
};