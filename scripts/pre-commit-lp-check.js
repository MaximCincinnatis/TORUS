#!/usr/bin/env node

/**
 * Pre-commit LP Feature Check
 * Ensures no LP features are accidentally removed
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking LP Position features...\n');

let hasErrors = false;

// Check 1: Verify LPPositionsTable.tsx has required features
const lpTablePath = path.join(__dirname, '../src/components/lp/LPPositionsTable.tsx');
if (fs.existsSync(lpTablePath)) {
  const content = fs.readFileSync(lpTablePath, 'utf8');
  
  const requiredFeatures = [
    { pattern: 'torusAmount', name: 'TORUS amount field' },
    { pattern: 'titanXAmount', name: 'TitanX amount field' },
    { pattern: 'TitanXpng', name: 'TitanX logo' },
    { pattern: 'torus-text', name: 'TORUS styling' },
    { pattern: 'in-range', name: 'Status badges' },
    { pattern: 'uniswap.org/positions', name: 'Uniswap links' },
    { pattern: 'Full Range V3', name: 'Full range display' }
  ];
  
  requiredFeatures.forEach(feature => {
    if (!content.includes(feature.pattern)) {
      console.error(`❌ Missing feature: ${feature.name}`);
      hasErrors = true;
    } else {
      console.log(`✅ Found: ${feature.name}`);
    }
  });
} else {
  console.error('❌ LPPositionsTable.tsx not found!');
  hasErrors = true;
}

// Check 2: Verify specifications include LP requirements
const specsPath = path.join(__dirname, '../dashboard-specs/chart-specifications.json');
if (fs.existsSync(specsPath)) {
  const specs = JSON.parse(fs.readFileSync(specsPath, 'utf8'));
  const lpSpec = specs.components?.['lp-positions-table'];
  
  if (!lpSpec) {
    console.error('❌ LP positions specification missing!');
    hasErrors = true;
  } else {
    const requiredInSpec = ['torusAmount', 'titanxAmount', 'tokenId', 'owner'];
    const specFields = lpSpec.validation?.requiredFields || [];
    
    requiredInSpec.forEach(field => {
      if (!specFields.includes(field)) {
        console.error(`❌ Specification missing required field: ${field}`);
        hasErrors = true;
      }
    });
    
    if (!hasErrors) {
      console.log('✅ Specifications complete');
    }
  }
}

// Check 3: Quick syntax check for common mistakes
const filesToCheck = [
  'src/components/lp/LPPositionsTable.tsx',
  'scripts/lpCalculations.js',
  'scripts/smart-update-fixed.js'
];

filesToCheck.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Check for accidental field removals
    if (file.includes('update') && !content.includes('torusAmount')) {
      console.warn(`⚠️  Warning: ${file} might not be mapping torusAmount`);
    }
  }
});

console.log('\n' + '='.repeat(50));

if (hasErrors) {
  console.error('\n❌ LP feature check FAILED!');
  console.error('Fix the issues above before committing.\n');
  process.exit(1);
} else {
  console.log('\n✅ LP feature check PASSED!');
  console.log('All critical features are present.\n');
  process.exit(0);
}