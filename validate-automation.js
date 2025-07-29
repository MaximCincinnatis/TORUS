#!/usr/bin/env node

const fs = require('fs');

console.log('🔍 VALIDATING AUTO-UPDATE INTEGRITY');
console.log('==================================\n');

// Check that auto-update includes all critical updates
const autoUpdateContent = fs.readFileSync('./auto-update-fixed.js', 'utf8');

const requiredUpdates = [
  { name: 'Smart Update', pattern: /smart-update.*.js/ },
  { name: 'LP Fee Burns', pattern: /update-lp-fee-burns.js/ },
  { name: 'Git Status Check', pattern: /git status/ },
  { name: 'Git Commit', pattern: /git commit/ }
];

let allValid = true;

console.log('🔧 CHECKING REQUIRED COMPONENTS:');
requiredUpdates.forEach(update => {
  const hasComponent = update.pattern.test(autoUpdateContent);
  console.log(`  ${hasComponent ? '✅' : '❌'} ${update.name}: ${hasComponent ? 'INCLUDED' : 'MISSING'}`);
  if (!hasComponent) allValid = false;
});

// Check cron job
try {
  const { execSync } = require('child_process');
  const cronContent = execSync('crontab -l 2>/dev/null', { encoding: 'utf8' });
  const hasCron = cronContent.includes('run-auto-update.sh');
  console.log(`\n📅 CRON JOB: ${hasCron ? '✅ ACTIVE' : '❌ MISSING'}`);
  if (!hasCron) allValid = false;
} catch (e) {
  console.log('\n📅 CRON JOB: ❌ COULD NOT CHECK');
  allValid = false;
}

// Check log file exists and is recent
try {
  const logStats = fs.statSync('./logs/auto-update-fixed.log');
  const hoursSinceLog = (Date.now() - logStats.mtime.getTime()) / (1000 * 60 * 60);
  console.log(`\n📋 LOG FILE: ${hoursSinceLog < 24 ? '✅' : '⚠️'} Last updated ${hoursSinceLog.toFixed(1)}h ago`);
} catch (e) {
  console.log('\n📋 LOG FILE: ❌ NOT FOUND');
  allValid = false;
}

console.log(`\n${allValid ? '🎉' : '🚨'} VALIDATION ${allValid ? 'PASSED' : 'FAILED'}`);
process.exit(allValid ? 0 : 1);
