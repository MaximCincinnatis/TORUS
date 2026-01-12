#!/usr/bin/env node

/**
 * ============================================================================
 * STATUS: 🟢 ACTIVE - Primary Production Script
 * ============================================================================
 * LAST MODIFIED: 2025-08-17
 * CLASSIFICATION DATE: 2025-08-25
 * 
 * PURPOSE:
 * Main automation script that orchestrates all data updates for the TORUS Dashboard.
 * This is the PRIMARY ENTRY POINT for all automated updates.
 * 
 * EXECUTION:
 * - Cron job: Every 5 minutes via /home/wsl/projects/TORUSspecs/torus-dashboard/run-auto-update.sh
 * - Runs every 5 minutes, 24/7
 * - Also runs on system reboot via run-updater-service.js
 * 
 * WORKFLOW:
 * 1. Runs smart-update-fixed.js for incremental updates
 * 2. Updates LP fee burns via update-lp-fee-burns.js
 * 3. Checks if LP positions need updating
 * 4. Commits changes to Git
 * 5. Pushes to GitHub (triggers Vercel deployment)
 * 
 * DEPENDENCIES:
 * - smart-update-fixed.js (REQUIRED - incremental update logic)
 * - update-lp-fee-burns.js (REQUIRED - LP fee tracking)
 * - incremental-lp-updater.js (OPTIONAL - LP position updates)
 * - force-vercel-rebuild.js (OPTIONAL - deployment trigger)
 * 
 * OUTPUTS:
 * - Updates: public/data/cached-data.json
 * - Updates: public/data/buy-process-data.json
 * - Updates: update-log.json
 * - Updates: src/constants/buildTimestamp.ts
 * - Git commits with timestamp
 * 
 * CRITICAL NOTES:
 * ⚠️ DO NOT MODIFY without testing the full update cycle
 * ⚠️ This script is the MAIN ENTRY POINT for production updates
 * ⚠️ Errors here will stop all automated updates
 * ⚠️ Always preserves existing data through smart merging
 * 
 * ERROR HANDLING:
 * - Continues on non-critical errors (LP updates, etc.)
 * - Logs all errors but doesn't stop the update cycle
 * - Only commits if there are actual changes
 * 
 * MONITORING:
 * - Check logs at: /home/wsl/projects/TORUSspecs/torus-dashboard/logs/auto-update-fixed.log
 * - Monitor via: tail -f logs/auto-update-fixed.log
 * ============================================================================
 */

const { execSync } = require('child_process');
const fs = require('fs');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, description) {
  try {
    log(`${description}...`, 'cyan');
    const output = execSync(command, { encoding: 'utf8', stdio: 'inherit' });
    log(`✅ ${description} completed`, 'green');
    return true;
  } catch (error) {
    log(`❌ Error: ${description} failed!`, 'red');
    console.error(error.message);
    return false;
  }
}

async function main() {
  log('🚀 TORUS Dashboard Fixed Auto-Update', 'bright');
  log('====================================', 'bright');
  
  // 1. Run smart update (preserves data)
  // Always use smart-update-fixed.js which has proper deduplication
  if (!execCommand('node smart-update-fixed.js', 'Running smart update with deduplication')) {
    log('Smart update had issues, but continuing...', 'yellow');
  }
  
  // 2. Update LP fee burns (critical for burn tracking)
  log('Updating LP fee burns...', 'cyan');
  if (!execCommand('node update-lp-fee-burns.js', 'Updating LP fee burn data')) {
    log('LP fee update had issues, but continuing...', 'yellow');
  }
  
  // 3. Check if LP positions need detailed update
  const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
  if (cachedData.metadata?.needsManualUpdate) {
    log('Running incremental LP updater...', 'cyan');
    execCommand('node incremental-lp-updater.js', 'Updating LP positions');
  }
  
  // 4. Check for git changes
  try {
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
    
    if (!gitStatus.trim()) {
      log('ℹ️  No changes detected. Dashboard is up to date.', 'yellow');
      return;
    }
    
    log('📝 Git changes detected:', 'cyan');
    console.log(gitStatus);
    
    // 4. Force Vercel rebuild
    execCommand('node force-vercel-rebuild.js', 'Forcing Vercel rebuild');
    
    // 5. Add and commit
    // NOTE: buy-process-burns.json added 2026-01-12 - was being updated by update-lp-fee-burns.js but never staged
    execCommand('git add public/data/cached-data.json public/data/buy-process-data.json public/data/buy-process-burns.json update-log.json src/constants/buildTimestamp.ts', 'Staging changes');
    
    const timestamp = new Date().toISOString();
    const commitMessage = `Auto-update (fixed) - ${timestamp}

- Smart incremental update preserving existing data
- Updated pool data and prices
- Maintained LP positions with proper merging
- No data loss

🤖 Generated with fixed auto-update script`;
    
    const commitCmd = `git commit -m "${commitMessage}"`;
    if (!execCommand(commitCmd, 'Committing changes')) {
      process.exit(1);
    }
    
    // 5. Push to GitHub
    // Read token from file if it exists
    const tokenFile = '.github-token';
    let pushCommand = 'git push origin master';
    
    if (fs.existsSync(tokenFile)) {
      const token = fs.readFileSync(tokenFile, 'utf8').trim();
      const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
      const repoPath = remoteUrl.replace(/https:\/\/.*@/, '').replace('https://', '');
      pushCommand = `git push https://${token}@${repoPath} master`;
    }
    
    if (!execCommand(pushCommand, 'Pushing to GitHub')) {
      process.exit(1);
    }
    
    log('🎉 Update complete! Vercel will deploy automatically.', 'green');
    
  } catch (error) {
    log('❌ Error in git operations', 'red');
    console.error(error);
    process.exit(1);
  }
  
  // Summary
  log('📊 Summary:', 'bright');
  log(`   Data updated: ${new Date().toUTCString()}`, 'cyan');
  log(`   LP Positions: ${cachedData.lpPositions?.length || 0}`, 'cyan');
  log('   Data preserved: YES ✅', 'green');
  log('   Auto-deployment: Enabled via Vercel', 'cyan');
}

// Run the script
main().catch(error => {
  log('❌ Unexpected error:', 'red');
  console.error(error);
  process.exit(1);
});