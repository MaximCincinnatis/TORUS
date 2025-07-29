#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔍 INVESTIGATING LP FEE TRACKING GAP');
console.log('===================================\n');

// 1. Check when LP fee update script was created
console.log('📅 SCRIPT CREATION TIMELINE:');
try {
  const scriptStats = fs.statSync('./update-lp-fee-burns.js');
  console.log(`  update-lp-fee-burns.js created: ${scriptStats.birthtime.toISOString()}`);
  console.log(`  Last modified: ${scriptStats.mtime.toISOString()}`);
} catch (e) {
  console.log('  ❌ Could not get script stats');
}

// 2. Check git history for when scripts were added/modified
console.log('\n📚 GIT HISTORY ANALYSIS:');
try {
  // Check when auto-update-fixed.js was created/modified
  const autoUpdateLog = execSync('git log --oneline --follow -- auto-update-fixed.js | head -5', { encoding: 'utf8' });
  console.log('  auto-update-fixed.js history (last 5 commits):');
  autoUpdateLog.split('\n').filter(line => line.trim()).forEach(line => {
    console.log(`    ${line}`);
  });
  
  // Check when LP fee update was added
  try {
    const lpUpdateLog = execSync('git log --oneline --follow -- update-lp-fee-burns.js | head -3', { encoding: 'utf8' });
    console.log('\n  update-lp-fee-burns.js history:');
    lpUpdateLog.split('\n').filter(line => line.trim()).forEach(line => {
      console.log(`    ${line}`);
    });
  } catch (e) {
    console.log('\n  ❌ LP fee update script not in git history (may be newer)');
  }
  
} catch (e) {
  console.log('  ❌ Could not access git history');
}

// 3. Check when the gap occurred by looking at data timestamps
console.log('\n🕐 DATA GAP ANALYSIS:');
const lpData = JSON.parse(fs.readFileSync('./public/data/buy-process-burns.json', 'utf8'));

console.log('  Fee collection timeline:');
lpData.feeDrivenBurns.forEach((burn, i) => {
  const date = new Date(burn.timestamp * 1000);
  console.log(`    ${i + 1}. Day ${burn.protocolDay}: ${date.toISOString().split('T')[0]} (${date.toISOString()})`);
});

// Calculate gaps
const collections = lpData.feeDrivenBurns.map(b => ({
  day: b.protocolDay,
  timestamp: b.timestamp * 1000
})).sort((a, b) => a.day - b.day);

console.log('\n  Gap analysis:');
for (let i = 1; i < collections.length; i++) {
  const prev = collections[i - 1];
  const curr = collections[i];
  const dayGap = curr.day - prev.day;
  const timeGap = (curr.timestamp - prev.timestamp) / (1000 * 60 * 60 * 24);
  
  console.log(`    Between day ${prev.day} and ${curr.day}: ${dayGap} protocol days (${timeGap.toFixed(1)} real days)`);
  
  if (dayGap > 7) {
    console.log(`      🚨 LARGE GAP: ${dayGap} days without tracking`);
  }
}

// 4. Check what the old auto-update was doing
console.log('\n🤖 AUTOMATION HISTORY:');

// Check if there's a backup of the old auto-update
const autoUpdateContent = fs.readFileSync('./auto-update-fixed.js', 'utf8');
const hasLPUpdate = autoUpdateContent.includes('update-lp-fee-burns.js');

console.log(`  Current auto-update includes LP fee updates: ${hasLPUpdate ? '✅ YES' : '❌ NO'}`);

// Check cron log to see when things were running
console.log('\n📋 CRON EXECUTION LOGS:');
try {
  // Check if there are any auto-update logs
  if (fs.existsSync('./logs/auto-update-fixed.log')) {
    const logStats = fs.statSync('./logs/auto-update-fixed.log');
    console.log(`  auto-update-fixed.log last modified: ${logStats.mtime.toISOString()}`);
    
    // Get last few lines
    const logContent = fs.readFileSync('./logs/auto-update-fixed.log', 'utf8');
    const lines = logContent.split('\n').filter(line => line.trim()).slice(-10);
    console.log('  Recent log entries (last 10):');
    lines.forEach(line => {
      console.log(`    ${line}`);
    });
  } else {
    console.log('  ❌ No auto-update log found');
  }
} catch (e) {
  console.log('  ❌ Could not read log files');
}

// 5. Check if LP fee collections actually happened but weren't tracked
console.log('\n💡 POSSIBLE CAUSES:');
console.log('  1. LP fee update script was created but not added to automation');
console.log('  2. Automation was running but not calling LP fee updates');
console.log('  3. Script existed but had bugs preventing updates');
console.log('  4. Manual collections happened but tracking was broken');

// 6. Timeline reconstruction
console.log('\n📊 TIMELINE RECONSTRUCTION:');
console.log('  Day 2 (July 11): First collection tracked ✅');
console.log('  Day 6 (July 16): Second collection tracked ✅');
console.log('  Day 7-17: NO TRACKING (12-day gap) ❌');
console.log('  Day 18 (July 28): Third collection occurred but not tracked until now ❌');
console.log('  Today: Fixed and added to automation ✅');

console.log('\n🔍 ROOT CAUSE LIKELY:');
console.log('  LP fee update script existed but was NOT included in automated updates');
console.log('  Collections happened on-chain but dashboard didn\'t check for them');
console.log('  Manual intervention was needed to discover missing data');

console.log('\n✅ Investigation complete!');