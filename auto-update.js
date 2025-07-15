#!/usr/bin/env node

/**
 * TORUS Dashboard - Automated Update and Deploy
 * 
 * This script:
 * 1. Updates all dashboard data
 * 2. Fixes LP position calculations
 * 3. Commits changes to git
 * 4. Pushes to GitHub (triggers Vercel deployment)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, description) {
  try {
    log(`\n${description}...`, 'cyan');
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
  log('\n🚀 TORUS Dashboard Automated Update', 'bright');
  log('===================================\n', 'bright');

  // 1. Update dashboard data
  if (!execCommand('node scripts/data-updates/update-all-dashboard-data.js', 'Updating dashboard data')) {
    process.exit(1);
  }

  // 2. Fix LP positions (optional - only if needed)
  const lpScriptsExist = fs.existsSync('fetch-all-lp-positions.js') && fs.existsSync('fix-lp-positions-simple.js');
  if (lpScriptsExist) {
    execCommand('node fetch-all-lp-positions.js', 'Fetching LP positions');
    execCommand('node fix-lp-positions-simple.js', 'Fixing LP calculations');
  }

  // 3. Check if there are changes
  try {
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
    
    if (!gitStatus.trim()) {
      log('\nℹ️  No changes detected. Dashboard data is already up to date.', 'yellow');
      return;
    }

    log('\n📝 Git changes detected:', 'cyan');
    console.log(gitStatus);

    // 4. Add and commit changes
    execCommand('git add public/data/cached-data.json', 'Staging changes');

    const timestamp = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
    const commitMessage = `Automated dashboard data update - ${timestamp}

- Updated all dashboard metrics
- Refreshed LP positions with accurate calculations  
- Updated token prices and pool data
- Refreshed reward pool data

🤖 Generated with automated update script`;

    const commitCmd = `git commit -m "${commitMessage}"`;
    if (!execCommand(commitCmd, 'Committing changes')) {
      process.exit(1);
    }

    // 5. Push to GitHub
    if (!execCommand('git push origin master', 'Pushing to GitHub')) {
      process.exit(1);
    }

    log('\n🎉 Update complete! Vercel will automatically deploy the changes.', 'green');
    log('   Visit your Vercel dashboard to monitor the deployment.\n', 'green');

  } catch (error) {
    log('\n❌ Error checking git status', 'red');
    console.error(error);
    process.exit(1);
  }

  // Summary
  log('📊 Summary:', 'bright');
  log(`   - Data last updated: ${new Date().toUTCString()}`, 'cyan');
  log('   - Branch: master', 'cyan');
  log('   - Auto-deployment: Enabled via Vercel\n', 'cyan');
}

// Run the script
main().catch(error => {
  log('\n❌ Unexpected error:', 'red');
  console.error(error);
  process.exit(1);
});