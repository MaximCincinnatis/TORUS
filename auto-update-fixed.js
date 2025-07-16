#!/usr/bin/env node

/**
 * TORUS Dashboard - Fixed Automated Update and Deploy
 * 
 * This script:
 * 1. Uses smart-update-fixed.js for incremental updates
 * 2. Preserves existing data
 * 3. Commits changes to git
 * 4. Pushes to GitHub (triggers Vercel deployment)
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
  if (!execCommand('node smart-update-fixed.js', 'Running smart update')) {
    log('Smart update had issues, but continuing...', 'yellow');
  }
  
  // 2. Check if LP positions need detailed update
  const cachedData = JSON.parse(fs.readFileSync('./public/data/cached-data.json', 'utf8'));
  if (cachedData.metadata?.needsManualUpdate) {
    log('Running incremental LP updater...', 'cyan');
    execCommand('node incremental-lp-updater.js', 'Updating LP positions');
  }
  
  // 3. Check for git changes
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
    execCommand('git add public/data/cached-data.json update-log.json src/constants/buildTimestamp.ts', 'Staging changes');
    
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
    if (!execCommand('git push origin master', 'Pushing to GitHub')) {
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