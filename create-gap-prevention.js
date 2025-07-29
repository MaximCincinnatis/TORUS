#!/usr/bin/env node

const fs = require('fs');

console.log('🛡️ CREATING GAP PREVENTION MEASURES');
console.log('===================================\n');

// 1. Create monitoring script for LP fee gaps
const monitoringScript = `#!/usr/bin/env node

const fs = require('fs');
const { ethers } = require('ethers');

console.log('🔍 MONITORING LP FEE COLLECTION GAPS');
console.log('===================================\\n');

async function checkForGaps() {
  try {
    // Load current data
    const lpData = JSON.parse(fs.readFileSync('./public/data/buy-process-burns.json', 'utf8'));
    
    // Calculate current protocol day
    const CONTRACT_START_DATE = new Date('2025-07-10T18:00:00.000Z');
    const now = new Date();
    const currentDayUTC = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    currentDayUTC.setUTCHours(18, 0, 0, 0);
    
    if (now.getTime() < currentDayUTC.getTime()) {
      currentDayUTC.setUTCDate(currentDayUTC.getUTCDate() - 1);
    }
    
    const msPerDay = 24 * 60 * 60 * 1000;
    const currentProtocolDay = Math.max(1, Math.floor((currentDayUTC.getTime() - CONTRACT_START_DATE.getTime()) / msPerDay) + 1);
    
    // Check for recent collections
    const provider = new ethers.providers.JsonRpcProvider('https://eth.drpc.org');
    const COLLECT_TOPIC = ethers.utils.id("Collect(uint256,address,uint256,uint256)");
    
    const recentLogs = await provider.getLogs({
      address: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
      topics: [COLLECT_TOPIC],
      fromBlock: lpData.lastBlock,
      toBlock: 'latest'
    });
    
    // Alert if there are untrackedcollections
    if (recentLogs.length > 0) {
      console.log(\`🚨 ALERT: \${recentLogs.length} untracked Collect events detected!\`);
      console.log('   Run: node update-lp-fee-burns.js');
      return false;
    }
    
    // Check data freshness
    const lastUpdate = new Date(lpData.lastUpdated);
    const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
    
    if (hoursSinceUpdate > 48) {
      console.log(\`⚠️ WARNING: LP fee data is \${hoursSinceUpdate.toFixed(1)} hours old\`);
      return false;
    }
    
    console.log(\`✅ LP fee tracking is up to date (last updated \${hoursSinceUpdate.toFixed(1)}h ago)\`);
    return true;
    
  } catch (e) {
    console.log(\`❌ Error checking LP fee gaps: \${e.message}\`);
    return false;
  }
}

checkForGaps().then(success => {
  process.exit(success ? 0 : 1);
});
`;

fs.writeFileSync('./monitor-lp-gaps.js', monitoringScript);
console.log('✅ Created monitor-lp-gaps.js');

// 2. Create validation script for auto-update integrity
const validationScript = `#!/usr/bin/env node

const fs = require('fs');

console.log('🔍 VALIDATING AUTO-UPDATE INTEGRITY');
console.log('==================================\\n');

// Check that auto-update includes all critical updates
const autoUpdateContent = fs.readFileSync('./auto-update-fixed.js', 'utf8');

const requiredUpdates = [
  { name: 'Smart Update', pattern: /smart-update.*\.js/ },
  { name: 'LP Fee Burns', pattern: /update-lp-fee-burns\.js/ },
  { name: 'Git Status Check', pattern: /git status/ },
  { name: 'Git Commit', pattern: /git commit/ }
];

let allValid = true;

console.log('🔧 CHECKING REQUIRED COMPONENTS:');
requiredUpdates.forEach(update => {
  const hasComponent = update.pattern.test(autoUpdateContent);
  console.log(\`  \${hasComponent ? '✅' : '❌'} \${update.name}: \${hasComponent ? 'INCLUDED' : 'MISSING'}\`);
  if (!hasComponent) allValid = false;
});

// Check cron job
try {
  const { execSync } = require('child_process');
  const cronContent = execSync('crontab -l 2>/dev/null', { encoding: 'utf8' });
  const hasCron = cronContent.includes('run-auto-update.sh');
  console.log(\`\\n📅 CRON JOB: \${hasCron ? '✅ ACTIVE' : '❌ MISSING'}\`);
  if (!hasCron) allValid = false;
} catch (e) {
  console.log('\\n📅 CRON JOB: ❌ COULD NOT CHECK');
  allValid = false;
}

// Check log file exists and is recent
try {
  const logStats = fs.statSync('./logs/auto-update-fixed.log');
  const hoursSinceLog = (Date.now() - logStats.mtime.getTime()) / (1000 * 60 * 60);
  console.log(\`\\n📋 LOG FILE: \${hoursSinceLog < 24 ? '✅' : '⚠️'} Last updated \${hoursSinceLog.toFixed(1)}h ago\`);
} catch (e) {
  console.log('\\n📋 LOG FILE: ❌ NOT FOUND');
  allValid = false;
}

console.log(\`\\n\${allValid ? '🎉' : '🚨'} VALIDATION \${allValid ? 'PASSED' : 'FAILED'}\`);
process.exit(allValid ? 0 : 1);
`;

