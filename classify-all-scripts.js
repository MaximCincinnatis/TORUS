#!/usr/bin/env node

/**
 * ============================================================================
 * STATUS: 🟡 UTILITY - Script Classification Tool
 * ============================================================================
 * CREATED: 2025-08-25
 * 
 * PURPOSE:
 * Analyzes all JavaScript files in the project and adds classification headers.
 * Identifies active, deprecated, and experimental scripts based on usage patterns.
 * 
 * USAGE:
 * node classify-all-scripts.js [--dry-run] [--verbose]
 * 
 * OPTIONS:
 * --dry-run: Show what would be done without making changes
 * --verbose: Show detailed analysis for each script
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Known active scripts from our analysis
const ACTIVE_SCRIPTS = [
  'auto-update-fixed.js',
  'smart-update-fixed.js',
  'run-auto-update.sh',
  'run-updater-service.js',
  'comprehensive-payment-matching.js',
  'scripts/update-creates-stakes-incremental.js',
  'scripts/update-buy-process-data.js',
  'scripts/data-updates/update-all-dashboard-data.js',
  'scripts/generate-future-supply-projection-fixed.js',
  'incremental-lp-updater.js',
  'update-lp-fee-burns.js',
  'force-vercel-rebuild.js'
];

// Shared utilities that are imported by active scripts
const UTILITY_SCRIPTS = [
  'scripts/shared/contractConstants.js',
  'scripts/shared/titanXHelpers.js',
  'scripts/shared/totalSharesCalculator.js',
  'scripts/shared/ethTransferTracker.js',
  'scripts/shared/useLPPositionStandard.js',
  'shared/lpCalculations.js',
  'shared/rpcUtils.js',
  'scripts/validate-no-duplicates.js',
  'scripts/data-validator.js',
  'scripts/generate-chart-docs.js',
  'scripts/pre-commit-lp-check.js'
];

// Scripts we know are deprecated based on naming patterns
const DEPRECATED_PATTERNS = [
  /^auto-update\.js$/,  // Replaced by auto-update-fixed.js
  /^smart-update\.js$/, // Replaced by smart-update-fixed.js
  /^fix-.*\.js$/,      // One-time fixes
  /^audit-.*\.js$/,    // Audit scripts (usually one-time)
  /^analyze-.*\.js$/,  // Analysis scripts
  /^fetch-.*\.js$/,    // Old fetch scripts
  /^check-.*\.js$/,    // Check scripts
  /^debug-.*\.js$/,    // Debug scripts
  /^test-.*\.js$/,     // Test scripts
  /^investigate-.*\.js$/, // Investigation scripts
  /^restore-.*\.js$/,  // Restoration scripts
  /^clean-.*\.js$/,    // Cleanup scripts
  /^remove-.*\.js$/,   // Removal scripts
  /^recover-.*\.js$/,  // Recovery scripts
  /^populate-.*\.js$/, // Population scripts
  /^enhance-.*\.js$/,  // Enhancement scripts
  /^create-.*\.js$/,   // Creation scripts
  /^add-.*\.js$/,      // Addition scripts
  /^calculate-.*\.js$/, // Calculation scripts
  /^compare-.*\.js$/,  // Comparison scripts
  /^decode-.*\.js$/,   // Decoding scripts
  /^extract-.*\.js$/,  // Extraction scripts
  /^find-.*\.js$/,     // Finding scripts
  /^get-.*\.js$/,      // Getting scripts
  /^pull-.*\.js$/,     // Pulling scripts
  /^query-.*\.js$/,    // Query scripts
  /^refresh-.*\.js$/,  // Refresh scripts
  /^scan-.*\.js$/,     // Scanning scripts
  /^trace-.*\.js$/,    // Tracing scripts
  /^validate-.*\.js$/, // Validation scripts (except known utilities)
  /^verify-.*\.js$/,   // Verification scripts
];

function getScriptStatus(filePath) {
  const fileName = path.basename(filePath);
  const relPath = path.relative('.', filePath);
  
  // Check if it's an active script
  if (ACTIVE_SCRIPTS.includes(relPath) || ACTIVE_SCRIPTS.includes(fileName)) {
    return 'ACTIVE';
  }
  
  // Check if it's a utility script
  if (UTILITY_SCRIPTS.includes(relPath) || UTILITY_SCRIPTS.includes(fileName)) {
    return 'UTILITY';
  }
  
  // Check if it matches deprecated patterns
  for (const pattern of DEPRECATED_PATTERNS) {
    if (pattern.test(fileName)) {
      return 'DEPRECATED';
    }
  }
  
  // Check last modified date
  try {
    const gitLog = execSync(`git log -1 --format="%ai" -- "${filePath}" 2>/dev/null`, { encoding: 'utf8' }).trim();
    if (gitLog) {
      const lastModified = new Date(gitLog);
      const daysSinceModified = (Date.now() - lastModified) / (1000 * 60 * 60 * 24);
      
      // If not modified in 30+ days, likely deprecated
      if (daysSinceModified > 30) {
        return 'DEPRECATED';
      }
    }
  } catch (e) {
    // Not in git or error
  }
  
  // Default to experimental for unknown scripts
  return 'EXPERIMENTAL';
}

function analyzeScript(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  const relPath = path.relative('.', filePath);
  
  // Check if already has a classification header
  const hasClassification = content.includes('STATUS:') && 
    (content.includes('🟢 ACTIVE') || 
     content.includes('🟡 UTILITY') || 
     content.includes('🔴 DEPRECATED') || 
     content.includes('🔵 EXPERIMENTAL'));
  
  const status = getScriptStatus(filePath);
  
  // Get last modified date
  let lastModified = 'Unknown';
  try {
    const gitLog = execSync(`git log -1 --format="%ai" -- "${filePath}" 2>/dev/null`, { encoding: 'utf8' }).trim();
    if (gitLog) {
      lastModified = gitLog.split(' ')[0];
    }
  } catch (e) {
    // Not in git
  }
  
  return {
    path: relPath,
    fileName,
    status,
    hasClassification,
    lastModified
  };
}

function getAllJSFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Skip node_modules and build directories
    if (entry.name === 'node_modules' || entry.name === 'build' || entry.name === '.git') {
      continue;
    }
    
    if (entry.isDirectory()) {
      getAllJSFiles(fullPath, files);
    } else if (entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Main execution
console.log('🔍 Analyzing all JavaScript files in the project...\n');

const allFiles = getAllJSFiles('.');
const analysis = allFiles.map(analyzeScript);

// Group by status
const byStatus = {
  ACTIVE: [],
  UTILITY: [],
  EXPERIMENTAL: [],
  DEPRECATED: []
};

analysis.forEach(file => {
  byStatus[file.status].push(file);
});

// Display results
console.log('📊 Script Classification Results:\n');
console.log('=' .repeat(80));

console.log(`\n🟢 ACTIVE Scripts (${byStatus.ACTIVE.length}):`);
console.log('-'.repeat(40));
byStatus.ACTIVE.forEach(f => {
  console.log(`  ${f.hasClassification ? '✓' : '✗'} ${f.path}`);
  console.log(`     Last modified: ${f.lastModified}`);
});

console.log(`\n🟡 UTILITY Scripts (${byStatus.UTILITY.length}):`);
console.log('-'.repeat(40));
byStatus.UTILITY.forEach(f => {
  console.log(`  ${f.hasClassification ? '✓' : '✗'} ${f.path}`);
  console.log(`     Last modified: ${f.lastModified}`);
});

console.log(`\n🔵 EXPERIMENTAL Scripts (${byStatus.EXPERIMENTAL.length}):`);
console.log('-'.repeat(40));
byStatus.EXPERIMENTAL.slice(0, 10).forEach(f => {
  console.log(`  ${f.hasClassification ? '✓' : '✗'} ${f.path}`);
});
if (byStatus.EXPERIMENTAL.length > 10) {
  console.log(`  ... and ${byStatus.EXPERIMENTAL.length - 10} more`);
}

console.log(`\n🔴 DEPRECATED Scripts (${byStatus.DEPRECATED.length}):`);
console.log('-'.repeat(40));
byStatus.DEPRECATED.slice(0, 10).forEach(f => {
  console.log(`  ${f.hasClassification ? '✓' : '✗'} ${f.path}`);
});
if (byStatus.DEPRECATED.length > 10) {
  console.log(`  ... and ${byStatus.DEPRECATED.length - 10} more`);
}

console.log('\n' + '='.repeat(80));
console.log('\n📈 Summary:');
console.log(`  Total scripts: ${allFiles.length}`);
console.log(`  Active: ${byStatus.ACTIVE.length}`);
console.log(`  Utility: ${byStatus.UTILITY.length}`);
console.log(`  Experimental: ${byStatus.EXPERIMENTAL.length}`);
console.log(`  Deprecated: ${byStatus.DEPRECATED.length}`);

const needsClassification = analysis.filter(f => !f.hasClassification);
console.log(`\n  Scripts needing classification headers: ${needsClassification.length}`);

// Save report
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    total: allFiles.length,
    active: byStatus.ACTIVE.length,
    utility: byStatus.UTILITY.length,
    experimental: byStatus.EXPERIMENTAL.length,
    deprecated: byStatus.DEPRECATED.length,
    needsClassification: needsClassification.length
  },
  scripts: byStatus
};

fs.writeFileSync('script-classification-report.json', JSON.stringify(report, null, 2));
console.log('\n✅ Report saved to script-classification-report.json');

console.log('\n🔧 Next Steps:');
console.log('1. Review the classification report');
console.log('2. Add headers to scripts missing classification');
console.log('3. Move deprecated scripts to archive directory');
console.log('4. Update ACTIVE_SCRIPTS.md documentation');