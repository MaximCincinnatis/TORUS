#!/bin/bash

# Enhanced LP Tracking Deployment Script
# 
# This script safely deploys the enhanced LP tracking system
# into the existing auto-update infrastructure
#
# Usage: ./deploy-enhanced-lp.sh [test|stage|prod]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENV=${1:-test}
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="backups/deploy-${TIMESTAMP}"

echo -e "${BLUE}Enhanced LP Tracking Deployment - ${ENV} Environment${NC}"
echo "=================================================="

# Function to log messages
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Pre-deployment checks
log "Running pre-deployment checks..."

# Check if required files exist
REQUIRED_FILES=(
    "utils/enhancedLPUpdater.js"
    "utils/lpPositionStates.js"
    "utils/dataBackup.js"
    "utils/dataValidation.js"
    "utils/logger.js"
    "smart-update-enhanced-integrated.js"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        error "Required file missing: $file"
    fi
done

log "All required files present ✓"

# Create backup directory
log "Creating backup directory: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Backup current state
log "Backing up current state..."

# Backup data
cp -r data "$BACKUP_DIR/" 2>/dev/null || warn "No data directory to backup"
cp -r public/data "$BACKUP_DIR/public-data" 2>/dev/null || warn "No public data to backup"

# Backup scripts
cp smart-update-fixed.js "$BACKUP_DIR/" 2>/dev/null || warn "smart-update-fixed.js not found"
cp auto-update-fixed.js "$BACKUP_DIR/" 2>/dev/null || warn "auto-update-fixed.js not found"
cp update-log.json "$BACKUP_DIR/" 2>/dev/null || warn "update-log.json not found"

log "Backup complete ✓"

# Test environment setup
if [ "$ENV" == "test" ]; then
    log "Setting up test environment..."
    
    # Create test directory
    TEST_DIR="test-env-${TIMESTAMP}"
    mkdir -p "$TEST_DIR"
    
    # Copy necessary files
    cp -r utils "$TEST_DIR/"
    cp -r scripts "$TEST_DIR/"
    cp -r shared "$TEST_DIR/"
    cp smart-update-enhanced-integrated.js "$TEST_DIR/"
    cp package.json "$TEST_DIR/"
    
    # Copy test data
    mkdir -p "$TEST_DIR/public/data"
    cp public/data/cached-data.json "$TEST_DIR/public/data/" 2>/dev/null || echo "{}" > "$TEST_DIR/public/data/cached-data.json"
    
    log "Test environment created: $TEST_DIR"
    log "To test: cd $TEST_DIR && node smart-update-enhanced-integrated.js"
    
elif [ "$ENV" == "stage" ]; then
    log "Staging deployment..."
    
    # Deploy enhanced updater alongside existing
    cp smart-update-enhanced-integrated.js smart-update-enhanced.js
    
    # Update cron for parallel run
    log "Setting up parallel cron jobs..."
    
    # Add enhanced update to cron (runs 5 minutes after regular update)
    CRON_LINE="5,35 * * * * cd $(pwd) && /usr/bin/node smart-update-enhanced.js >> logs/enhanced-update.log 2>&1"
    (crontab -l 2>/dev/null | grep -v "smart-update-enhanced.js"; echo "$CRON_LINE") | crontab -
    
    log "Staging deployment complete ✓"
    log "Both original and enhanced updates will run in parallel"
    log "Monitor: tail -f logs/enhanced-update.log"
    
elif [ "$ENV" == "prod" ]; then
    log "Production deployment..."
    
    # Final safety check
    read -p "Are you sure you want to deploy to production? (yes/no): " -n 5 -r
    echo
    if [[ ! $REPLY =~ ^yes$ ]]; then
        error "Production deployment cancelled"
    fi
    
    # Verify staging ran successfully
    if [ ! -f "logs/enhanced-update.log" ]; then
        error "No staging logs found. Run staging deployment first."
    fi
    
    # Check for recent errors in staging
    RECENT_ERRORS=$(tail -n 100 logs/enhanced-update.log | grep -c "ERROR" || true)
    if [ "$RECENT_ERRORS" -gt 0 ]; then
        warn "Found $RECENT_ERRORS errors in recent staging logs"
        read -p "Continue anyway? (yes/no): " -n 5 -r
        echo
        if [[ ! $REPLY =~ ^yes$ ]]; then
            error "Production deployment cancelled due to staging errors"
        fi
    fi
    
    # Backup current production script
    cp smart-update-fixed.js "smart-update-fixed.backup.${TIMESTAMP}.js"
    
    # Deploy enhanced version
    cp smart-update-enhanced-integrated.js smart-update-fixed.js
    
    # Remove staging cron job
    crontab -l | grep -v "smart-update-enhanced.js" | crontab -
    
    log "Production deployment complete ✓"
    log "Enhanced LP tracking is now live"
    log "Original script backed up to: smart-update-fixed.backup.${TIMESTAMP}.js"
    
else
    error "Invalid environment: $ENV. Use 'test', 'stage', or 'prod'"
fi

# Post-deployment verification
log "Running post-deployment verification..."

# Check Node.js version
NODE_VERSION=$(node -v)
log "Node.js version: $NODE_VERSION"

# Check if logger directory exists
if [ ! -d "logs" ]; then
    mkdir -p logs
    log "Created logs directory"
fi

# Verify data integrity
if [ -f "scripts/validate-lp-data.js" ]; then
    log "Validating current data..."
    node scripts/validate-lp-data.js check || warn "Data validation found issues"
fi

# Show deployment summary
echo
echo -e "${BLUE}Deployment Summary${NC}"
echo "=================="
echo "Environment: $ENV"
echo "Timestamp: $TIMESTAMP"
echo "Backup location: $BACKUP_DIR"

if [ "$ENV" == "test" ]; then
    echo "Test directory: $TEST_DIR"
elif [ "$ENV" == "stage" ]; then
    echo "Staging logs: logs/enhanced-update.log"
    echo "Next run: $(date -d '+30 minutes')"
elif [ "$ENV" == "prod" ]; then
    echo "Status: LIVE"
    echo "Monitoring: node scripts/monitor-lp-updates.js watch"
fi

echo
log "Deployment complete! ✓"

# Create deployment record
DEPLOY_RECORD="deployments/deploy-${TIMESTAMP}.json"
mkdir -p deployments
cat > "$DEPLOY_RECORD" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "$ENV",
  "deployer": "$USER",
  "hostname": "$(hostname)",
  "backup_location": "$BACKUP_DIR",
  "status": "success",
  "notes": "Enhanced LP tracking deployment"
}
EOF

log "Deployment recorded in: $DEPLOY_RECORD"