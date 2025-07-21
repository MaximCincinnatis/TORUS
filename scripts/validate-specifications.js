#!/usr/bin/env node

/**
 * Dashboard Specification Validator
 * Ensures implementation matches specifications
 */

const fs = require('fs');
const path = require('path');

// Load specifications
const specsPath = path.join(__dirname, '../dashboard-specs');
const chartSpecs = JSON.parse(fs.readFileSync(path.join(specsPath, 'chart-specifications.json'), 'utf8'));
const dataContracts = JSON.parse(fs.readFileSync(path.join(specsPath, 'data-contracts.json'), 'utf8'));
const featureFlags = JSON.parse(fs.readFileSync(path.join(specsPath, 'feature-flags.json'), 'utf8'));

// Validation results
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  errors: []
};

// Helper functions
function logSuccess(message) {
  console.log(`✅ ${message}`);
  results.passed++;
}

function logError(message) {
  console.error(`❌ ${message}`);
  results.failed++;
  results.errors.push(message);
}

function logWarning(message) {
  console.warn(`⚠️  ${message}`);
  results.warnings++;
}

// Validate chart specifications exist in code
function validateChartImplementations() {
  console.log('\n📊 Validating Chart Implementations...\n');
  
  const appPath = path.join(__dirname, '../src/App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf8');
  
  Object.entries(chartSpecs.charts).forEach(([chartId, spec]) => {
    // Check if chart ID exists in App.tsx
    if (appContent.includes(`id="${chartId}"`)) {
      logSuccess(`Chart ${chartId} found in implementation`);
      
      // Validate specific features
      if (spec.features.dataLabels) {
        const hasDataLabels = appContent.includes(`showDataLabels={true}`) && 
                             appContent.includes(chartId);
        if (hasDataLabels) {
          logSuccess(`  └─ Data labels enabled for ${chartId}`);
        } else {
          logError(`  └─ Data labels missing for ${chartId}`);
        }
      }
      
      // Check if using correct component
      if (appContent.includes(spec.component)) {
        logSuccess(`  └─ Using correct component: ${spec.component}`);
      } else {
        logError(`  └─ Not using specified component: ${spec.component}`);
      }
    } else {
      logError(`Chart ${chartId} NOT found in implementation`);
    }
  });
}

// Validate LP positions table requirements
function validateLPPositionsTable() {
  console.log('\n📋 Validating LP Positions Table...\n');
  
  const lpTablePath = path.join(__dirname, '../src/components/lp/LPPositionsTable.tsx');
  if (!fs.existsSync(lpTablePath)) {
    logError('LPPositionsTable.tsx not found');
    return;
  }
  
  const lpContent = fs.readFileSync(lpTablePath, 'utf8');
  const lpSpec = chartSpecs.components['lp-positions-table'];
  
  // Check required columns
  lpSpec.requiredColumns.forEach(column => {
    if (lpContent.includes(column.field)) {
      logSuccess(`Column ${column.field} found`);
    } else {
      logError(`Required column ${column.field} NOT found`);
    }
  });
  
  // Check field mappings
  const mappings = lpSpec.validation.fieldMappings;
  Object.entries(mappings).forEach(([from, to]) => {
    if (lpContent.includes(to)) {
      logSuccess(`Field mapping ${from} → ${to} implemented`);
    } else {
      logWarning(`Field mapping ${from} → ${to} may not be implemented`);
    }
  });
}

// Validate data contracts
function validateDataContracts() {
  console.log('\n📄 Validating Data Contracts...\n');
  
  // Check if update scripts handle required fields
  const updateScriptsDir = path.join(__dirname, '../scripts');
  const updateScripts = fs.readdirSync(updateScriptsDir)
    .filter(f => f.includes('update') && f.endsWith('.js'));
  
  updateScripts.forEach(scriptFile => {
    const scriptPath = path.join(updateScriptsDir, scriptFile);
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    
    // Check LP position field handling
    if (scriptContent.includes('lpPositions') || scriptContent.includes('positions')) {
      const hasTorusAmount = scriptContent.includes('torusAmount');
      const hasTitanxAmount = scriptContent.includes('titanxAmount');
      
      if (hasTorusAmount && hasTitanxAmount) {
        logSuccess(`${scriptFile} handles torusAmount/titanxAmount correctly`);
      } else {
        logError(`${scriptFile} missing field mappings for LP positions`);
      }
    }
  });
}

// Validate feature flags
function validateFeatureFlags() {
  console.log('\n🚩 Validating Feature Flags...\n');
  
  Object.entries(featureFlags.features).forEach(([flagName, config]) => {
    if (config.enabled) {
      logSuccess(`Feature "${flagName}" is enabled (${config.rollout})`);
      
      // Check if required fields are specified
      if (config.requiredFields) {
        config.requiredFields.forEach(field => {
          logSuccess(`  └─ Requires field: ${field}`);
        });
      }
    } else {
      logWarning(`Feature "${flagName}" is disabled`);
    }
  });
}

// Validate timeframe support
function validateTimeframes() {
  console.log('\n⏱️  Validating Timeframe Support...\n');
  
  const dateRangeButtonsPath = path.join(__dirname, '../src/components/charts/DateRangeButtons.tsx');
  const content = fs.readFileSync(dateRangeButtonsPath, 'utf8');
  
  const expectedTimeframes = ['7d', '30d', '60d', '88d', 'ALL'];
  expectedTimeframes.forEach(tf => {
    if (content.includes(`'${tf}'`)) {
      logSuccess(`Timeframe ${tf} supported`);
    } else {
      logError(`Timeframe ${tf} NOT supported`);
    }
  });
  
  // Check MAX_CHART_DAYS
  const appPath = path.join(__dirname, '../src/App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf8');
  if (appContent.includes('MAX_CHART_DAYS = 365')) {
    logSuccess('MAX_CHART_DAYS set to 365 for panning');
  } else {
    logError('MAX_CHART_DAYS not properly configured');
  }
}

// Run all validations
function runValidation() {
  console.log('🔍 TORUS Dashboard Specification Validator\n');
  console.log('=' .repeat(50));
  
  validateChartImplementations();
  validateLPPositionsTable();
  validateDataContracts();
  validateFeatureFlags();
  validateTimeframes();
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 VALIDATION SUMMARY\n');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⚠️  Warnings: ${results.warnings}`);
  
  if (results.failed > 0) {
    console.log('\n❌ ERRORS:');
    results.errors.forEach(error => console.log(`  - ${error}`));
    process.exit(1);
  } else {
    console.log('\n✅ All validations passed!');
    process.exit(0);
  }
}

// Run validation
runValidation();