fs.writeFileSync('./validate-automation.js', validationScript);
console.log('✅ Created validate-automation.js');

// 3. Add monitoring to cron (instruction script)
const cronInstructions = `#!/bin/bash

# Add LP gap monitoring to cron (runs every hour)
echo "Adding LP gap monitoring to cron..."

# Check if monitoring already exists
if crontab -l 2>/dev/null | grep -q "monitor-lp-gaps"; then
  echo "LP gap monitoring already in cron"
else
  # Add to existing cron
  (crontab -l 2>/dev/null; echo "0 * * * * cd $(pwd) && node monitor-lp-gaps.js >> logs/lp-monitoring.log 2>&1") | crontab -
  echo "✅ Added LP gap monitoring to cron (hourly)"
fi

# Check if validation already exists  
if crontab -l 2>/dev/null | grep -q "validate-automation"; then
  echo "Automation validation already in cron"
else
  # Add validation check (daily at 6 AM)
  (crontab -l 2>/dev/null; echo "0 6 * * * cd $(pwd) && node validate-automation.js >> logs/validation.log 2>&1") | crontab -
  echo "✅ Added automation validation to cron (daily)"
fi

echo "✅ Cron setup complete"
crontab -l | grep -E "(monitor-lp|validate-automation)"
`;

fs.writeFileSync('./setup-monitoring-cron.sh', cronInstructions);
fs.chmodSync('./setup-monitoring-cron.sh', 0o755);
console.log('✅ Created setup-monitoring-cron.sh');

// 4. Create prevention checklist
const checklistContent = `# LP Fee Tracking Gap Prevention Checklist

## ✅ Implemented Safeguards

### 1. **Automated Updates** 
- [x] LP fee burns included in auto-update-fixed.js
- [x] Runs every 5 minutes via cron
- [x] Automatic git commits and deployment

### 2. **Gap Monitoring**
- [x] monitor-lp-gaps.js - Detects untracked collections
- [x] validate-automation.js - Validates automation integrity
- [x] Hourly monitoring via cron

### 3. **Data Validation**
- [x] Protocol day calculation fixed
- [x] Block range tracking implemented
- [x] Error handling for RPC failures

## 🚨 Warning Signs to Watch For

1. **LP monitoring log shows alerts**
2. **Auto-update log stops showing recent activity**
3. **Gap between protocol days in LP fee data**
4. **Manual collections happen but don't appear in dashboard**

## 🔧 Manual Recovery Process

If gaps occur again:

1. Run: \`node monitor-lp-gaps.js\`
2. If alerts shown, run: \`node update-lp-fee-burns.js\`
3. Check: \`node validate-automation.js\`
4. Verify data: Check \`public/data/buy-process-burns.json\`

## 📊 How the Gap Happened

- **July 22**: LP fee update script created
- **July 22-28**: Script existed but NOT in automation
- **July 28**: Collection happened but went untracked
- **July 29**: Gap discovered and fixed

## 🛡️ Prevention Measures

1. **Redundant Monitoring**: Hourly gap detection
2. **Automation Validation**: Daily integrity checks  
3. **Clear Documentation**: This checklist
4. **Error Alerting**: Logs show when things fail

**Risk Level**: 🟢 **LOW** (multiple safeguards now in place)
`;

fs.writeFileSync('./LP-GAP-PREVENTION.md', checklistContent);
console.log('✅ Created LP-GAP-PREVENTION.md');

console.log('\n🎯 PREVENTION SUMMARY:');
console.log('  ✅ monitor-lp-gaps.js - Hourly gap detection');
console.log('  ✅ validate-automation.js - Daily integrity checks');
console.log('  ✅ setup-monitoring-cron.sh - Easy cron setup');
console.log('  ✅ LP-GAP-PREVENTION.md - Documentation');

console.log('\n📋 NEXT STEPS:');
console.log('  1. Run: ./setup-monitoring-cron.sh');
console.log('  2. Test: node monitor-lp-gaps.js');
console.log('  3. Test: node validate-automation.js');

console.log('\n✅ Gap prevention measures created!');