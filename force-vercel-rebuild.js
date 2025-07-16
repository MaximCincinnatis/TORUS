#!/usr/bin/env node

/**
 * Force Vercel to rebuild by updating a source file
 * This ensures the latest JSON is included in the build
 */

const fs = require('fs');
const path = require('path');

const TRIGGER_FILE = path.join(__dirname, 'src', 'constants', 'buildTimestamp.ts');

const content = `// Auto-generated file to trigger Vercel rebuilds
export const BUILD_TIMESTAMP = '${new Date().toISOString()}';
export const BUILD_NUMBER = ${Date.now()};
`;

fs.writeFileSync(TRIGGER_FILE, content);
console.log('✅ Updated build timestamp to force Vercel rebuild');
console.log('   File: src/constants/buildTimestamp.ts');
console.log('   Time:', new Date().toISOString());