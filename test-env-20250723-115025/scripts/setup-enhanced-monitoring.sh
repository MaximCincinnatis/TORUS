#!/bin/bash

# Setup Enhanced Monitoring for LP Tracking
# 
# This script sets up monitoring for the enhanced LP tracking system
# including automated reports, alerts, and dashboards

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Setting up Enhanced LP Monitoring${NC}"
echo "=================================="

# Create monitoring directories
mkdir -p logs/{daily,audit,summaries,archive}
mkdir -p monitoring/{dashboards,alerts,reports}

# Create monitoring cron jobs
echo "Adding monitoring cron jobs..."

# Get current crontab
CURRENT_CRON=$(crontab -l 2>/dev/null || echo "")

# Add monitoring jobs if not already present
MONITOR_JOBS=(
    # Generate hourly status report
    "0 * * * * cd $(pwd) && node scripts/monitor-lp-updates.js > monitoring/dashboards/lp-status-$(date +\%H).txt 2>&1"
    
    # Daily summary report
    "0 2 * * * cd $(pwd) && node scripts/monitor-lp-updates.js report > monitoring/reports/daily-$(date +\%Y\%m\%d).txt 2>&1"
    
    # Weekly detailed report
    "0 3 * * 0 cd $(pwd) && node scripts/monitor-lp-updates.js report > monitoring/reports/weekly-$(date +\%Y\%m\%d).txt 2>&1"
    
    # Data validation check (twice daily)
    "0 6,18 * * * cd $(pwd) && node scripts/validate-lp-data.js check > logs/validation-$(date +\%Y\%m\%d-\%H).log 2>&1"
    
    # Archive old logs (daily at 3 AM)
    "0 3 * * * cd $(pwd) && find logs -name '*.log' -mtime +7 -exec mv {} logs/archive/ \;"
    
    # Clean very old archives (weekly)
    "0 4 * * 0 cd $(pwd) && find logs/archive -name '*.log' -mtime +30 -delete"
)

for job in "${MONITOR_JOBS[@]}"; do
    if ! echo "$CURRENT_CRON" | grep -Fq "$job"; then
        (crontab -l 2>/dev/null; echo "$job") | crontab -
        echo -e "${GREEN}✓${NC} Added: $job"
    else
        echo -e "${YELLOW}⚠${NC} Already exists: $job"
    fi
done

