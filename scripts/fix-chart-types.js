#!/usr/bin/env node

/**
 * Fix missing chartType props in ExpandableChartSection components
 */

const fs = require('fs');
const path = require('path');

function fixChartTypes() {
  console.log('🔧 Fixing chartType props for loading skeletons...\n');
  
  const appPath = path.join(__dirname, '../src/App.tsx');
  let appContent = fs.readFileSync(appPath, 'utf8');
  
  // Chart sections that need chartType="bar"
  const barChartIds = [
    'stake-maturity',
    'create-maturity',
    'torus-rewards',
    'titanx-usage',
    'daily-titanx-usage',
    'shares-releases',
    'daily-torus-burned',
    'buy-burn-activity',
    'titanx-eth-usage',
    'titanx-eth-build-usage',
    'lp-fee-burns'
  ];
  
  // Chart sections that need chartType="line"
  const lineChartIds = [
    'supply-projection',
    'cumulative-torus-burned'
  ];
  
  let fixCount = 0;
  
  // Fix bar charts
  barChartIds.forEach(id => {
    const regex = new RegExp(`(<ExpandableChartSection[^>]*id="${id}"[^>]*)(>)`, 'g');
    appContent = appContent.replace(regex, (match, prefix, suffix) => {
      if (!match.includes('chartType=')) {
        fixCount++;
        console.log(`✅ Fixed: ${id} -> chartType="bar"`);
        return `${prefix} chartType="bar"${suffix}`;
      }
      return match;
    });
  });
  
  // Fix line charts
  lineChartIds.forEach(id => {
    const regex = new RegExp(`(<ExpandableChartSection[^>]*id="${id}"[^>]*)(>)`, 'g');
    appContent = appContent.replace(regex, (match, prefix, suffix) => {
      if (!match.includes('chartType=')) {
        fixCount++;
        console.log(`✅ Fixed: ${id} -> chartType="line"`);
        return `${prefix} chartType="line"${suffix}`;
      }
      return match;
    });
  });
  
  // Save the fixed content
  fs.writeFileSync(appPath, appContent);
  
  console.log(`\n📊 Fixed ${fixCount} chart sections with proper chartType props`);
  console.log('✨ Loading skeletons will now match the actual chart types!');
}

// Run the fix
fixChartTypes();