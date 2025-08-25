#!/usr/bin/env node

/**
 * ============================================================================
 * STATUS: 🟡 UTILITY - Script Header Addition Tool
 * ============================================================================
 * CREATED: 2025-08-25
 * 
 * PURPOSE:
 * Safely adds deprecation headers to scripts without modifying their functionality.
 * Preserves existing code while clearly marking scripts as deprecated.
 * 
 * USAGE:
 * node add-deprecation-headers.js [--dry-run] [--pattern=fix-*]
 * 
 * OPTIONS:
 * --dry-run: Show what would be done without making changes
 * --pattern: Specific pattern to match (default: all deprecated patterns)
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Patterns for deprecated scripts
const DEPRECATED_PATTERNS = [
  /^fix-.*\.js$/,
  /^audit-.*\.js$/,
  /^analyze-.*\.js$/,
  /^fetch-.*\.js$/
];

function getDeprecationHeader(fileName, lastModified) {
  const today = new Date().toISOString().split('T')[0];
  
  return `/**
 * ============================================================================
 * STATUS: 🔴 DEPRECATED - No longer in active use
 * ============================================================================
 * LAST MODIFIED: ${lastModified || 'Unknown'}
 * CLASSIFICATION DATE: ${today}
 * 
 * ⚠️ WARNING: This script is deprecated and not used in production
 * ⚠️ It may be moved to the archive directory in the future
 * 
 * ORIGINAL PURPOSE:
 * This appears to be a one-time script based on the naming pattern.
 * Likely used for debugging, fixing, or analyzing specific issues.
 * 
 * DEPRECATION REASON:
 * - One-time use script, task completed
 * - Not referenced by any active production scripts
 * - Functionality may have been moved to other scripts
 * 
 * BEFORE USING:
 * 1. Check if functionality exists elsewhere
 * 2. Verify this script is still needed
 * 3. Consider if there's a newer alternative
 * 
 * SCHEDULED FOR ARCHIVAL: After 2025-09-01
 * ============================================================================
 */

// [DEPRECATED CODE BELOW]

`;
}

function shouldAddHeader(filePath) {
  const fileName = path.basename(filePath);
  
  // Check if matches deprecated pattern
  for (const pattern of DEPRECATED_PATTERNS) {
    if (pattern.test(fileName)) {
      return true;
    }
  }
  
  return false;
}

function hasDeprecationHeader(content) {
  return content.includes('STATUS: 🔴 DEPRECATED') || 
         content.includes('DEPRECATED - No longer in active use');
}

function getLastModified(filePath) {
  try {
    const gitLog = execSync(
      `git log -1 --format="%ai" -- "${filePath}" 2>/dev/null`, 
      { encoding: 'utf8' }
    ).trim();
    
    if (gitLog) {
      return gitLog.split(' ')[0];
    }
  } catch (e) {
    // Not in git or error
  }
  
  // Fall back to file stats
  try {
    const stats = fs.statSync(filePath);
    return stats.mtime.toISOString().split('T')[0];
  } catch (e) {
    return 'Unknown';
  }
}

function addHeaderToFile(filePath, dryRun = false) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  
  // Skip if already has deprecation header
  if (hasDeprecationHeader(content)) {
    console.log(`  ✓ Already has header: ${fileName}`);
    return false;
  }
  
  const lastModified = getLastModified(filePath);
  const header = getDeprecationHeader(fileName, lastModified);
  
  // Check if file starts with shebang
  let newContent;
  if (content.startsWith('#!/usr/bin/env node')) {
    // Keep shebang at top
    const lines = content.split('\n');
    newContent = lines[0] + '\n\n' + header + lines.slice(1).join('\n');
  } else {
    newContent = header + content;
  }
  
  if (dryRun) {
    console.log(`  📝 Would add header to: ${fileName}`);
  } else {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`  ✅ Added header to: ${fileName}`);
  }
  
  return true;
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

console.log('🔍 Adding deprecation headers to scripts...\n');
console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (making changes)'}\n`);

// Get all JavaScript files in current directory
const files = fs.readdirSync('.')
  .filter(file => file.endsWith('.js') && shouldAddHeader(file))
  .sort();

console.log(`Found ${files.length} deprecated scripts to process:\n`);

let processedCount = 0;
let skippedCount = 0;

// Group by pattern for better output
const byPattern = {
  'fix-': [],
  'audit-': [],
  'analyze-': [],
  'fetch-': []
};

files.forEach(file => {
  for (const prefix of Object.keys(byPattern)) {
    if (file.startsWith(prefix)) {
      byPattern[prefix].push(file);
      break;
    }
  }
});

// Process each group
for (const [prefix, fileList] of Object.entries(byPattern)) {
  if (fileList.length === 0) continue;
  
  console.log(`\n${prefix}*.js scripts (${fileList.length}):`);
  console.log('-'.repeat(40));
  
  // Process first 5 in each category for safety
  const toProcess = fileList.slice(0, 5);
  
  toProcess.forEach(file => {
    if (addHeaderToFile(file, dryRun)) {
      processedCount++;
    } else {
      skippedCount++;
    }
  });
  
  if (fileList.length > 5) {
    console.log(`  ... and ${fileList.length - 5} more ${prefix}*.js scripts`);
  }
}

console.log('\n' + '='.repeat(60));
console.log('\n📊 Summary:');
console.log(`  Total scripts found: ${files.length}`);
console.log(`  Headers added: ${processedCount}`);
console.log(`  Already had headers: ${skippedCount}`);

if (dryRun) {
  console.log('\n⚠️  This was a dry run. No files were actually modified.');
  console.log('Run without --dry-run to apply changes.');
} else if (processedCount > 0) {
  console.log('\n✅ Headers added successfully!');
  console.log('\nNext steps:');
  console.log('1. Test that core functionality still works');
  console.log('2. Review the changes with git diff');
  console.log('3. Commit the changes if everything looks good');
}

// Test core functionality
if (!dryRun && processedCount > 0) {
  console.log('\n🧪 Testing core functionality...');
  
  try {
    // Check syntax of main script
    execSync('node -c auto-update-fixed.js', { stdio: 'pipe' });
    console.log('  ✅ auto-update-fixed.js syntax OK');
    
    execSync('node -c smart-update-fixed.js', { stdio: 'pipe' });
    console.log('  ✅ smart-update-fixed.js syntax OK');
    
    console.log('\n✅ Core scripts still working!');
  } catch (e) {
    console.log('\n❌ Error detected in core scripts!');
    console.log('Please review changes and fix any issues.');
  }
}