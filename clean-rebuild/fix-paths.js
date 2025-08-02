#!/usr/bin/env node

/**
 * Fix paths in copied scripts to use clean-rebuild directories
 */

const fs = require('fs');
const path = require('path');

const scriptsDir = path.join(__dirname, 'scripts');
const scripts = [
  'update-all-dashboard-data.js',
  'comprehensive-payment-matching.js', 
  'update-buy-process-data.js',
  'update-creates-stakes-incremental.js'
];

console.log('Fixing paths in copied scripts...\n');

scripts.forEach(scriptName => {
  const scriptPath = path.join(scriptsDir, scriptName);
  if (!fs.existsSync(scriptPath)) {
    console.log(`⚠️  ${scriptName} not found`);
    return;
  }
  
  let content = fs.readFileSync(scriptPath, 'utf8');
  let changes = 0;
  
  // Replace public/data paths
  const publicDataReplacements = [
    ['./public/data/', './clean-rebuild/data/'],
    ['"public/data/', '"clean-rebuild/data/'],
    ["'public/data/", "'clean-rebuild/data/"],
    ['`public/data/', '`clean-rebuild/data/'],
    ['/public/data/', '/clean-rebuild/data/']
  ];
  
  publicDataReplacements.forEach(([search, replace]) => {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = content.match(regex);
    if (matches) {
      changes += matches.length;
      content = content.replace(regex, replace);
    }
  });
  
  // Fix shared imports
  if (scriptName === 'update-all-dashboard-data.js') {
    content = content.replace(/require\('\.\.\/\.\.\/\.\.\/shared\//g, "require('../shared/");
    content = content.replace(/require\('\.\.\/\.\.\/shared\//g, "require('../shared/");
  }
  
  // Fix other script references
  content = content.replace(/require\('\.\/scripts\//g, "require('./");
  content = content.replace(/require\('\.\.\/comprehensive-payment-matching/g, "require('./comprehensive-payment-matching");
  
  fs.writeFileSync(scriptPath, content);
  console.log(`✓ ${scriptName} - ${changes} path changes made`);
});

console.log('\nPath fixes complete!');