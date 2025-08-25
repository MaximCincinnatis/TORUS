#!/usr/bin/env node

/**
 * ============================================================================
 * STATUS: 🔴 DEPRECATED - DO NOT USE
 * ============================================================================
 * LAST MODIFIED: 2025-07-15 (estimated)
 * DEPRECATED DATE: 2025-08-01
 * CLASSIFICATION DATE: 2025-08-25
 * 
 * ⚠️ WARNING: This script has been replaced by auto-update-fixed.js
 * ⚠️ DO NOT USE THIS SCRIPT - It may cause data loss or corruption
 * 
 * REPLACED BY:
 * - auto-update-fixed.js (includes proper data preservation)
 * - smart-update-fixed.js (includes deduplication fixes)
 * 
 * ORIGINAL PURPOSE:
 * Initial version of automated update and deployment script.
 * Had issues with data preservation and duplicate handling.
 * 
 * PROBLEMS WITH THIS VERSION:
 * 1. Did not properly preserve existing LP positions
 * 2. Could create duplicate events in some cases
 * 3. Performed full rebuilds too frequently
 * 4. Poor error handling could corrupt data
 * 
 * MIGRATION NOTES:
 * All functionality has been moved to auto-update-fixed.js with:
 * - Proper incremental updates
 * - Data preservation logic
 * - Better error handling
 * - Deduplication of events
 * 
 * REMOVAL SCHEDULE:
 * This file will be moved to scripts/archive/ after 2025-09-01
 * 
 * IF YOU'RE READING THIS:
 * Use auto-update-fixed.js instead
 * ============================================================================
 */

// [DEPRECATED CODE BELOW - DO NOT USE]

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