# Create monitoring dashboard HTML
cat > monitoring/dashboards/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>LP Position Monitoring Dashboard</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .card { 
            background: white; 
            border-radius: 8px; 
            padding: 20px; 
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 { color: #333; margin-bottom: 30px; }
        h2 { color: #666; margin-top: 0; }
        .metric { 
            display: inline-block; 
            margin: 10px 20px 10px 0;
        }
        .metric-value { 
            font-size: 2em; 
            font-weight: bold; 
            color: #2196F3;
        }
        .metric-label { 
            color: #666; 
            font-size: 0.9em;
        }
        .status-active { color: #4CAF50; }
        .status-closed { color: #f44336; }
        .status-inactive { color: #FF9800; }
        pre { 
            background: #f5f5f5; 
            padding: 15px; 
            border-radius: 4px;
            overflow-x: auto;
        }
        .refresh { 
            float: right; 
            color: #666; 
            font-size: 0.9em;
        }
        .alert {
            background: #fff3cd;
            border: 1px solid #ffeeba;
            color: #856404;
            padding: 10px 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
        .error {
            background: #f8d7da;
            border-color: #f5c6cb;
            color: #721c24;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>LP Position Monitoring Dashboard <span class="refresh" id="refresh-time"></span></h1>
        
        <div id="alerts"></div>
        
        <div class="card">
            <h2>System Status</h2>
            <div id="system-status">Loading...</div>
        </div>
        
        <div class="card">
            <h2>LP Position Statistics</h2>
            <div id="lp-stats">Loading...</div>
        </div>
        
        <div class="card">
            <h2>Recent Activity</h2>
            <div id="recent-activity">Loading...</div>
        </div>
        
        <div class="card">
            <h2>Performance Metrics</h2>
            <div id="performance">Loading...</div>
        </div>
    </div>
    
    <script>
        async function loadStatus() {
            try {
                // Load latest status file
                const response = await fetch('lp-status-' + new Date().getHours() + '.txt');
                const text = await response.text();
                
                // Parse the status text
                const lines = text.split('\n');
                
                // Extract metrics
                let totalPositions = 0, activePositions = 0, closedPositions = 0;
                let recentErrors = 0;
                
                lines.forEach(line => {
                    if (line.includes('Total Positions:')) {
                        totalPositions = parseInt(line.split(':')[1]) || 0;
                    }
                    if (line.includes('active:')) {
                        activePositions = parseInt(line.split(':')[1]) || 0;
                    }
                    if (line.includes('closed:')) {
                        closedPositions = parseInt(line.split(':')[1]) || 0;
                    }
                });
                
                // Update UI
                document.getElementById('lp-stats').innerHTML = `
                    <div class="metric">
                        <div class="metric-value">${totalPositions}</div>
                        <div class="metric-label">Total Positions</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value status-active">${activePositions}</div>
                        <div class="metric-label">Active</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value status-closed">${closedPositions}</div>
                        <div class="metric-label">Closed</div>
                    </div>
                `;
                
                // Update refresh time
                document.getElementById('refresh-time').textContent = 
                    'Last updated: ' + new Date().toLocaleTimeString();
                
            } catch (error) {
                console.error('Failed to load status:', error);
                document.getElementById('alerts').innerHTML = 
                    '<div class="alert error">Failed to load monitoring data</div>';
            }
        }
        
        // Load on page load
        loadStatus();
        
        // Refresh every 60 seconds
        setInterval(loadStatus, 60000);
    </script>
</body>
</html>
EOF

# Create alert script
cat > monitoring/alerts/check-alerts.js << 'EOF'
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Alert thresholds
const THRESHOLDS = {
    ERROR_COUNT: 5,
    CLOSED_POSITIONS_RATE: 10, // More than 10 closures per hour
    UPDATE_FAILURE_RATE: 0.1,   // 10% failure rate
    PERFORMANCE_MS: 30000       // 30 seconds
};

async function checkAlerts() {
    const alerts = [];
    
    try {
        // Load recent logs
        const logFile = path.join(__dirname, '../../logs/lp-updates-' + 
            new Date().toISOString().split('T')[0] + '.log');
        
        if (fs.existsSync(logFile)) {
            const logs = fs.readFileSync(logFile, 'utf8')
                .split('\n')
                .filter(line => line.trim())
                .map(line => {
                    try {
                        return JSON.parse(line);
                    } catch (e) {
                        return null;
                    }
                })
                .filter(log => log !== null);
            
            // Check error rate
            const recentLogs = logs.filter(log => 
                new Date(log.timestamp) > new Date(Date.now() - 3600000)
            );
            
            const errors = recentLogs.filter(log => log.level === 'error');
            if (errors.length > THRESHOLDS.ERROR_COUNT) {
                alerts.push({
                    level: 'error',
                    message: `High error rate: ${errors.length} errors in last hour`,
                    details: errors.slice(-5)
                });
            }
            
            // Check position closures
            const closures = recentLogs.filter(log => 
                log.message && log.message.includes('POSITION_CHANGE') &&
                log.changes && log.changes.newStatus === 'closed'
            );
            
            if (closures.length > THRESHOLDS.CLOSED_POSITIONS_RATE) {
                alerts.push({
                    level: 'warning',
                    message: `High closure rate: ${closures.length} positions closed in last hour`,
                    positions: closures.map(c => c.tokenId)
                });
            }
            
            // Check performance
            const perfLogs = recentLogs.filter(log => 
                log.message && log.message.startsWith('Performance:')
            );
            
            const slowOps = perfLogs.filter(log => 
                parseInt(log.duration) > THRESHOLDS.PERFORMANCE_MS
            );
            
            if (slowOps.length > 0) {
                alerts.push({
                    level: 'warning',
                    message: `Slow operations detected: ${slowOps.length} operations over ${THRESHOLDS.PERFORMANCE_MS}ms`,
                    operations: slowOps.map(op => ({
                        operation: op.operation,
                        duration: op.duration
                    }))
                });
            }
        }
        
        // Save alerts
        if (alerts.length > 0) {
            const alertFile = path.join(__dirname, 'current-alerts.json');
            fs.writeFileSync(alertFile, JSON.stringify({
                timestamp: new Date().toISOString(),
                alerts: alerts
            }, null, 2));
            
            console.log(`Found ${alerts.length} alerts`);
            
            // Here you could send notifications (email, webhook, etc.)
            // Example: await sendAlertNotification(alerts);
        }
        
    } catch (error) {
        console.error('Alert check failed:', error);
    }
}

// Run if called directly
if (require.main === module) {
    checkAlerts();
}
EOF

chmod +x monitoring/alerts/check-alerts.js

# Create systemd service for real-time monitoring (optional)
if command -v systemctl &> /dev/null; then
    echo -e "\n${YELLOW}Creating systemd service for real-time monitoring...${NC}"
    
    cat > /tmp/lp-monitor.service << EOF
[Unit]
Description=LP Position Monitor
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node scripts/monitor-lp-updates.js watch
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    echo "Systemd service file created at /tmp/lp-monitor.service"
    echo "To install: sudo cp /tmp/lp-monitor.service /etc/systemd/system/ && sudo systemctl enable lp-monitor"
fi

# Create monitoring README
cat > monitoring/README.md << 'EOF'
# LP Position Monitoring

## Overview
This directory contains monitoring tools and dashboards for the enhanced LP position tracking system.

## Structure
- `dashboards/` - HTML dashboards and status files
- `alerts/` - Alert checking scripts and configurations
- `reports/` - Daily and weekly reports

## Accessing the Dashboard
1. Serve the monitoring directory with a web server:
   ```bash
   cd monitoring/dashboards
   python3 -m http.server 8080
   ```
2. Open http://localhost:8080 in your browser

## Monitoring Commands
- Real-time monitoring: `node scripts/monitor-lp-updates.js watch`
- Generate report: `node scripts/monitor-lp-updates.js report`
- Check data validity: `node scripts/validate-lp-data.js check`

## Alert Configuration
Edit `alerts/check-alerts.js` to modify alert thresholds.

## Cron Jobs
The following monitoring jobs are scheduled:
- Hourly status snapshots
- Daily summary reports
- Weekly detailed reports
- Twice-daily data validation
- Log archival and cleanup
EOF

echo -e "\n${GREEN}✓ Monitoring setup complete!${NC}"
echo
echo "Monitoring locations:"
echo "  - Dashboards: monitoring/dashboards/"
echo "  - Alerts: monitoring/alerts/"
echo "  - Reports: monitoring/reports/"
echo "  - Logs: logs/"
echo
echo "To view the dashboard:"
echo "  1. cd monitoring/dashboards"
echo "  2. python3 -m http.server 8080"
echo "  3. Open http://localhost:8080"
echo
echo "To start real-time monitoring:"
echo "  node scripts/monitor-lp-updates.js watch"